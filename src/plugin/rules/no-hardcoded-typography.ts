/**
 * No Hardcoded Typography Rule
 *
 * Flags text nodes with unbound font properties.
 */

import type { LintViolation, PropertyInspection, MatchConfidence, TokenSuggestion, TextStyleSuggestion } from '../../shared/types';
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
 * Cached text styles for the document
 */
interface CachedTextStyle {
  id: string;
  name: string;
  fontSize: number;
  lineHeight: number | null;
  letterSpacing: number;
}

let cachedTextStyles: CachedTextStyle[] | null = null;

/**
 * Clear the cached text styles (call this when starting a new scan)
 */
export function clearTextStyleCache(): void {
  cachedTextStyles = null;
}

/**
 * Rule to detect hardcoded typography values
 */
export class NoHardcodedTypographyRule extends LintRule {
  readonly id = 'no-hardcoded-typography' as const;
  readonly name = 'No Hardcoded Typography';
  readonly description = 'Flags text nodes with unbound font properties';

  async check(node: SceneNode, inspections: PropertyInspection[]): Promise<LintViolation[]> {
    // Only check text nodes
    if (node.type !== 'TEXT') {
      return [];
    }

    const textNode = node as TextNode;
    const violations: LintViolation[] = [];

    // Load text styles if not cached
    if (cachedTextStyles === null) {
      cachedTextStyles = await this.loadTextStyles();
    }

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

      // Check if this property can be auto-fixed (bound to a variable)
      const canAutoFix = BINDABLE_TYPOGRAPHY_PROPERTIES.includes(inspection.property);

      // For non-bindable properties, try to find a matching text style
      let suggestedTextStyle: TextStyleSuggestion | undefined;
      let canApplyTextStyle = false;

      if (!canAutoFix) {
        // Get all typography values from the text node to find best matching style
        const nodeTypography = this.getTextNodeTypography(textNode);
        suggestedTextStyle = this.findMatchingTextStyle(
          inspection.property,
          value,
          nodeTypography
        );
        canApplyTextStyle = suggestedTextStyle !== undefined;
      }

      // Create message with match info
      const propName = this.formatPropertyName(inspection.property);
      let message: string;

      if (!canAutoFix) {
        // Properties that require text styles (fontSize, lineHeight, letterSpacing)
        if (suggestedTextStyle) {
          message = 'Hardcoded ' + propName + ' value ' + value + ' - matching style available: "' + suggestedTextStyle.name + '"';
        } else if (suggestedToken) {
          const bestMatch = matches[0];
          message = 'Hardcoded ' + propName + ' value ' + value + ' - closest token: ' + suggestedToken + ' (' + getNumberMatchDescription(bestMatch) + '). No matching text style found.';
        } else {
          message = 'Hardcoded ' + propName + ' value ' + value + ' - use a text style instead';
        }
      } else if (suggestedToken) {
        if (suggestionConfidence === 'exact') {
          message = 'Hardcoded ' + propName + ' value ' + value + ' - exact match available: ' + suggestedToken;
        } else {
          const bestMatch = matches[0];
          message = 'Hardcoded ' + propName + ' value ' + value + ' - closest token: ' + suggestedToken + ' (' + getNumberMatchDescription(bestMatch) + ')';
        }
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

      // Add text style suggestion for non-bindable properties
      if (suggestedTextStyle) {
        violation.suggestedTextStyle = suggestedTextStyle;
        violation.canApplyTextStyle = canApplyTextStyle;
      }

      // For non-bindable properties without a matching text style, allow ignoring
      if (!canAutoFix && !canApplyTextStyle) {
        violation.canIgnore = true;
      }

      violations.push(violation);
    }

    return violations;
  }

  /**
   * Load all text styles from the document
   */
  private async loadTextStyles(): Promise<CachedTextStyle[]> {
    try {
      const styles = await figma.getLocalTextStylesAsync();
      return styles.map(style => {
        // Get line height value
        let lineHeightValue: number | null = null;
        if (style.lineHeight && typeof style.lineHeight === 'object') {
          const lh = style.lineHeight as { value: number; unit: string };
          if (lh.unit === 'PIXELS') {
            lineHeightValue = lh.value;
          } else if (lh.unit === 'PERCENT') {
            // Convert percentage to pixels based on font size
            lineHeightValue = (lh.value / 100) * style.fontSize;
          }
        }

        return {
          id: style.id,
          name: style.name,
          fontSize: style.fontSize,
          lineHeight: lineHeightValue,
          letterSpacing: style.letterSpacing ? (style.letterSpacing as { value: number }).value : 0,
        };
      });
    } catch (error) {
      console.error('[Typography] Error loading text styles:', error);
      return [];
    }
  }

