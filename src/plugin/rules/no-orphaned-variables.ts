/**
 * No Orphaned Variables Rule
 *
 * Flags nodes bound to variables that don't exist in the token set.
 * Now supports suggesting replacement tokens based on the resolved value.
 * Uses normalized path comparison to match variable names to token paths.
 */

import type { LintViolation, PropertyInspection, RuleConfig, TokenCollection, MatchConfidence, TokenSuggestion } from '../../shared/types';
import type { VariableInfo } from '../variables';
import { getTokenPathForVariable } from '../variables';
import { LintRule } from './base';
import { findClosestColors, getDeltaEDescription } from '../../shared/color-distance';
import { rgbToHex } from '../inspector';
import { normalizePath } from '../../shared/path-utils';

/** Maximum Delta E for color suggestions (expanded to always show closest options) */
const MAX_COLOR_DELTA_E = 50;

/** Maximum number of alternative suggestions */
const MAX_ALTERNATIVES = 3;

/** Maximum tolerance for number matching (percentage) - expanded for better suggestions */
const NUMBER_TOLERANCE_PERCENT = 1.0; // 100%

/**
 * Rule to detect bindings to non-existent tokens
 */
export class NoOrphanedVariablesRule extends LintRule {
  readonly id = 'no-orphaned-variables' as const;
  readonly name = 'No Orphaned Variables';
  readonly description = 'Flags nodes bound to variables that do not exist in the token set';

  /** Map of Figma variable IDs to variable info */
  private figmaVariables: Map<string, VariableInfo>;

  /** Set of variable IDs that have matching tokens (using normalized path comparison) */
  private matchedVariableIds: Set<string>;

  constructor(
    config: RuleConfig,
    tokens: TokenCollection,
    figmaVariables: Map<string, VariableInfo>,
    matchedVariableIds: Set<string>
  ) {
    super(config, tokens);
    this.figmaVariables = figmaVariables;
    this.matchedVariableIds = matchedVariableIds;
  }

  /**
   * Check is now async to support fetching variable values
   */
  async check(node: SceneNode, inspections: PropertyInspection[]): Promise<LintViolation[]> {
    const violations: LintViolation[] = [];

    for (const inspection of inspections) {
      // Only check bound properties
      if (!inspection.isBound || !inspection.boundVariableId) {
        continue;
      }

      const variableInfo = this.figmaVariables.get(inspection.boundVariableId);

      if (!variableInfo) {
        // Variable doesn't exist in document (deleted?)
        // Try to find a replacement based on the node's current visual value
        const suggestion = await this.findReplacementFromCurrentValue(
          node,
          inspection.property,
          inspection.rawValue
        );

        let message = `Bound to missing variable ID: ${inspection.boundVariableId}`;
        if (suggestion.suggestedToken) {
          message += `. Suggested replacement: ${suggestion.suggestedToken}`;
        }

        const violation = this.createViolation(
          node,
          inspection.property,
          inspection.boundVariableId,
          message,
          suggestion.suggestedToken
        );
        violation.canUnbind = true;
        violation.suggestionConfidence = suggestion.confidence;
        violation.alternativeTokens = suggestion.alternatives;
        violations.push(violation);
      } else if (this.matchedVariableIds.size > 0 && !this.matchedVariableIds.has(inspection.boundVariableId)) {
        // Variable exists but no matching token found (using normalized path comparison)
        // Check if we can find a matching token path directly
        const matchedTokenPath = getTokenPathForVariable(variableInfo, this.tokens);

        if (matchedTokenPath) {
          // Found a match via normalized comparison - this shouldn't be flagged
          // This is a safety check in case matchedVariableIds wasn't built correctly
          continue;
        }

        // Check for path syntax mismatch (/ vs . notation)
        // This detects cases where the variable and token are the same after normalization
        const pathMismatchToken = this.findPathMismatchToken(variableInfo.name);

        if (pathMismatchToken) {
          // This is a path syntax mismatch - auto-fixable
          const message = `Variable "${variableInfo.name}" has path syntax mismatch with token "${pathMismatchToken}". The paths match after normalization but use different separators (/ vs .).`;

          const violation = this.createViolation(
            node,
            inspection.property,
            variableInfo.name,
            message,
            pathMismatchToken
          );
          violation.canUnbind = true;
          violation.suggestionConfidence = 'exact';
          violation.isPathMismatch = true;
          violation.normalizedMatchPath = pathMismatchToken;
          violations.push(violation);
          continue;
        }

        // Try to get the resolved value and suggest a replacement token
        const suggestion = await this.findReplacementToken(
          inspection.boundVariableId,
          variableInfo,
          inspection.property
        );

        let message = `Variable "${variableInfo.name}" is not defined in the token set`;
        if (suggestion.suggestedToken && suggestion.confidence !== 'exact') {
          message += `. Closest token: ${suggestion.suggestedToken}`;
        } else if (suggestion.suggestedToken) {
          message += `. Exact match: ${suggestion.suggestedToken}`;
        }

        const violation = this.createViolation(
          node,
          inspection.property,
          variableInfo.name,
          message,
          suggestion.suggestedToken
        );
        violation.canUnbind = true;
        violation.suggestionConfidence = suggestion.confidence;
        violation.alternativeTokens = suggestion.alternatives;
        violations.push(violation);
      }
    }

    return violations;
  }

