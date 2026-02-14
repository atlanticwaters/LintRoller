/**
 * No Orphaned Variables Rule
 *
 * Flags nodes bound to variables that don't exist in the token set.
 * Suggests replacement tokens using BOTH color proximity AND semantic context.
 * Uses normalized path comparison to match variable names to token paths.
 */

import type { LintViolation, PropertyInspection, RuleConfig, TokenCollection, MatchConfidence, TokenSuggestion } from '../../shared/types';
import type { VariableInfo } from '../variables';
import { getTokenPathForVariable } from '../variables';
import { LintRule } from './base';
import { findClosestColors, getDeltaEDescription, compositeOnWhite } from '../../shared/color-distance';
import { rgbToHex } from '../inspector';
import { normalizePath, findFuzzyMatchingTokenPaths } from '../../shared/path-utils';

/** Maximum Delta E for color suggestions */
const MAX_COLOR_DELTA_E = 50;

/** Maximum number of alternative suggestions */
const MAX_ALTERNATIVES = 3;

/** Maximum tolerance for number matching (percentage) */
const NUMBER_TOLERANCE_PERCENT = 1.0; // 100%

/**
 * Semantic categories derived from token path segments.
 * Used to prefer tokens that match the property context.
 */
const PROPERTY_CATEGORY_HINTS: Record<string, string[]> = {
  'fills': ['background', 'surface', 'container', 'overlay', 'accent'],
  'strokes': ['border', 'outline', 'divider', 'separator'],
  'effects': ['elevation', 'shadow'],
};

/**
 * Score how well a token path matches a semantic context.
 * Higher score = better match.
 */
