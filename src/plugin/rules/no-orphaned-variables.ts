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

/** Node types that typically represent icons (vector shapes) */
const ICON_NODE_TYPES = ['VECTOR', 'BOOLEAN_OPERATION', 'STAR', 'LINE', 'ELLIPSE', 'POLYGON'];

/**
 * Get context keywords to prefer in token paths based on property and node type.
 */
function getContextKeywords(property: string, nodeType: string): string[] {
  if (property.includes('stroke')) return ['border'];
  if (property.includes('fill')) {
    if (nodeType === 'TEXT') return ['text'];
    if (ICON_NODE_TYPES.includes(nodeType)) return ['icon'];
    return ['background'];
  }
  return [];
}

/**
 * Pick the most contextually appropriate token from a list of candidate paths.
 */
function pickContextualToken(tokenPaths: string[], keywords: string[]): string {
  if (keywords.length === 0 || tokenPaths.length <= 1) {
    return tokenPaths[0];
  }
  for (const keyword of keywords) {
    const match = tokenPaths.find(p => {
      const segments = p.toLowerCase().split(/[./]/);
      return segments.includes(keyword);
    });
    if (match) return match;
  }
  return tokenPaths[0];
}

/** Maximum Delta E for color suggestions (Delta E > 10 = clearly different colors) */
const MAX_COLOR_DELTA_E = 10;

/** Maximum number of alternative suggestions */
const MAX_ALTERNATIVES = 3;

