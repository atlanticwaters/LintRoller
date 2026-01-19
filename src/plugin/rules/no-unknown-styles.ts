/**
 * No Unknown Styles Rule
 *
 * Flags nodes using local styles that don't correspond to tokens.
 * Now suggests replacement tokens based on style type and node context.
 */

import type { LintViolation, PropertyInspection, RuleConfig, TokenCollection, MatchConfidence, TokenSuggestion } from '../../shared/types';
import { LintRule } from './base';
import { findClosestColors, getDeltaEDescription } from '../../shared/color-distance';
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
   * Find a color token suggestion based on the node's current color
   */
  private async findColorSuggestion(
    node: SceneNode,
    paintType: 'fills' | 'strokes'
  ): Promise<{
    suggestedToken?: string;
    confidence?: MatchConfidence;
    alternatives?: TokenSuggestion[];
  } | null> {
    try {
      if (!(paintType in node)) return null;

      const paints = (node as GeometryMixin)[paintType];
      if (!Array.isArray(paints) || paints.length === 0) return null;

      // Get first solid paint
      const solidPaint = paints.find((p): p is SolidPaint => p.type === 'SOLID' && p.visible !== false);
      if (!solidPaint) return null;

      const hexColor = rgbToHex(solidPaint.color);
      const hexWithoutAlpha = hexColor.length === 9 ? hexColor.slice(0, 7) : hexColor;

      const matches = findClosestColors(
        hexWithoutAlpha,
        this.tokens.colorValues,
        this.tokens.colorLab,
        MAX_ALTERNATIVES + 1,
        MAX_COLOR_DELTA_E
      );

      if (matches.length === 0) return null;

      const bestMatch = matches[0];
      let confidence: MatchConfidence;

      if (bestMatch.isExact) {
        confidence = 'exact';
      } else if (bestMatch.deltaE < 2) {
        confidence = 'close';
      } else {
        confidence = 'approximate';
      }

      const alternatives = matches.length > 1
        ? matches.slice(1, MAX_ALTERNATIVES + 1).map(m => ({
            path: m.tokenPath,
            value: m.tokenHex,
            distance: Math.round(m.deltaE * 10) / 10,
            description: getDeltaEDescription(m.deltaE),
          }))
        : undefined;

      return {
        suggestedToken: bestMatch.tokenPath,
        confidence,
        alternatives,
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
