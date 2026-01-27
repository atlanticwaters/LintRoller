/**
 * No Hardcoded Radii Rule
 *
 * Flags nodes with hardcoded corner radius values.
 */

import type { LintViolation, PropertyInspection, MatchConfidence, TokenSuggestion } from '../../shared/types';
import { findClosestNumbers, getNumberMatchDescription, RADIUS_KEYWORDS } from '../../shared/number-matching';
import { LintRule } from './base';

/**
 * Radius properties to check
 */
const RADIUS_PROPERTIES = [
  'cornerRadius',
  'topLeftRadius',
  'topRightRadius',
  'bottomLeftRadius',
  'bottomRightRadius',
];

/** Maximum number of alternative suggestions to include */
const MAX_ALTERNATIVES = 3;

/**
 * Rule to detect hardcoded corner radius values
 */
export class NoHardcodedRadiiRule extends LintRule {
  readonly id = 'no-hardcoded-radii' as const;
  readonly name = 'No Hardcoded Radii';
  readonly description = 'Flags nodes with hardcoded corner radius values';

  check(node: SceneNode, inspections: PropertyInspection[]): LintViolation[] {
    // Only check nodes that can have corner radius
    if (!('cornerRadius' in node)) {
      return [];
    }

    const violations: LintViolation[] = [];

    for (const inspection of inspections) {
      // Only check radius properties
      if (!RADIUS_PROPERTIES.includes(inspection.property)) {
        continue;
      }

      // Skip if already bound to a variable
      if (inspection.isBound) {
        continue;
      }

      // Skip if no value or zero (square corners are often intentional)
      if (!inspection.rawValue || inspection.rawValue === 0) {
        continue;
      }

      const value = inspection.rawValue as number;

      // Find closest matching tokens
      const matches = findClosestNumbers(
        value,
        this.tokens.numberValues,
        RADIUS_KEYWORDS,
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
      case 'cornerRadius':
        return 'corner radius';
      case 'topLeftRadius':
        return 'top-left radius';
      case 'topRightRadius':
        return 'top-right radius';
      case 'bottomLeftRadius':
        return 'bottom-left radius';
      case 'bottomRightRadius':
        return 'bottom-right radius';
      default:
        return property;
    }
  }
}
