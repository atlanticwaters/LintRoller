/**
 * Prefer Semantic Variables Rule
 *
 * Flags nodes bound to core/primitive variables (e.g., color/moonlight/moonlight-500)
 * when a semantic variable with the same resolved value exists
 * (e.g., system/icon/default/primary).
 *
 * Uses context-aware scoring to pick the best semantic alternative:
 * - Text fills → prefer "text/" variables
 * - Icon fills → prefer "icon/" variables
 * - Frame/shape fills → prefer "background/" variables
 * - Strokes → prefer "border/" variables
 */

import type { LintViolation, PropertyInspection, RuleConfig, TokenCollection } from '../../shared/types';
import type { VariableInfo } from '../variables';
import { LintRule } from './base';
import { normalizePath } from '../../shared/path-utils';
import { rgbToHex } from '../inspector';

// ─── Types ──────────────────────────────────────────────────────────────

type RGBA = { r: number; g: number; b: number; a?: number };

interface SemanticCandidate {
  variableInfo: VariableInfo;
  normalizedName: string;
}

interface ResolvedValue {
  type: 'color' | 'number';
  hex?: string;
  value?: number;
}

// ─── Context Helpers ────────────────────────────────────────────────────

const ICON_NODE_TYPES = ['VECTOR', 'BOOLEAN_OPERATION', 'STAR', 'LINE', 'ELLIPSE', 'POLYGON'];

function getContextKeywords(property: string, nodeType: string): string[] {
  if (property.includes('stroke')) return ['border'];
  if (property.includes('fill')) {
    if (nodeType === 'TEXT') return ['text'];
    if (ICON_NODE_TYPES.includes(nodeType)) return ['icon'];
    return ['background'];
  }
  return [];
}

function contextScore(normalizedVarName: string, keywords: string[]): number {
  if (keywords.length === 0) return 0;
  const segments = normalizedVarName.split('/');
  return keywords.some(k => segments.includes(k)) ? 10 : 0;
}

// ─── Variable Classification ────────────────────────────────────────────

function isSemanticCollection(collName: string): boolean {
  return collName === 'system' || collName.includes('semantic') || collName.includes('component');
}

function isSemanticVar(normalizedVarName: string, collName: string): boolean {
  if (normalizedVarName.startsWith('system/') || normalizedVarName.startsWith('component/')) {
    return true;
  }
  return isSemanticCollection(collName);
}

// ─── Alias Resolution ───────────────────────────────────────────────────

function resolveToRgba(
  variable: Variable,
  defaultModes: Map<string, string>,
  variableById: Map<string, Variable>,
  visited?: Set<string>
): RGBA | null {
  const seen = visited || new Set<string>();
  if (seen.has(variable.id)) return null;
  seen.add(variable.id);

  const modeId = defaultModes.get(variable.variableCollectionId);
  if (!modeId) return null;

  const value = variable.valuesByMode[modeId];
  if (!value || typeof value !== 'object') return null;

  if ('r' in value) return value as RGBA;

  if ('type' in value && (value as { type: string }).type === 'VARIABLE_ALIAS') {
    const aliasId = (value as { type: string; id: string }).id;
    const aliasVar = variableById.get(aliasId);
    if (!aliasVar) return null;
    return resolveToRgba(aliasVar, defaultModes, variableById, seen);
  }

  return null;
}

function resolveToNumber(
  variable: Variable,
  defaultModes: Map<string, string>,
  variableById: Map<string, Variable>,
  visited?: Set<string>
): number | null {
  const seen = visited || new Set<string>();
  if (seen.has(variable.id)) return null;
  seen.add(variable.id);

  const modeId = defaultModes.get(variable.variableCollectionId);
  if (!modeId) return null;

  const value = variable.valuesByMode[modeId];
  if (typeof value === 'number') return value;

  if (value && typeof value === 'object' && 'type' in value &&
      (value as { type: string }).type === 'VARIABLE_ALIAS') {
    const aliasId = (value as { type: string; id: string }).id;
    const aliasVar = variableById.get(aliasId);
    if (!aliasVar) return null;
    return resolveToNumber(aliasVar, defaultModes, variableById, seen);
  }

  return null;
}