function scoreTokenByContext(tokenPath: string, property: string, variableName?: string): number {
  const normalizedToken = tokenPath.toLowerCase();
  let score = 0;

  // If we have the original variable name, path similarity is the strongest signal
  if (variableName) {
    const normalizedVar = normalizePath(variableName);
    const normalizedTok = normalizePath(tokenPath);

    // Extract path segments for comparison
    const varSegments = normalizedVar.split('/');
    const tokSegments = normalizedTok.split('/');

    // Count matching segments (order-independent for category matching)
    for (const seg of varSegments) {
      if (seg.length > 2 && tokSegments.includes(seg)) {
        score += 10;
      }
    }

    // Bonus for matching the same category prefix (e.g., both start with "background")
    if (varSegments.length > 1 && tokSegments.length > 1 && varSegments[1] === tokSegments[1]) {
      score += 20;
    }
  }

  // Use property type to prefer contextually relevant token categories
  const propertyBase = property.replace(/\[\d+\]/, ''); // strip array index like fills[0] → fills
  const hints = PROPERTY_CATEGORY_HINTS[propertyBase];
  if (hints) {
    for (const hint of hints) {
      if (normalizedToken.includes(hint)) {
        score += 5;
      }
    }
  }

  // Penalize tokens from clearly wrong categories
  if (propertyBase === 'fills' || propertyBase === 'strokes') {
    // Fill/stroke should NOT suggest icon or text tokens
    if (normalizedToken.includes('.icon.') || normalizedToken.includes('.text.')) {
      score -= 15;
    }
  }

  return score;
}

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
        // Variable not in local cache - could be a library variable or deleted.
        // Try to fetch directly from Figma to get its name.
        let variableName: string | undefined;
        let variableCollectionName: string | undefined;
        try {
          const variable = await figma.variables.getVariableByIdAsync(inspection.boundVariableId);
          if (variable) {
            variableName = variable.name;
            // Also try to get collection name for better matching
            try {
              const collection = await figma.variables.getVariableCollectionByIdAsync(variable.variableCollectionId);
              if (collection) {
                variableCollectionName = collection.name;
              }
            } catch {
              // Collection not accessible
            }
          }
        } catch {
          // Variable truly doesn't exist anymore
        }

        // STEP 1: If we have a name, try scored name-based matching
        let suggestion: {
          suggestedToken?: string;
          confidence?: MatchConfidence;
          alternatives?: TokenSuggestion[];
          currentHexColor?: string;
          suggestedHexColor?: string;
        } = {};

        if (variableName) {
          suggestion = this.findNameBasedMatch(variableName);
          // Get the current hex color for the swatch
          if (suggestion.suggestedToken && inspection.rawValue && typeof inspection.rawValue === 'object' && 'r' in inspection.rawValue) {
            const colorValue = inspection.rawValue as { r: number; g: number; b: number; a?: number };
            suggestion.currentHexColor = rgbToHex(colorValue);
          }
        }

        // STEP 3: If no name match, fall back to color-value matching
        if (!suggestion.suggestedToken) {
          suggestion = await this.findReplacementFromCurrentValue(
            node,
            inspection.property,
            inspection.rawValue,
            variableName
          );
        }

        let message = variableName
          ? `Variable "${variableName}" is not in the token set`
          : `Bound to missing variable ID: ${inspection.boundVariableId}`;
        if (suggestion.suggestedToken) {
          if (suggestion.confidence === 'exact' || suggestion.confidence === 'close') {
            message += `. Best match: ${suggestion.suggestedToken}`;
          } else {
            message += `. Nearest match (review recommended): ${suggestion.suggestedToken}`;
          }
        }

        const violation = this.createViolation(
          node,
          inspection.property,
          variableName || inspection.boundVariableId,
          message,
          suggestion.suggestedToken
        );
        violation.canUnbind = true;
        violation.suggestionConfidence = suggestion.confidence;
        violation.alternativeTokens = suggestion.alternatives;
        violation.currentHexColor = suggestion.currentHexColor;
        violation.suggestedHexColor = suggestion.suggestedHexColor;
        violations.push(violation);
      } else if (this.matchedVariableIds.size > 0 && !this.matchedVariableIds.has(inspection.boundVariableId)) {
        // Variable exists but no matching token found (using normalized path comparison)
        // Check if we can find a matching token path directly
        const matchedTokenPath = getTokenPathForVariable(variableInfo, this.tokens);

        if (matchedTokenPath) {
          // Found a match via normalized comparison - this shouldn't be flagged
          continue;
        }

        // Check for path syntax mismatch (/ vs . notation)
        const pathMismatchToken = this.findPathMismatchToken(variableInfo.name);

        if (pathMismatchToken) {
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
        // Use the variable name for semantic context
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
        violation.currentHexColor = suggestion.currentHexColor;
        violation.suggestedHexColor = suggestion.suggestedHexColor;
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
   * Find a replacement token based on the node's current visual value.
   * Used when the bound variable ID no longer exists in the document.
   *
   * For missing variables, we have no semantic context, so confidence
   * is capped at 'approximate' to signal the user should review.
   */
  private async findReplacementFromCurrentValue(
    node: SceneNode,
    property: string,
    rawValue: unknown,
    variableName: string | undefined
  ): Promise<{
    suggestedToken?: string;
    confidence?: MatchConfidence;
    alternatives?: TokenSuggestion[];
    currentHexColor?: string;
    suggestedHexColor?: string;
  }> {
    try {
      // Handle color properties (fills, strokes)
      if (property.includes('fills') || property.includes('strokes')) {
        if (rawValue && typeof rawValue === 'object' && 'r' in rawValue) {
          const colorValue = rawValue as { r: number; g: number; b: number; a?: number };
          return this.findContextAwareColorReplacement(colorValue, property, variableName);
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
   * Find a replacement token by name similarity.
   * This is the PRIMARY matching strategy - find tokens whose path
   * closely matches the variable name before falling back to color-value matching.
   *
   * Example: variable "system/background/container-color/transparent-10"
   * should match token "system.background.container-color.transparent-10" (exact)
   * or "system.background.container-color.transparent-5" (close name match)
   * rather than "system.background.overlay-color.page-scrim" (wrong name, similar color)
   */
  private findNameBasedMatch(
    variableName: string
  ): {
    suggestedToken?: string;
    confidence?: MatchConfidence;
    alternatives?: TokenSuggestion[];
    currentHexColor?: string;
    suggestedHexColor?: string;
  } {
    const allTokenPaths = Array.from(this.tokens.tokens.keys());

    // Find tokens with similar names (minimum 40% path similarity)
    const nameMatches = findFuzzyMatchingTokenPaths(variableName, allTokenPaths, 0.4, MAX_ALTERNATIVES + 1);

    if (nameMatches.length === 0) {
      return {};
    }

    const bestMatch = nameMatches[0];

    // Determine confidence based on similarity score
    let confidence: MatchConfidence;
    if (bestMatch.score >= 0.95) {
      confidence = 'exact';
    } else if (bestMatch.score >= 0.6) {
      confidence = 'close';
    } else {
      confidence = 'approximate';
    }

    // Build alternatives from remaining name matches
    const alternatives = nameMatches.length > 1
      ? nameMatches.slice(1, MAX_ALTERNATIVES + 1).map(m => {
          const token = this.tokens.tokens.get(m.path);
          const resolvedValue = token ? token.resolvedValue : '';
          return {
            path: m.path,
            value: typeof resolvedValue === 'string' ? resolvedValue : resolvedValue,
            distance: Math.round((1 - m.score) * 100) / 100,
            description: m.score >= 0.8 ? 'similar name' : 'partial name match',
          };
        })
      : undefined;

    // Look up hex colors for swatches
    const suggestedTokenData = this.tokens.tokens.get(bestMatch.path);
    const suggestedHexColor = suggestedTokenData && typeof suggestedTokenData.resolvedValue === 'string'
      ? suggestedTokenData.resolvedValue
      : undefined;

    return {
      suggestedToken: bestMatch.path,
      confidence,
      alternatives,
      suggestedHexColor,
    };
  }

  /**
   * Find a replacement token based on the variable's resolved value.
   *
   * Strategy order:
   * 1. Name-based fuzzy matching (PRIMARY) - match by path similarity
   * 2. Color-value matching (FALLBACK) - match by visual color proximity
   */
  private async findReplacementToken(
    variableId: string,
    variableInfo: VariableInfo,
    property: string
  ): Promise<{
    suggestedToken?: string;
    confidence?: MatchConfidence;
    alternatives?: TokenSuggestion[];
    currentHexColor?: string;
    suggestedHexColor?: string;
  }> {
    try {
      // STEP 1: Try name-based matching FIRST
      // This finds tokens whose path is similar to the variable name,
      // regardless of color value. This is the strongest signal.
      const nameMatch = this.findNameBasedMatch(variableInfo.name);
      if (nameMatch.suggestedToken) {
        // Got a name match - also try to get current hex color for the swatch
        if (variableInfo.resolvedType === 'COLOR') {
          const variable = await figma.variables.getVariableByIdAsync(variableId);
          if (variable) {
            const collection = await figma.variables.getVariableCollectionByIdAsync(variable.variableCollectionId);
            if (collection && collection.modes.length > 0) {
              const value = variable.valuesByMode[collection.defaultModeId];
              if (value && typeof value === 'object' && 'r' in value) {
                const colorValue = value as { r: number; g: number; b: number; a?: number };
                nameMatch.currentHexColor = rgbToHex(colorValue);
              }
            }
          }
        }
        return nameMatch;
      }

      // STEP 2: Fall back to color/number value-based matching
      const variable = await figma.variables.getVariableByIdAsync(variableId);
      if (!variable) {
        return {};
      }

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
        return this.findContextAwareColorReplacement(
          value as { r: number; g: number; b: number; a?: number },
          property,
          variableInfo.name
        );
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
   * Find a replacement color token using BOTH color proximity AND semantic context.
   *
   * Uses the allColorPaths index to get ALL tokens for a given hex,
   * then scores them by context relevance (property type, variable name similarity).
   */
  private findContextAwareColorReplacement(
    value: { r: number; g: number; b: number; a?: number } | VariableValue,
    property: string,
    variableName: string | undefined
  ): {
    suggestedToken?: string;
    confidence?: MatchConfidence;
    alternatives?: TokenSuggestion[];
    currentHexColor?: string;
    suggestedHexColor?: string;
  } {
    if (typeof value !== 'object' || value === null) {
      return {};
    }

    const colorValue = value as { r: number; g: number; b: number; a?: number };
    if (typeof colorValue.r !== 'number') {
      return {};
    }

    const hexColor = rgbToHex(colorValue);
    // Composite alpha colors onto white for perceptual matching
    // e.g., #0000001a (10% black) → #e5e5e5 (light gray) instead of stripping to #000000
    const matchHex = compositeOnWhite(hexColor);

    // Step 1: Find color matches using Delta E (same as before)
    const colorMatches = findClosestColors(
      matchHex,
      this.tokens.colorValues,
      this.tokens.colorLab,
      MAX_ALTERNATIVES + 5, // Get extra matches since we'll re-rank
      MAX_COLOR_DELTA_E
    );

    if (colorMatches.length === 0) {
      return {};
    }

    // Step 2: For exact hex matches, expand to ALL tokens with that hex
    // (the colorValues index only stores one token per hex)
    const allCandidates: Array<{
      tokenPath: string;
      tokenHex: string;
      deltaE: number;
      isExact: boolean;
      contextScore: number;
    }> = [];

    for (const match of colorMatches) {
      if (match.isExact) {
        // Get ALL token paths for this exact hex color
        const allPaths = this.tokens.allColorPaths.get(match.tokenHex.toLowerCase()) || [match.tokenPath];
        for (const path of allPaths) {
          allCandidates.push({
            tokenPath: path,
            tokenHex: match.tokenHex,
            deltaE: 0,
            isExact: true,
            contextScore: scoreTokenByContext(path, property, variableName),
          });
        }
      } else {
        // For non-exact matches, also check allColorPaths
        const allPaths = this.tokens.allColorPaths.get(match.tokenHex.toLowerCase()) || [match.tokenPath];
        for (const path of allPaths) {
          allCandidates.push({
            tokenPath: path,
            tokenHex: match.tokenHex,
            deltaE: match.deltaE,
            isExact: false,
            contextScore: scoreTokenByContext(path, property, variableName),
          });
        }
      }
    }

    // Step 3: Sort by context score (descending), then by Delta E (ascending)
    allCandidates.sort((a, b) => {
      // Exact colors always beat non-exact
      if (a.isExact && !b.isExact) return -1;
      if (!a.isExact && b.isExact) return 1;

      // Within the same deltaE tier, prefer higher context score
      const deltaETier = (d: number) => d === 0 ? 0 : d < 2 ? 1 : d < 5 ? 2 : 3;
      const tierA = deltaETier(a.deltaE);
      const tierB = deltaETier(b.deltaE);

      if (tierA !== tierB) return tierA - tierB;

      // Same tier: prefer better context match
      if (a.contextScore !== b.contextScore) return b.contextScore - a.contextScore;

      // Tiebreaker: lower deltaE
      return a.deltaE - b.deltaE;
    });

    // Deduplicate by token path
    const seen = new Set<string>();
    const uniqueCandidates = allCandidates.filter(c => {
      if (seen.has(c.tokenPath)) return false;
      seen.add(c.tokenPath);
      return true;
    });

    if (uniqueCandidates.length === 0) {
      return {};
    }

    const bestMatch = uniqueCandidates[0];

    // Step 4: Determine confidence
    // For missing variables (no variableName), never claim 'exact' since
    // we have no semantic context - just a color value match
    let confidence: MatchConfidence;
    if (!variableName) {
      // Missing variable: best we can say is 'close' (color match) or 'approximate'
      if (bestMatch.isExact || bestMatch.deltaE < 2) {
        confidence = 'close';
      } else {
        confidence = 'approximate';
      }
    } else {
      // Existing variable: can claim 'exact' if both color and context match well
      if (bestMatch.isExact && bestMatch.contextScore > 10) {
        confidence = 'exact';
      } else if (bestMatch.isExact || bestMatch.deltaE < 2) {
        confidence = 'close';
      } else {
        confidence = 'approximate';
      }
    }

    // Step 5: Build alternatives from remaining candidates
    const alternatives = uniqueCandidates.length > 1
      ? uniqueCandidates.slice(1, MAX_ALTERNATIVES + 1).map(c => ({
          path: c.tokenPath,
          value: c.tokenHex,
          distance: Math.round(c.deltaE * 10) / 10,
          description: c.isExact
            ? (c.contextScore > 0 ? 'exact color, similar context' : 'exact color, different context')
            : getDeltaEDescription(c.deltaE),
        }))
      : undefined;

    // Look up the suggested token's resolved hex color
    const suggestedToken = this.tokens.tokens.get(bestMatch.tokenPath);
    const suggestedHexColor = suggestedToken && typeof suggestedToken.resolvedValue === 'string'
      ? suggestedToken.resolvedValue
      : bestMatch.tokenHex;

    return {
      suggestedToken: bestMatch.tokenPath,
      confidence,
      alternatives,
      currentHexColor: hexColor,
      suggestedHexColor,
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
