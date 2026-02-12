/**
 * No Hardcoded Colors Rule
 *
 * Flags fills and strokes using literal colors instead of variables.
 */

import type { LintViolation, PropertyInspection, MatchConfidence, TokenSuggestion } from '../../shared/types';
import { findClosestColors, getDeltaEDescription } from '../../shared/color-distance';
import { rgbToHex } from '../inspector';
import { LintRule } from './base';

/**
 * RGB color type from Figma
 */
interface RGB {
  r: number;
  g: number;
  b: number;
}

/** Node types that typically represent icons (vector shapes) */
const ICON_NODE_TYPES = ['VECTOR', 'BOOLEAN_OPERATION', 'STAR', 'LINE', 'ELLIPSE', 'POLYGON'];

/**
 * Get context keywords to prefer in token paths based on property and node type.
 * - Text fills → prefer "text" tokens
 * - Vector/icon fills → prefer "icon" tokens
 * - Frame/shape fills → prefer "background" tokens
 * - Strokes → prefer "border" tokens
 */
function getContextKeywords(property: string, nodeType: string): string[] {
  if (property.includes('stroke')) {
    return ['border'];
  }
  if (property.includes('fill')) {
    if (nodeType === 'TEXT') return ['text'];
    if (ICON_NODE_TYPES.includes(nodeType)) return ['icon'];
    return ['background'];
  }
  return [];
}

/**
 * Pick the most contextually appropriate token from a list of candidate paths.
 * Returns the first path that contains a matching keyword as a path segment.
 */
function pickContextualToken(tokenPaths: string[], keywords: string[]): string {
  if (keywords.length === 0 || tokenPaths.length <= 1) {
    return tokenPaths[0];
  }
  for (const keyword of keywords) {
    const match = tokenPaths.find(p => {
      const segments = p.toLowerCase().split(/[./]/);
      return segments.includes(keyword);
    });
    if (match) return match;
  }
  return tokenPaths[0];
}

/** Maximum Delta E for "close" suggestions (colors within this range are good matches) */
const CLOSE_DELTA_E = 10;

/** Maximum Delta E for any suggestions (Delta E > 10 = clearly different colors) */
const MAX_DELTA_E = 10;

/** Maximum number of alternative suggestions to include */
const MAX_ALTERNATIVES = 3;

/**
 * Rule to detect hardcoded color values
 */
export class NoHardcodedColorsRule extends LintRule {
  readonly id = 'no-hardcoded-colors' as const;
  readonly name = 'No Hardcoded Colors';
  readonly description = 'Flags fills and strokes using literal colors instead of variables';