// ─── Rule ───────────────────────────────────────────────────────────────

export class PreferSemanticVariablesRule extends LintRule {
  readonly id = 'prefer-semantic-variables' as const;
  readonly name = 'Prefer Semantic Variables';
  readonly description = 'Flags nodes bound to core variables when semantic alternatives exist';

  private figmaVariables: Map<string, VariableInfo>;

  // Lazy-built indexes: resolved value → semantic candidates
  private semanticColorIndex: Map<string, SemanticCandidate[]> | null = null;
  private semanticNumberIndex: Map<number, SemanticCandidate[]> | null = null;

  // Shared resolution data (built once with the index)
  private variableById: Map<string, Variable> | null = null;
  private defaultModes: Map<string, string> | null = null;
  private collectionNames: Map<string, string> | null = null;

  private indexBuilt = false;

  constructor(
    config: RuleConfig,
    tokens: TokenCollection,
    figmaVariables: Map<string, VariableInfo>
  ) {
    super(config, tokens);
    this.figmaVariables = figmaVariables;
  }

  async check(node: SceneNode, inspections: PropertyInspection[]): Promise<LintViolation[]> {
    // Build index on first call (lazy, once per scan)
    if (!this.indexBuilt) {
      await this.buildSemanticIndex();
    }

    const violations: LintViolation[] = [];

    for (const inspection of inspections) {
      // Only check bound properties
      if (!inspection.isBound || !inspection.boundVariableId) continue;

      // Look up the bound variable
      const varInfo = this.figmaVariables.get(inspection.boundVariableId);
      if (!varInfo) continue; // Missing variable — handled by no-orphaned-variables

      // Is it already semantic? If so, skip.
      const normalizedName = normalizePath(varInfo.name);
      const normalizedCollName = normalizePath(varInfo.collectionName);
      if (isSemanticVar(normalizedName, normalizedCollName)) continue;

      // Resolve the core variable's value
      const resolved = await this.resolveVariable(inspection.boundVariableId);
      if (!resolved) continue;

      // Find semantic alternatives with the same resolved value
      const candidates = this.findSemanticAlternatives(resolved);
      if (candidates.length === 0) continue;

      // Pick the best semantic alternative using context scoring
      const keywords = getContextKeywords(inspection.property, node.type);
      const best = this.pickBestCandidate(candidates, keywords);

      const valueStr = resolved.type === 'color' ? resolved.hex! : String(resolved.value);
      const message = 'Core variable "' + varInfo.name +
        '" should use semantic variable "' + best.variableInfo.name +
        '" (same value: ' + valueStr + ')';

      const violation = this.createViolation(
        node, inspection.property, varInfo.name, message, best.variableInfo.name
      );
      violation.suggestionConfidence = 'exact';
      violation.canUnbind = true;

      // Include alternative semantic suggestions
      if (candidates.length > 1) {
        violation.alternativeTokens = candidates
          .filter(c => c.variableInfo.id !== best.variableInfo.id)
          .slice(0, 3)
          .map(c => ({
            path: c.variableInfo.name,
            value: valueStr,
            distance: 0,
            description: 'semantic alternative',
          }));
      }

      violations.push(violation);
    }

    return violations;
  }