  /**
   * Check if a variable name matches a token path after normalization
   * This detects path syntax mismatches (/ vs . notation)
   */
  private findPathMismatchToken(variableName: string): string | undefined {
    const normalizedVarName = normalizePath(variableName);

    for (const tokenPath of this.tokens.tokens.keys()) {
      const normalizedTokenPath = normalizePath(tokenPath);

      // Check if the normalized paths match but the original paths differ
      if (normalizedVarName === normalizedTokenPath && variableName !== tokenPath) {
        return tokenPath;
      }
    }

    return undefined;
  }

  /**
   * Find a replacement token based on the node's current visual value
   * Used when the bound variable ID no longer exists in the document
   */
  private async findReplacementFromCurrentValue(
    node: SceneNode,
    property: string,
    rawValue: unknown
  ): Promise<{
    suggestedToken?: string;
    confidence?: MatchConfidence;
    alternatives?: TokenSuggestion[];
  }> {
    try {
      // Handle color properties (fills, strokes)
      if (property.includes('fills') || property.includes('strokes')) {
        if (rawValue && typeof rawValue === 'object' && 'r' in rawValue) {
          const colorValue = rawValue as { r: number; g: number; b: number; a?: number };
          return this.findColorReplacement(colorValue);
        }
      }

      // Handle number properties (spacing, radius, etc.)
      if (typeof rawValue === 'number') {
        return this.findNumberReplacement(rawValue, property);
      }

      // Try to get the value directly from the node for number properties
      const numberProps = [
        'itemSpacing', 'counterAxisSpacing',
        'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
        'cornerRadius', 'topLeftRadius', 'topRightRadius', 'bottomLeftRadius', 'bottomRightRadius',
        'paragraphSpacing'
      ];

      if (numberProps.includes(property)) {
        const nodeWithProps = node as unknown as Record<string, unknown>;
        const value = nodeWithProps[property];
        if (typeof value === 'number') {
          return this.findNumberReplacement(value, property);
        }
      }

      return {};
    } catch (error) {
      console.error('[OrphanedVariables] Error finding replacement from current value:', error);
      return {};
    }
  }

  /**
   * Find a replacement token based on the variable's resolved value
   */
  private async findReplacementToken(
    variableId: string,
    variableInfo: VariableInfo,
    property: string
  ): Promise<{
    suggestedToken?: string;
    confidence?: MatchConfidence;
    alternatives?: TokenSuggestion[];
  }> {
    try {
      // Get the actual Figma variable to access its resolved value
      const variable = await figma.variables.getVariableByIdAsync(variableId);
      if (!variable) {
        return {};
      }

      // Get the value for the default mode
      const collection = await figma.variables.getVariableCollectionByIdAsync(variable.variableCollectionId);
      if (!collection || collection.modes.length === 0) {
        return {};
      }

      const defaultModeId = collection.defaultModeId;
      const value = variable.valuesByMode[defaultModeId];

      if (value === undefined) {
        return {};
      }

      // Handle based on variable type
      if (variableInfo.resolvedType === 'COLOR') {
        return this.findColorReplacement(value);
      } else if (variableInfo.resolvedType === 'FLOAT') {
        return this.findNumberReplacement(value as number, property);
      }

      return {};
    } catch (error) {
      console.error('[OrphanedVariables] Error finding replacement:', error);
      return {};
    }
  }

