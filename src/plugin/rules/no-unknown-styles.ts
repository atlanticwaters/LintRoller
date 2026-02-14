/**
 * No Unknown Styles Rule
 *
 * Flags nodes using local styles that don't correspond to tokens.
 * Now suggests replacement tokens based on style type and node context.
 */

import type { LintViolation, PropertyInspection, RuleConfig, TokenCollection, MatchConfidence, TokenSuggestion } from '../../shared/types';
import { LintRule } from './base';
import { findClosestColors, getDeltaEDescription, compositeOnWhite } from '../../shared/color-distance';
import { rgbToHex } from '../inspector';

/** Maximum Delta E for color suggestions */
const MAX_COLOR_DELTA_E = 10;

/** Maximum number of alternative suggestions */
const MAX_ALTERNATIVES = 3;

/**
 * Rule to detect usage of styles not in the token set
 */
export class NoUnknownStylesRule extends LintRule {
  readonly id = 'no-unknown-styles' as const;
  readonly name = 'No Unknown Styles';
  readonly description = 'Flags nodes using local styles that do not correspond to tokens';

  /** Map of style names that exist in tokens */
  private tokenStyleNames: Set<string>;

  constructor(config: RuleConfig, tokens: TokenCollection) {
    super(config, tokens);

    // Build set of token paths that might match style names
    this.tokenStyleNames = new Set();
    for (const path of tokens.tokens.keys()) {
      // Add various normalizations of the path
      this.tokenStyleNames.add(path.toLowerCase());
      this.tokenStyleNames.add(path.toLowerCase().replace(/\./g, '/'));
      this.tokenStyleNames.add(path.toLowerCase().replace(/\./g, ' / '));
    }
  }

  async check(node: SceneNode, _inspections: PropertyInspection[]): Promise<LintViolation[]> {
    const violations: LintViolation[] = [];

    // Check fill styles
    if ('fillStyleId' in node && node.fillStyleId && typeof node.fillStyleId === 'string') {
      const style = await figma.getStyleByIdAsync(node.fillStyleId);
      if (style && !this.isKnownStyle(style.name)) {
        const suggestion = await this.findColorSuggestion(node, 'fills');
        const violation = this.createViolation(
          node,
          'fillStyle',
          style.name,
          `Fill style "${style.name}" is not defined in the token set`,
          suggestion?.suggestedToken
        );
        violation.canDetach = true;
        violation.suggestionConfidence = suggestion?.confidence;
        violation.alternativeTokens = suggestion?.alternatives;
        violation.currentHexColor = suggestion?.currentHexColor;
        violation.suggestedHexColor = suggestion?.suggestedHexColor;
        violations.push(violation);
      }
    }

    // Check stroke styles
    if ('strokeStyleId' in node && node.strokeStyleId && typeof node.strokeStyleId === 'string') {
      const style = await figma.getStyleByIdAsync(node.strokeStyleId);
      if (style && !this.isKnownStyle(style.name)) {
        const suggestion = await this.findColorSuggestion(node, 'strokes');
        const violation = this.createViolation(
          node,
          'strokeStyle',
          style.name,
          `Stroke style "${style.name}" is not defined in the token set`,
          suggestion?.suggestedToken
        );
        violation.canDetach = true;
        violation.suggestionConfidence = suggestion?.confidence;
        violation.alternativeTokens = suggestion?.alternatives;
        violation.currentHexColor = suggestion?.currentHexColor;
        violation.suggestedHexColor = suggestion?.suggestedHexColor;
        violations.push(violation);
      }
    }

    // Check text styles
    if (node.type === 'TEXT') {
      const textNode = node as TextNode;
      if (textNode.textStyleId && typeof textNode.textStyleId === 'string') {
        const style = await figma.getStyleByIdAsync(textNode.textStyleId);
        if (style && !this.isKnownStyle(style.name)) {
          // For text styles, we can't easily suggest a single token since they're composite
          const violation = this.createViolation(
            node,
            'textStyle',
            style.name,
            `Text style "${style.name}" is not defined in the token set. Detach to convert to individual properties.`
          );
          violation.canDetach = true;
          violations.push(violation);
        }
      }
    }

    // Check effect styles
    if ('effectStyleId' in node && node.effectStyleId && typeof node.effectStyleId === 'string') {
      const style = await figma.getStyleByIdAsync(node.effectStyleId);
      if (style && !this.isKnownStyle(style.name)) {
        // For effect styles, we can't easily suggest a token
        const violation = this.createViolation(
          node,
          'effectStyle',
          style.name,
          `Effect style "${style.name}" is not defined in the token set. Detach to remove style binding.`
        );
        violation.canDetach = true;
        violations.push(violation);
      }
    }

    return violations;
  }