/** Maximum tolerance for number matching (percentage) */
const NUMBER_TOLERANCE_PERCENT = 0.5; // 50%

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
        // Variable doesn't exist in local collection (deleted or from library)
        // Try to resolve via Figma API first, then fall back to node's visual value
        const suggestion = await this.findReplacementForMissingVariable(
          node,
          inspection.property,
          inspection.boundVariableId,
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
        if (suggestion.confidence === 'approximate') {
          violation.canIgnore = true;
        }
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

        // Skip semantic variables (system/, component/, or in semantic collections).
        // These are valid bindings even if they aren't in the token set — the orphaned
        // rule should only flag core/primitive variables that clearly need replacement.
        const normalizedVarName = normalizePath(variableInfo.name);
        const normalizedCollName = normalizePath(variableInfo.collectionName);
        if (normalizedVarName.startsWith('system/') || normalizedVarName.startsWith('component/') ||
            normalizedCollName === 'system' || normalizedCollName.includes('semantic') || normalizedCollName.includes('component')) {
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
          inspection.property,
          node.type
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
        if (suggestion.confidence === 'approximate') {
          violation.canIgnore = true;
        }
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
   * Find a replacement token for a missing variable.
   *
   * Two-step approach:
   * 1. Try resolving the variable via Figma API (handles library variables
   *    that aren't in the local collection)
   * 2. Fall back to reading the node's actual visual value (including paint
   *    opacity, which rawValue from the inspector lacks)
   */
  private async findReplacementForMissingVariable(
    node: SceneNode,
    property: string,
    boundVariableId: string,
    rawValue: unknown
  ): Promise<{
    suggestedToken?: string;
    confidence?: MatchConfidence;
    alternatives?: TokenSuggestion[];
  }> {
    // ── Step 1: Try to resolve the variable directly via Figma API ──
    // The variable might exist in a library or team collection even though
    // it's not in our local variables map.
    try {
      const variable = await figma.variables.getVariableByIdAsync(boundVariableId);
      if (variable) {
        const collection = await figma.variables.getVariableCollectionByIdAsync(
          variable.variableCollectionId
        );
        if (collection && collection.modes.length > 0) {
          const defaultModeId = collection.defaultModeId;
          let value: VariableValue | undefined = variable.valuesByMode[defaultModeId];

          if (variable.resolvedType === 'COLOR') {
            if (value && typeof value === 'object' && 'type' in value &&
                (value as { type: string }).type === 'VARIABLE_ALIAS') {
              const resolved = await this.resolveVariableAlias(value as { type: string; id: string });
              if (resolved) value = resolved;
            }
            if (value && typeof value === 'object' && value !== null && 'r' in value) {
              console.log('[OrphanedVariables] Resolved missing variable via API: ' + variable.name);
              return this.findColorReplacement(value, property, node.type);
            }
          } else if (variable.resolvedType === 'FLOAT') {
            if (value && typeof value === 'object' && 'type' in value &&
                (value as { type: string }).type === 'VARIABLE_ALIAS') {
              const resolved = await this.resolveVariableAlias(value as { type: string; id: string });
              if (typeof resolved === 'number') value = resolved;
            }
            if (typeof value === 'number') {
              console.log('[OrphanedVariables] Resolved missing variable via API: ' + variable.name);
              return this.findNumberReplacement(value, property);
            }
          }
        }
      }
    } catch {
      // Variable truly doesn't exist, continue to fallback
    }

    // ── Step 2: Read the visual value directly from the node ──
    // This is more robust than relying on rawValue because:
    // - For fills/strokes, we include paint opacity (rawValue only has RGB)
    // - For number properties, we read straight from the node
    try {
      // Color: read the actual paint from the node (includes opacity)
      if (property.includes('fills') || property.includes('strokes')) {
        const colorValue = this.readColorFromNode(node, property);
        if (colorValue) {
          console.log('[OrphanedVariables] Read color from node for: ' + property);
          return this.findColorReplacement(colorValue, property, node.type);
        }
        // Fall back to rawValue from inspector (RGB only, no opacity)
        if (rawValue && typeof rawValue === 'object' && 'r' in rawValue) {
          return this.findColorReplacement(
            rawValue as { r: number; g: number; b: number; a?: number },
            property,
            node.type
          );
        }
      }

      // Number: try rawValue first, then read directly from node
      if (typeof rawValue === 'number') {
        return this.findNumberReplacement(rawValue, property);
      }

      const numberProps = [
        'itemSpacing', 'counterAxisSpacing',
        'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
        'cornerRadius', 'topLeftRadius', 'topRightRadius', 'bottomLeftRadius', 'bottomRightRadius',
        'paragraphSpacing',
      ];
      if (numberProps.includes(property)) {
        const nodeValue = (node as unknown as Record<string, unknown>)[property];
        if (typeof nodeValue === 'number') {
          return this.findNumberReplacement(nodeValue, property);
        }
      }

      return {};
    } catch (error) {
      console.error('[OrphanedVariables] Error finding replacement for missing variable:', error);
      return {};
    }
  }

  /**
   * Read the current color value directly from a node's paint,
   * including paint opacity (which rawValue from the inspector lacks).
   */
  private readColorFromNode(
    node: SceneNode,
    property: string
  ): { r: number; g: number; b: number; a?: number } | null {
    const fillMatch = property.match(/^fills\[(\d+)\]$/);
    if (fillMatch && 'fills' in node) {
      const idx = parseInt(fillMatch[1], 10);
      const fills = (node as GeometryMixin).fills;
      if (Array.isArray(fills) && fills[idx] && fills[idx].type === 'SOLID') {
        const paint = fills[idx] as SolidPaint;
        return { ...paint.color, a: paint.opacity ?? 1 };
      }
    }

    const strokeMatch = property.match(/^strokes\[(\d+)\]$/);
    if (strokeMatch && 'strokes' in node) {
      const idx = parseInt(strokeMatch[1], 10);
      const strokes = (node as GeometryMixin).strokes;
      if (Array.isArray(strokes) && strokes[idx] && strokes[idx].type === 'SOLID') {
        const paint = strokes[idx] as SolidPaint;
        return { ...paint.color, a: paint.opacity ?? 1 };
      }
    }

    return null;
  }

  /**
   * Find a replacement token based on the variable's resolved value
   */
  private async findReplacementToken(
    variableId: string,
    variableInfo: VariableInfo,
    property: string,
    nodeType: string
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
      let value = variable.valuesByMode[defaultModeId];

      if (value === undefined) {
        return {};
      }

      // Handle based on variable type
      if (variableInfo.resolvedType === 'COLOR') {
        // If value is a VariableAlias, resolve it to RGBA
        if (typeof value === 'object' && value !== null && 'type' in value &&
            (value as { type: string }).type === 'VARIABLE_ALIAS') {
          const resolved = await this.resolveVariableAlias(value as { type: string; id: string });
          if (!resolved) return {};
          value = resolved;
        }
        return this.findColorReplacement(value, property, nodeType);
      } else if (variableInfo.resolvedType === 'FLOAT') {
        // If value is a VariableAlias, resolve it to number
        if (typeof value === 'object' && value !== null && 'type' in value &&
            (value as { type: string }).type === 'VARIABLE_ALIAS') {
          const resolved = await this.resolveVariableAlias(value as { type: string; id: string });
          if (typeof resolved !== 'number') return {};
          value = resolved;
        }
        return this.findNumberReplacement(value as number, property);
      }

      return {};
    } catch (error) {
      console.error('[OrphanedVariables] Error finding replacement:', error);
      return {};
    }
  }

  /**
   * Resolve a VariableAlias chain to its final value
   */
  private async resolveVariableAlias(
    alias: { type: string; id: string },
    visited?: Set<string>
  ): Promise<VariableValue | null> {
    const seen = visited || new Set<string>();
    if (seen.has(alias.id)) return null;
    seen.add(alias.id);

    try {
      const variable = await figma.variables.getVariableByIdAsync(alias.id);
      if (!variable) return null;

      const collection = await figma.variables.getVariableCollectionByIdAsync(variable.variableCollectionId);
      if (!collection) return null;

      const value = variable.valuesByMode[collection.defaultModeId];
      if (value === undefined || value === null) return null;

      // Check if it's another alias
      if (typeof value === 'object' && 'type' in value &&
          (value as { type: string }).type === 'VARIABLE_ALIAS') {
        return this.resolveVariableAlias(value as { type: string; id: string }, seen);
      }

      return value;
    } catch {
      return null;
    }
  }

  /**
   * Find a replacement color token
   */
  private findColorReplacement(
    value: VariableValue,
    property?: string,
    nodeType?: string
  ): {
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
    const hasAlpha = hexColor.length === 9;
    const hexWithoutAlpha = hasAlpha ? hexColor.slice(0, 7) : hexColor;

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

    let bestMatch = matches[0];
    let confidence: MatchConfidence;

    if (bestMatch.isExact) {
      confidence = 'exact';

      // For exact matches, use context-aware selection from all token paths at this hex
      if (property && nodeType && this.tokens.colorTokensByHex) {
        const allPaths = this.tokens.colorTokensByHex.get(bestMatch.tokenHex.toLowerCase());
        if (allPaths && allPaths.length > 1) {
          const keywords = getContextKeywords(property, nodeType);
          const contextual = pickContextualToken(allPaths, keywords);
          if (contextual && contextual !== bestMatch.tokenPath) {
            console.log(`[OrphanedVariables] Context override: ${bestMatch.tokenPath} → ${contextual} (keywords: ${keywords.join(',')})`);
            bestMatch = { ...bestMatch, tokenPath: contextual };
          }
        }
      }
    } else if (bestMatch.deltaE < 2) {
      confidence = 'close';
    } else {
      confidence = 'approximate';
    }

    // When alpha was stripped, the RGB match may be misleading — downgrade confidence
    if (hasAlpha && confidence !== 'approximate') {
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
    const maxAbsoluteTolerance = 8; // Always include tokens within 8px

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
