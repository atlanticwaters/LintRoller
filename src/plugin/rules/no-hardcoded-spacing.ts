/**
 * No Hardcoded Spacing Rule
 *
 * Flags auto-layout frames with hardcoded gap and padding values.
 */

import type { LintViolation, PropertyInspection, MatchConfidence, TokenSuggestion } from '../../shared/types';
import { findClosestNumbers, getNumberMatchDescription, SPACING_KEYWORDS } from '../../shared/number-matching';
import { LintRule } from './base';

/**
 * Spacing properties to check
 */
const SPACING_PROPERTIES = [
  'itemSpacing',
  'counterAxisSpacing',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
];

/** Maximum number of alternative suggestions to include */
const MAX_ALTERNATIVES = 3;

/**
 * Rule to detect hardcoded spacing values
 */
export class NoHardcodedSpacingRule extends LintRule {
  readonly id = 'no-hardcoded-spacing' as const;
  readonly name = 'No Hardcoded Spacing';
  readonly description = 'Flags auto-layout frames with hardcoded gap and padding values';

  check(node: SceneNode, inspections: PropertyInspection[]): LintViolation[] {
    // Only check frames with auto-layout
    if (node.type !== 'FRAME' && node.type !== 'COMPONENT' && node.type !== 'INSTANCE') {
      return [];
    }

    const frameNode = node as FrameNode | ComponentNode | InstanceNode;
    if (frameNode.layoutMode === 'NONE') {
      return [];
    }

    const violations: LintViolation[] = [];

    for (const inspection of inspections) {
      // Only check spacing properties
      if (!SPACING_PROPERTIES.includes(inspection.property)) {
        continue;
      }

      // Skip if already bound to a variable
      if (inspection.isBound) {
        continue;
      }

      // Skip if no value or zero (zero is often intentional)
      if (!inspection.rawValue || inspection.rawValue === 0) {
        continue;
      }

      const value = inspection.rawValue as number;

      // Find closest matching tokens
      const matches = findClosestNumbers(
        value,
        this.tokens.numberValues,
        SPACING_KEYWORDS,
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
      violations.push(violation);
    }

    return violations;
  }

  /**
   * Format property name for display
   */
  private formatPropertyName(property: string): string {
    switch (property) {
      case 'itemSpacing':
        return 'gap';
      case 'counterAxisSpacing':
        return 'counter axis gap';
      case 'paddingTop':
        return 'padding top';
      case 'paddingRight':
        return 'padding right';
      case 'paddingBottom':
        return 'padding bottom';
      case 'paddingLeft':
        return 'padding left';
      default:
        return property;
    }
  }
}