  /**
   * Find a color token suggestion based on the node's current color.
   * Uses allColorPaths to get ALL tokens for a hex, then picks the
   * most contextually relevant one (e.g., fills prefer background tokens).
   */
  private async findColorSuggestion(
    node: SceneNode,
    paintType: 'fills' | 'strokes'
  ): Promise<{
    suggestedToken?: string;
    confidence?: MatchConfidence;
    alternatives?: TokenSuggestion[];
    currentHexColor?: string;
    suggestedHexColor?: string;
  } | null> {
    try {
      if (!(paintType in node)) return null;

      const paints = (node as GeometryMixin)[paintType];
      if (!Array.isArray(paints) || paints.length === 0) return null;

      // Get first solid paint
      const solidPaint = paints.find((p): p is SolidPaint => p.type === 'SOLID' && p.visible !== false);
      if (!solidPaint) return null;

      const hexColor = rgbToHex(solidPaint.color);
      // Composite alpha colors onto white for perceptual matching
      const matchHex = compositeOnWhite(hexColor);

      const matches = findClosestColors(
        matchHex,
        this.tokens.colorValues,
        this.tokens.colorLab,
        MAX_ALTERNATIVES + 3,
        MAX_COLOR_DELTA_E
      );

      if (matches.length === 0) return null;

      // Category hints for context-aware selection
      const categoryHints: Record<string, string[]> = {
        'fills': ['background', 'surface', 'container', 'overlay', 'accent'],
        'strokes': ['border', 'outline', 'divider', 'separator'],
      };

      // Expand exact matches to all tokens with that hex, score by context
      const candidates: Array<{ path: string; hex: string; deltaE: number; isExact: boolean; score: number }> = [];
      for (const match of matches) {
        const allPaths = this.tokens.allColorPaths.get(match.tokenHex.toLowerCase()) || [match.tokenPath];
        for (const path of allPaths) {
          let score = 0;
          const lowerPath = path.toLowerCase();
          const hints = categoryHints[paintType];
          if (hints) {
            for (const hint of hints) {
              if (lowerPath.includes(hint)) score += 5;
            }
          }
          // Penalize wrong-category tokens
          if (paintType === 'fills' && (lowerPath.includes('.icon.') || lowerPath.includes('.text.'))) {
            score -= 10;
          }
          candidates.push({ path, hex: match.tokenHex, deltaE: match.deltaE, isExact: match.isExact, score });
        }
      }

      // Sort: exact first, then by score (desc), then by deltaE (asc)
      candidates.sort((a, b) => {
        if (a.isExact && !b.isExact) return -1;
        if (!a.isExact && b.isExact) return 1;
        if (a.score !== b.score) return b.score - a.score;
        return a.deltaE - b.deltaE;
      });

      // Deduplicate
      const seen = new Set<string>();
      const unique = candidates.filter(c => {
        if (seen.has(c.path)) return false;
        seen.add(c.path);
        return true;
      });

      if (unique.length === 0) return null;

      const bestMatch = unique[0];
      let confidence: MatchConfidence;

      if (bestMatch.isExact) {
        confidence = 'exact';
      } else if (bestMatch.deltaE < 2) {
        confidence = 'close';
      } else {
        confidence = 'approximate';
      }

      const alternatives = unique.length > 1
        ? unique.slice(1, MAX_ALTERNATIVES + 1).map(c => ({
            path: c.path,
            value: c.hex,
            distance: Math.round(c.deltaE * 10) / 10,
            description: c.isExact
              ? (c.score > 0 ? 'exact color, similar context' : 'exact color, different context')
              : getDeltaEDescription(c.deltaE),
          }))
        : undefined;

      // Look up the suggested token's resolved hex color
      const suggestedToken = this.tokens.tokens.get(bestMatch.path);
      const suggestedHexColor = suggestedToken && typeof suggestedToken.resolvedValue === 'string'
        ? suggestedToken.resolvedValue
        : bestMatch.hex;

      return {
        suggestedToken: bestMatch.path,
        confidence,
        alternatives,
        currentHexColor: hexColor,
        suggestedHexColor,
      };
    } catch (error) {
      console.error('[NoUnknownStyles] Error finding color suggestion:', error);
      return null;
    }
  }

  /**
   * Check if a style name matches a known token
   */
  private isKnownStyle(styleName: string): boolean {
    const normalized = styleName.toLowerCase();

    // Direct match
    if (this.tokenStyleNames.has(normalized)) {
      return true;
    }

    // Try with slash normalization
    if (this.tokenStyleNames.has(normalized.replace(/ \/ /g, '/'))) {
      return true;
    }

    // Try with dot normalization
    if (this.tokenStyleNames.has(normalized.replace(/ \/ /g, '.').replace(/\//g, '.'))) {
      return true;
    }

    return false;
  }
}
