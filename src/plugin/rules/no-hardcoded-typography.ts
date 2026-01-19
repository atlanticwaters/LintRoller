/**
 * No Hardcoded Typography Rule
 *
 * Flags text nodes with unbound font properties.
 */

import type { LintViolation, PropertyInspection, MatchConfidence, TokenSuggestion } from '../../shared/types';
import { findClosestNumbers, getNumberMatchDescription, TYPOGRAPHY_KEYWORDS } from '../../shared/number-matching';
import { LintRule } from './base';

/**
 * Typography properties to check
 */
const TYPOGRAPHY_PROPERTIES = ['fontSize', 'lineHeight', 'letterSpacing', 'paragraphSpacing'];

/**
 * Typography properties that can be bound to variables.
 * fontSize, lineHeight, and letterSpacing are per-character-range and cannot
 * be bound to variables - they require text styles instead.
 */
const BINDABLE_TYPOGRAPHY_PROPERTIES = ['paragraphSpacing'];

/** Maximum number of alternative suggestions to include */
const MAX_ALTERNATIVES = 3;

/**
 * Rule to detect hardcoded typography values
 */
export class NoHardcodedTypographyRule extends LintRule {
  readonly id = 'no-hardcoded-typography' as const;
  readonly name = 'No Hardcoded Typography';
  readonly description = 'Flags text nodes with unbound font properties';

  check(node: SceneNode, inspections: PropertyInspection[]): LintViolation[] {
    // Only check text nodes
    if (node.type !== 'TEXT') {
      return [];
    }

    const violations: LintViolation[] = [];

    for (const inspection of inspections) {
      // Only check typography properties
      if (!TYPOGRAPHY_PROPERTIES.includes(inspection.property)) {
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

      // Get property-specific keywords
      const propertyKeywords = this.getPropertyKeywords(inspection.property);

      // Find closest matching tokens
      const matches = findClosestNumbers(
        value,
        this.tokens.numberValues,
        [...TYPOGRAPHY_KEYWORDS, ...propertyKeywords],
        MAX_ALTERNATIVES + 1
      );

      let suggestedToken: string | undefined;
      let suggestionConfidence: MatchConfidence | undefined;
      let alternativeTokens: TokenSuggestion[] | undefined;

      if (matches.length > 0) {
        const bestMatch = matches[0];
        suggestedToken = bestMatch.tokenPath;

        // Determine confidence level
        if (bestMatch.isExact) {
          suggestionConfidence = 'exact';
        } else if (bestMatch.difference <= 1) {
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

      // Check if this property can be auto-fixed (bound to a variable)
      const canAutoFix = BINDABLE_TYPOGRAPHY_PROPERTIES.includes(inspection.property);

      // Create message with match info
      const propName = this.formatPropertyName(inspection.property);
      let message: string;

      if (!canAutoFix) {
        // Properties that require text styles
        message = 'Hardcoded ' + propName + ' value ' + value + ' - use a text style instead';
      } else if (suggestedToken && suggestionConfidence !== 'exact') {
        const bestMatch = matches[0];
        message = 'Hardcoded ' + propName + ' value ' + value + ' - closest token: ' + suggestedToken + ' (' + getNumberMatchDescription(bestMatch) + ')';
      } else {
        message = 'Hardcoded ' + propName + ' value ' + value + ' - should use a design token';
      }

      // Only include suggestedToken if the property can be auto-fixed
      const violation = this.createViolation(
        node,
        inspection.property,
        value,
        message,
        canAutoFix ? suggestedToken : undefined
      );

      // Only set confidence and alternatives for fixable properties
      if (canAutoFix) {
        violation.suggestionConfidence = suggestionConfidence;
        violation.alternativeTokens = alternativeTokens;
      }

      violations.push(violation);
    }

    return violations;
  }

  /**
   * Get property-specific keywords for matching
   */
  private getPropertyKeywords(property: string): string[] {
    switch (property) {
      case 'fontSize':
        return ['size', 'font-size'];
      case 'lineHeight':
        return ['line', 'height', 'leading'];
      case 'letterSpacing':
        return ['letter', 'tracking'];
      case 'paragraphSpacing':
        return ['paragraph'];
      default:
        return [];
    }
  }

  /**
   * Format property name for display
   */
  private formatPropertyName(property: string): string {
    switch (property) {
      case 'fontSize':
        return 'font size';
      case 'lineHeight':
        return 'line height';
      case 'letterSpacing':
        return 'letter spacing';
      case 'paragraphSpacing':
        return 'paragraph spacing';
      default:
        return property;
    }
  }
}