  /**
   * Find a replacement color token
   */
  private findColorReplacement(value: VariableValue): {
    suggestedToken?: string;
    confidence?: MatchConfidence;
    alternatives?: TokenSuggestion[];
  } {
    // Value should be an RGBA object for colors
    if (typeof value !== 'object' || value === null) {
      return {};
    }

    const colorValue = value as { r: number; g: number; b: number; a?: number };
    if (typeof colorValue.r !== 'number') {
      return {};
    }

    const hexColor = rgbToHex(colorValue);
    const hexWithoutAlpha = hexColor.length === 9 ? hexColor.slice(0, 7) : hexColor;

    const matches = findClosestColors(
      hexWithoutAlpha,
      this.tokens.colorValues,
      this.tokens.colorLab,
      MAX_ALTERNATIVES + 1,
      MAX_COLOR_DELTA_E
    );

    if (matches.length === 0) {
      return {};
    }

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
  }

  /**
   * Find a replacement number token (for spacing, radius, etc.)
   */
  private findNumberReplacement(
    value: number,
    property: string
  ): {
    suggestedToken?: string;
    confidence?: MatchConfidence;
    alternatives?: TokenSuggestion[];
  } {
    // Determine which number tokens to search based on property type
    let tokenPaths: string[] = [];

    if (property.includes('padding') || property.includes('Spacing') || property === 'itemSpacing' || property === 'counterAxisSpacing') {
      // Spacing tokens
      tokenPaths = this.findMatchingNumberTokens(value, 'spacing');
    } else if (property.includes('Radius') || property === 'cornerRadius') {
      // Radius tokens
      tokenPaths = this.findMatchingNumberTokens(value, 'radius');
    } else {
      // Try all number tokens
      tokenPaths = this.findMatchingNumberTokens(value, 'all');
    }

    if (tokenPaths.length === 0) {
      return {};
    }

    // For exact matches, confidence is 'exact'
    // For close matches, we'll mark as 'close'
    const exactMatch = tokenPaths.find(path => {
      const token = this.tokens.tokens.get(path);
      return token && token.resolvedValue === value;
    });

    if (exactMatch) {
      const alternatives = tokenPaths
        .filter(p => p !== exactMatch)
        .slice(0, MAX_ALTERNATIVES)
        .map(path => {
          const token = this.tokens.tokens.get(path);
          return {
            path,
            value: String(token?.resolvedValue ?? ''),
            distance: token ? Math.abs((token.resolvedValue as number) - value) : 0,
            description: 'similar value',
          };
        });

      return {
        suggestedToken: exactMatch,
        confidence: 'exact',
        alternatives: alternatives.length > 0 ? alternatives : undefined,
      };
    }

    // No exact match, use closest
    const suggestedToken = tokenPaths[0];
    const token = this.tokens.tokens.get(suggestedToken);
    const tokenValue = token?.resolvedValue as number;
    const diff = Math.abs(tokenValue - value);
    const percentDiff = value !== 0 ? diff / value : diff;

    const confidence: MatchConfidence = percentDiff < 0.05 ? 'close' : 'approximate';

    const alternatives = tokenPaths
      .slice(1, MAX_ALTERNATIVES + 1)
      .map(path => {
        const t = this.tokens.tokens.get(path);
        return {
          path,
          value: String(t?.resolvedValue ?? ''),
          distance: t ? Math.abs((t.resolvedValue as number) - value) : 0,
          description: 'similar value',
        };
      });

    return {
      suggestedToken,
      confidence,
      alternatives: alternatives.length > 0 ? alternatives : undefined,
    };
  }

  /**
   * Find number tokens that match a value
   */
  private findMatchingNumberTokens(value: number, category: 'spacing' | 'radius' | 'all'): string[] {
    const matches: Array<{ path: string; diff: number }> = [];
    const tolerance = value * NUMBER_TOLERANCE_PERCENT;
    const maxAbsoluteTolerance = 20; // Always include tokens within 20px

    for (const [path, token] of this.tokens.tokens) {
      // Filter by category
      if (category === 'spacing' && !path.toLowerCase().includes('spacing') && !path.toLowerCase().includes('space')) {
        continue;
      }
      if (category === 'radius' && !path.toLowerCase().includes('radius') && !path.toLowerCase().includes('radii')) {
        continue;
      }

      // Check if it's a number token
      if (token.type !== 'dimension' && token.type !== 'number') {
        continue;
      }

      const tokenValue = token.resolvedValue;
      if (typeof tokenValue !== 'number') {
        continue;
      }

      const diff = Math.abs(tokenValue - value);

      // Include matches within percentage tolerance OR absolute tolerance
      if (diff === 0 || diff <= Math.max(tolerance, maxAbsoluteTolerance)) {
        matches.push({ path, diff });
      }
    }

    // Sort by difference (closest first)
    matches.sort((a, b) => a.diff - b.diff);

    return matches.map(m => m.path);
  }
}
