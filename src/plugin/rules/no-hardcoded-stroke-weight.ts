/**
 * No Hardcoded Stroke Weight Rule
 *
 * Flags nodes with hardcoded stroke weight (border width) values.
 */

import type { LintViolation, PropertyInspection, MatchConfidence, TokenSuggestion } from '../../shared/types';
import { findClosestNumbers, getNumberMatchDescription, STROKE_WIDTH_KEYWORDS } from '../../shared/number-matching';
import { LintRule } from './base';

/**
 * Stroke weight properties to check
 */
const STROKE_WEIGHT_PROPERTIES = [
  'strokeWeight',
  'strokeTopWeight',
  'strokeRightWeight',
  'strokeBottomWeight',
  'strokeLeftWeight',
];

/** Maximum number of alternative suggestions to include */
const MAX_ALTERNATIVES = 3;

/**
 * Rule to detect hardcoded stroke weight values
 */
export class NoHardcodedStrokeWeightRule extends LintRule {
  readonly id = 'no-hardcoded-stroke-weight' as const;
  readonly name = 'No Hardcoded Stroke Weight';
  readonly description = 'Flags nodes with hardcoded border width values';

  check(node: SceneNode, inspections: PropertyInspection[]): LintViolation[] {
    // Skip COMPONENT_SET — its dashed border is Figma-managed, not user-configurable
    if (node.type === 'COMPONENT_SET') {
      return [];
    }

    // Only check nodes that have strokes
    if (!('strokes' in node) || !Array.isArray(node.strokes)) {
      return [];
    }

    // Only check if at least one stroke is visible
    const hasVisibleStroke = node.strokes.some((s: Paint) => s.visible !== false);
    if (!hasVisibleStroke) {
      return [];
    }

    const violations: LintViolation[] = [];

    for (const inspection of inspections) {
      // Only check stroke weight properties
      if (!STROKE_WEIGHT_PROPERTIES.includes(inspection.property)) {
        continue;
      }

      // Skip if already bound to a variable
      if (inspection.isBound) {
        continue;
      }

      // Skip if no value or zero
      if (!inspection.rawValue || inspection.rawValue === 0) {
        continue;
      }

      const value = inspection.rawValue as number;

      // Find closest matching tokens
      const matches = findClosestNumbers(
        value,
        this.tokens.numberValues,
        STROKE_WIDTH_KEYWORDS,
        MAX_ALTERNATIVES + 1
      );

      let suggestedToken: string | undefined;
      let suggestionConfidence: MatchConfidence | undefined;
      let alternativeTokens: TokenSuggestion[] | undefined;

      if (matches.length > 0) {
        const bestMatch = matches[0];
        suggestedToken = bestMatch.tokenPath;

        // Determine confidence level based on how close the match is
        if (bestMatch.isExact) {
          suggestionConfidence = 'exact';
        } else if (bestMatch.difference <= 1 || bestMatch.percentDifference <= 0.05) {
          suggestionConfidence = 'close';
        } else {
          suggestionConfidence = 'approximate';
        }

        // Include alternatives (excluding the best match)
        if (matches.length > 1) {
          alternativeTokens = matches.slice(1, MAX_ALTERNATIVES + 1).map(m => ({
            path: m.tokenPath,
            value: m.tokenValue,
            distance: m.difference,
            description: getNumberMatchDescription(m),
          }));
        }
      }

      // Create message with match info
      const propName = this.formatPropertyName(inspection.property);
      let message: string;
      if (suggestedToken) {
        if (suggestionConfidence === 'exact') {
          message = 'Hardcoded ' + propName + ' value ' + value + 'px - exact match available: ' + suggestedToken;
        } else {
          const bestMatch = matches[0];
          message = 'Hardcoded ' + propName + ' value ' + value + 'px - closest token: ' + suggestedToken + ' (' + getNumberMatchDescription(bestMatch) + ')';
        }
      } else {
        message = 'Hardcoded ' + propName + ' value ' + value + 'px - should use a design token';
      }

      const violation = this.createViolation(
        node,
        inspection.property,
        value,
        message,
        suggestedToken
      );
      violation.suggestionConfidence = suggestionConfidence;
      violation.alternativeTokens = alternativeTokens;
      if (suggestionConfidence === 'approximate') {
        violation.canIgnore = true;
      }
      violations.push(violation);
    }

    return violations;
  }

  /**
   * Format property name for display
   */
  private formatPropertyName(property: string): string {
    switch (property) {
      case 'strokeWeight':
        return 'stroke weight';
      case 'strokeTopWeight':
        return 'top stroke weight';
      case 'strokeRightWeight':
        return 'right stroke weight';
      case 'strokeBottomWeight':
        return 'bottom stroke weight';
      case 'strokeLeftWeight':
        return 'left stroke weight';
      default:
        return property;
    }
  }
}