  check(node: SceneNode, inspections: PropertyInspection[]): LintViolation[] {
    const violations: LintViolation[] = [];

    for (const inspection of inspections) {
      // Only check fill and stroke properties
      if (!inspection.property.includes('fills') && !inspection.property.includes('strokes')) {
        continue;
      }

      // Skip if already bound to a variable
      if (inspection.isBound) {
        continue;
      }

      // Skip if no value
      if (!inspection.rawValue) {
        continue;
      }

      // Convert color to hex
      const color = inspection.rawValue as RGB;
      const hexColor = rgbToHex(color);

      // Skip fully transparent colors (alpha = 0)
      if (hexColor.length === 9 && hexColor.endsWith('00')) {
        continue;
      }

      // Find closest matching tokens
      const { matches, alphaStripped } = this.findClosestColorTokens(hexColor);

      // For exact matches, override with the most contextually appropriate token
      // (e.g. text fills prefer "text/" tokens, strokes prefer "border/" tokens)
      if (matches.length > 0 && matches[0].isExact && this.tokens.colorTokensByHex) {
        const contextHex = matches[0].tokenHex.toLowerCase();
        const allPaths = this.tokens.colorTokensByHex.get(contextHex);
        if (allPaths && allPaths.length > 1) {
          const keywords = getContextKeywords(inspection.property, node.type);
          const contextual = pickContextualToken(allPaths, keywords);
          if (contextual && contextual !== matches[0].tokenPath) {
            console.log(`[NoHardcodedColors] Context override: ${matches[0].tokenPath} → ${contextual} (keywords: ${keywords.join(',')})`);
            matches[0] = { ...matches[0], tokenPath: contextual };
          }
        }
      }

      let suggestedToken: string | undefined;
      let suggestionConfidence: MatchConfidence | undefined;
      let alternativeTokens: TokenSuggestion[] | undefined;

      if (matches.length > 0) {
        const bestMatch = matches[0];
        suggestedToken = bestMatch.tokenPath;

        // Determine confidence level based on Delta E
        if (bestMatch.isExact) {
          suggestionConfidence = 'exact';
        } else if (bestMatch.deltaE < 2) {
          suggestionConfidence = 'close';
        } else if (bestMatch.deltaE < CLOSE_DELTA_E) {
          suggestionConfidence = 'approximate';
        } else {
          suggestionConfidence = 'approximate';
        }

        // When alpha was stripped, the RGB match may be misleading — downgrade confidence
        if (alphaStripped && suggestionConfidence !== 'approximate') {
          suggestionConfidence = 'approximate';
        }

        // Include alternatives (excluding the best match)
        if (matches.length > 1) {
          alternativeTokens = matches.slice(1, MAX_ALTERNATIVES + 1).map(m => ({
            path: m.tokenPath,
            value: m.tokenHex,
            distance: Math.round(m.deltaE * 10) / 10,
            description: getDeltaEDescription(m.deltaE),
          }));
        }
      }

      // Create message with match info
      let message: string;
      const alphaNote = alphaStripped ? ' (RGB only - alpha differs)' : '';
      if (suggestedToken) {
        if (!alphaStripped && suggestionConfidence === 'exact') {
          message = 'Hardcoded color ' + hexColor + ' - exact match available: ' + suggestedToken;
        } else if (alphaStripped && matches[0].isExact) {
          message = 'Hardcoded color ' + hexColor + ' - RGB match: ' + suggestedToken + alphaNote;
        } else {
          const bestMatch = matches[0];
          message = 'Hardcoded color ' + hexColor + ' - closest token: ' + suggestedToken + ' (' + getDeltaEDescription(bestMatch.deltaE) + ')' + alphaNote;
        }
      } else {
        message = 'Hardcoded color ' + hexColor + ' - should use a design token';
      }

      const violation = this.createViolationWithSuggestions(
        node,
        inspection.property,
        hexColor,
        message,
        suggestedToken,
        suggestionConfidence,
        alternativeTokens
      );
      if (suggestionConfidence === 'approximate') {
        violation.canIgnore = true;
      }
      violations.push(violation);
    }

    return violations;
  }

  /**
   * Find closest matching color tokens using Delta E.
   * Returns alphaStripped flag when alpha was removed for RGB-only matching.
   */
  private findClosestColorTokens(hex: string): {
    matches: Array<{
      tokenPath: string;
      tokenHex: string;
      deltaE: number;
      isExact: boolean;
    }>;
    alphaStripped: boolean;
  } {
    const alphaStripped = hex.length === 9;
    const hexWithoutAlpha = alphaStripped ? hex.slice(0, 7) : hex;

    const matches = findClosestColors(
      hexWithoutAlpha,
      this.tokens.colorValues,
      this.tokens.colorLab,
      MAX_ALTERNATIVES + 1,
      MAX_DELTA_E
    );

    return { matches, alphaStripped };
  }

  /**
   * Create a violation with suggestion details
   */
  private createViolationWithSuggestions(
    node: SceneNode,
    property: string,
    currentValue: string | number,
    message: string,
    suggestedToken?: string,
    suggestionConfidence?: MatchConfidence,
    alternativeTokens?: TokenSuggestion[]
  ): LintViolation {
    const violation = this.createViolation(node, property, currentValue, message, suggestedToken);
    violation.suggestionConfidence = suggestionConfidence;
    violation.alternativeTokens = alternativeTokens;
    return violation;
  }
}