  /**
   * Build the semantic index: maps resolved values to semantic variable candidates.
   * Called once per scan on first check() invocation.
   */
  private async buildSemanticIndex(): Promise<void> {
    this.semanticColorIndex = new Map();
    this.semanticNumberIndex = new Map();

    const variables = await figma.variables.getLocalVariablesAsync();
    const collections = await figma.variables.getLocalVariableCollectionsAsync();

    this.collectionNames = new Map<string, string>();
    this.defaultModes = new Map<string, string>();
    for (const c of collections) {
      this.collectionNames.set(c.id, normalizePath(c.name));
      this.defaultModes.set(c.id, c.defaultModeId);
    }

    this.variableById = new Map<string, Variable>();
    for (const v of variables) {
      this.variableById.set(v.id, v);
    }

    // Index only SEMANTIC variables by their resolved values
    for (const v of variables) {
      if (Object.keys(v.valuesByMode).length === 0) continue;

      const collName = this.collectionNames.get(v.variableCollectionId) || '';
      const normalizedName = normalizePath(v.name);

      if (!isSemanticVar(normalizedName, collName)) continue;

      const candidate: SemanticCandidate = {
        variableInfo: {
          id: v.id,
          name: v.name,
          collectionId: v.variableCollectionId,
          collectionName: collName,
          resolvedType: v.resolvedType,
        },
        normalizedName,
      };

      if (v.resolvedType === 'COLOR') {
        const rgba = resolveToRgba(v, this.defaultModes, this.variableById);
        if (rgba) {
          // Use full hex (with alpha) — don't strip to hex6.
          // Prevents matching opaque colors to semi-transparent variables.
          const hex = rgbToHex(rgba);
          const list = this.semanticColorIndex.get(hex) || [];
          list.push(candidate);
          this.semanticColorIndex.set(hex, list);
        }
      } else if (v.resolvedType === 'FLOAT') {
        const num = resolveToNumber(v, this.defaultModes, this.variableById);
        if (num !== null) {
          const list = this.semanticNumberIndex.get(num) || [];
          list.push(candidate);
          this.semanticNumberIndex.set(num, list);
        }
      }
    }

    console.log('[PreferSemantic] Index built: ' +
      this.semanticColorIndex.size + ' unique colors, ' +
      this.semanticNumberIndex.size + ' unique numbers');

    this.indexBuilt = true;
  }

  /**
   * Resolve a variable to its final color hex or number value.
   */
  private async resolveVariable(variableId: string): Promise<ResolvedValue | null> {
    if (!this.variableById || !this.defaultModes) return null;

    const variable = this.variableById.get(variableId);
    if (!variable) {
      // Variable might not be local — try fetching
      try {
        const fetched = await figma.variables.getVariableByIdAsync(variableId);
        if (!fetched) return null;

        if (fetched.resolvedType === 'COLOR') {
          const rgba = resolveToRgba(fetched, this.defaultModes, this.variableById);
          if (rgba) {
            const hex = rgbToHex(rgba);
            return { type: 'color', hex };
          }
        } else if (fetched.resolvedType === 'FLOAT') {
          const num = resolveToNumber(fetched, this.defaultModes, this.variableById);
          if (num !== null) return { type: 'number', value: num };
        }
        return null;
      } catch {
        return null;
      }
    }

    if (variable.resolvedType === 'COLOR') {
      const rgba = resolveToRgba(variable, this.defaultModes, this.variableById);
      if (rgba) {
        const hex = rgbToHex(rgba);
        return { type: 'color', hex };
      }
    } else if (variable.resolvedType === 'FLOAT') {
      const num = resolveToNumber(variable, this.defaultModes, this.variableById);
      if (num !== null) return { type: 'number', value: num };
    }

    return null;
  }

  /**
   * Find semantic variable candidates that resolve to the same value.
   */
  private findSemanticAlternatives(resolved: ResolvedValue): SemanticCandidate[] {
    if (resolved.type === 'color' && resolved.hex && this.semanticColorIndex) {
      return this.semanticColorIndex.get(resolved.hex) || [];
    }
    if (resolved.type === 'number' && resolved.value !== undefined && this.semanticNumberIndex) {
      return this.semanticNumberIndex.get(resolved.value) || [];
    }
    return [];
  }

  /**
   * Pick the best semantic candidate using context scoring.
   */
  private pickBestCandidate(candidates: SemanticCandidate[], keywords: string[]): SemanticCandidate {
    if (candidates.length === 1) return candidates[0];

    let best = candidates[0];
    let bestScore = -1;

    for (const c of candidates) {
      const score = contextScore(c.normalizedName, keywords);
      if (score > bestScore) {
        bestScore = score;
        best = c;
      }
    }

    return best;
  }
}
