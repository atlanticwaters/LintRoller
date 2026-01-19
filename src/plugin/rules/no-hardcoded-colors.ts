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

/** Maximum Delta E for suggestions (colors within this range will be suggested) */
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
      const matches = this.findClosestColorTokens(hexColor);

      let suggestedToken: string | undefined;
      let suggestionConfidence: MatchConfidence | undefined;
      let alternativeTokens: TokenSuggestion[] | undefined;

      if (matches.length > 0) {
        const bestMatch = matches[0];
        suggestedToken = bestMatch.tokenPath;

        // Determine confidence level
        if (bestMatch.isExact) {
          suggestionConfidence = 'exact';
        } else if (bestMatch.deltaE < 2) {
          suggestionConfidence = 'close';
        } else {
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
      let message = 'Hardcoded color ' + hexColor + ' - should use a design token';
      if (suggestedToken && suggestionConfidence !== 'exact') {
        const bestMatch = matches[0];
        message = 'Hardcoded color ' + hexColor + ' - closest token: ' + suggestedToken + ' (' + getDeltaEDescription(bestMatch.deltaE) + ')';
      }

      violations.push(
        this.createViolationWithSuggestions(
          node,
          inspection.property,
          hexColor,
          message,
          suggestedToken,
          suggestionConfidence,
          alternativeTokens
        )
      );
    }

    return violations;
  }

  /**
   * Find closest matching color tokens using Delta E
   */
  private findClosestColorTokens(hex: string): Array<{
    tokenPath: string;
    tokenHex: string;
    deltaE: number;
    isExact: boolean;
  }> {
    const hexWithoutAlpha = hex.length === 9 ? hex.slice(0, 7) : hex;

    return findClosestColors(
      hexWithoutAlpha,
      this.tokens.colorValues,
      this.tokens.colorLab,
      MAX_ALTERNATIVES + 1,
      MAX_DELTA_E
    );
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