  /**
   * Get typography values from a text node
   */
  private getTextNodeTypography(textNode: TextNode): { fontSize: number; lineHeight: number | null; letterSpacing: number } {
    // Get fontSize - handle mixed values
    const fontSize = typeof textNode.fontSize === 'number' ? textNode.fontSize : 0;

    // Get lineHeight
    let lineHeight: number | null = null;
    if (textNode.lineHeight && typeof textNode.lineHeight === 'object') {
      const lh = textNode.lineHeight as { value: number; unit: string };
      if (lh.unit === 'PIXELS') {
        lineHeight = lh.value;
      } else if (lh.unit === 'PERCENT') {
        lineHeight = (lh.value / 100) * fontSize;
      }
    }

    // Get letterSpacing
    let letterSpacing = 0;
    if (textNode.letterSpacing && typeof textNode.letterSpacing === 'object') {
      letterSpacing = (textNode.letterSpacing as { value: number }).value;
    }

    return { fontSize, lineHeight, letterSpacing };
  }

  /**
   * Find a text style that matches the given property value
   */
  private findMatchingTextStyle(
    property: string,
    value: number,
    nodeTypography: { fontSize: number; lineHeight: number | null; letterSpacing: number }
  ): TextStyleSuggestion | undefined {
    if (!cachedTextStyles || cachedTextStyles.length === 0) {
      return undefined;
    }

    // Find styles that match the property value
    const matchingStyles: Array<{ style: CachedTextStyle; matchQuality: 'exact' | 'partial' }> = [];

    for (const style of cachedTextStyles) {
      let propertyMatches = false;
      let isExactMatch = true;

      // Use ±2px tolerance for matching text styles
      const MATCH_TOLERANCE = 2;

      switch (property) {
        case 'fontSize':
          propertyMatches = Math.abs(style.fontSize - value) <= MATCH_TOLERANCE;
          // Check if other properties also match for a better match quality
          if (propertyMatches) {
            // Exact match requires very close values
            isExactMatch = Math.abs(style.fontSize - value) < 0.5;
            if (nodeTypography.lineHeight !== null && style.lineHeight !== null) {
              isExactMatch = isExactMatch && Math.abs(style.lineHeight - nodeTypography.lineHeight) < 1;
            }
            if (Math.abs(style.letterSpacing - nodeTypography.letterSpacing) > 0.1) {
              isExactMatch = false;
            }
          }
          break;

        case 'lineHeight':
          if (style.lineHeight !== null) {
            propertyMatches = Math.abs(style.lineHeight - value) <= MATCH_TOLERANCE;
            if (propertyMatches) {
              isExactMatch = Math.abs(style.lineHeight - value) < 0.5;
              if (Math.abs(style.fontSize - nodeTypography.fontSize) > 0.5) {
                isExactMatch = false;
              }
            }
          }
          break;

        case 'letterSpacing':
          // Letter spacing uses smaller tolerance (0.5px) since values are typically small
          propertyMatches = Math.abs(style.letterSpacing - value) <= 0.5;
          if (propertyMatches) {
            isExactMatch = Math.abs(style.letterSpacing - value) < 0.1;
            if (Math.abs(style.fontSize - nodeTypography.fontSize) > 0.5) {
              isExactMatch = false;
            }
          }
          break;
      }

      if (propertyMatches) {
        matchingStyles.push({
          style,
          matchQuality: isExactMatch ? 'exact' : 'partial',
        });
      }
    }

    // Sort by match quality (exact first) then by name
    matchingStyles.sort((a, b) => {
      if (a.matchQuality === 'exact' && b.matchQuality !== 'exact') return -1;
      if (a.matchQuality !== 'exact' && b.matchQuality === 'exact') return 1;
      return a.style.name.localeCompare(b.style.name);
    });

    if (matchingStyles.length > 0) {
      const best = matchingStyles[0];
      return {
        id: best.style.id,
        name: best.style.name,
        fontSize: best.style.fontSize,
        lineHeight: best.style.lineHeight ?? undefined,
        letterSpacing: best.style.letterSpacing,
        matchQuality: best.matchQuality,
      };
    }

    return undefined;
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
