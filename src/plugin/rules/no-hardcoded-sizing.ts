/**
 * No Hardcoded Sizing Rule
 *
 * Flags nodes with hardcoded width/height values that should use design tokens.
 */

import type { LintViolation, PropertyInspection, MatchConfidence, TokenSuggestion } from '../../shared/types';
import { findClosestNumbers, getNumberMatchDescription, SIZING_KEYWORDS } from '../../shared/number-matching';
import { LintRule } from './base';

/**
 * Sizing properties to check
 */
const SIZING_PROPERTIES = [
  'width',
  'height',
  'minWidth',
  'minHeight',
  'maxWidth',
  'maxHeight',
];

/** Maximum number of alternative suggestions to include */
const MAX_ALTERNATIVES = 3;

/**
 * Rule to detect hardcoded sizing values
 */
export class NoHardcodedSizingRule extends LintRule {
  readonly id = 'no-hardcoded-sizing' as const;
  readonly name = 'No Hardcoded Sizing';
  readonly description = 'Flags nodes with hardcoded width/height values';

  check(node: SceneNode, inspections: PropertyInspection[]): LintViolation[] {
    if (!('width' in node) || !('height' in node)) {
      return [];
    }

    const violations: LintViolation[] = [];

    for (const inspection of inspections) {
      // Only check sizing properties
      if (!SIZING_PROPERTIES.includes(inspection.property)) {
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

      // For width/height, skip nodes using HUG or FILL sizing
      if (inspection.property === 'width' && 'layoutSizingHorizontal' in node) {
        const sizing = (node as FrameNode).layoutSizingHorizontal;
        if (sizing === 'HUG' || sizing === 'FILL') {
          continue;
        }
      }
      if (inspection.property === 'height' && 'layoutSizingVertical' in node) {
        const sizing = (node as FrameNode).layoutSizingVertical;
        if (sizing === 'HUG' || sizing === 'FILL') {
          continue;
        }
      }

      const value = inspection.rawValue as number;

      // Find closest matching tokens
      const matches = findClosestNumbers(
        value,
        this.tokens.numberValues,
        SIZING_KEYWORDS,
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
      case 'width':
        return 'width';
      case 'height':
        return 'height';
      case 'minWidth':
        return 'min width';
      case 'minHeight':
        return 'min height';
      case 'maxWidth':
        return 'max width';
      case 'maxHeight':
        return 'max height';
      default:
        return property;
    }
  }
}
