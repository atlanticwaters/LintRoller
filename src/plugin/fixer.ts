/**
 * Auto-Fix Module (Value-First Design)
 *
 * Binds Figma node properties to the correct design token variables.
 *
 * CRITICAL INVARIANT: Fixes NEVER change the visual appearance.
 * The node's current color/number value is preserved exactly — only the
 * variable binding changes.
 *
 * WORKFLOW:
 * 1. Read the node's current visual value (fill color, stroke color, or number)
 * 2. Find ALL Figma variables that resolve to EXACTLY that value (following aliases)
 * 3. Pick the best match using context (text/icon/bg/border) + token path hint
 * 4. Bind — guaranteed zero visual change
 *
 * MATCHING:
 * - Phase 1: Name-based (full path, name-only, suffix) with value verification
 * - Phase 2: Value-first — byResolvedColor/byResolvedNumber + context scoring
 */

import type { LintRuleId, ThemeConfig, TokenCollection } from '../shared/types';
import type { FixActionDetail } from '../shared/messages';
import { normalizePath, pathEndsWith } from '../shared/path-utils';
import { rgbToHex } from './inspector';

// ─── Types ────────────────────────────────────────────────────────────────

/** Result of applying a fix */
export interface FixResult {
  success: boolean;
  message?: string;
  beforeValue?: string;
  afterValue?: string;
  actionType?: 'rebind' | 'unbind' | 'detach' | 'apply-style';
}

/** Callback for progress updates during bulk fix */
export type BulkFixProgressCallback = (progress: {
  current: number;
  total: number;
  currentAction: FixActionDetail;
}) => void;

// ─── Variable Index ──────────────────────────────────────────────────────

/**
 * Pre-built index of all local Figma variables.
 * Includes alias-resolved color/number maps for value-first matching.
 */
interface VariableIndex {
  /** normalized "collectionName/varName" → Variable */
  byFullPath: Map<string, Variable>;
  /** normalized "varName" → Variable[] (may span collections) */
  byName: Map<string, Variable[]>;
  /** collectionId → normalized collection name */
  collectionNames: Map<string, string>;
  /** collectionId → defaultModeId */
  defaultModes: Map<string, string>;
  /** hex (with alpha) → Variable[] (resolved through aliases; semantic first) */
  byResolvedColor: Map<string, Variable[]>;
  /** number → Variable[] (resolved through aliases; semantic first) */
  byResolvedNumber: Map<number, Variable[]>;
  /** variableId → hex (with alpha, for quick value verification after name match) */
  resolvedColorById: Map<string, string>;
  /** variableId → number (for quick value verification after name match) */
  resolvedNumberById: Map<string, number>;
}

let _cachedIndex: VariableIndex | null = null;
let _indexTimestamp = 0;
const INDEX_TTL_MS = 5000;

// ─── Alias Resolution ────────────────────────────────────────────────────

type RGBA = { r: number; g: number; b: number; a?: number };

/**
 * Follow alias chains to resolve a COLOR variable to its final RGBA value.
 * Semantic variables (e.g., system/text/on-surface-color/primary) store
 * VariableAlias references to core variables — this resolves through those.
 */
function resolveToRgba(
  variable: Variable,
  defaultModes: Map<string, string>,
  variableById: Map<string, Variable>,
  visited?: Set<string>
): RGBA | null {
  const seen = visited || new Set<string>();
  if (seen.has(variable.id)) return null; // circular
  seen.add(variable.id);

  const modeId = defaultModes.get(variable.variableCollectionId);
  if (!modeId) return null;

  const value = variable.valuesByMode[modeId];
  if (!value || typeof value !== 'object') return null;

  // Direct RGBA value
  if ('r' in value) return value as RGBA;

  // VariableAlias — follow the reference
  if ('type' in value && (value as { type: string }).type === 'VARIABLE_ALIAS') {
    const aliasId = (value as { type: string; id: string }).id;
    const aliasVar = variableById.get(aliasId);
    if (!aliasVar) return null; // external library or deleted variable
    return resolveToRgba(aliasVar, defaultModes, variableById, seen);
  }

  return null;
}

/** Follow alias chains to resolve a FLOAT variable to its final number value */
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

function isSemanticCollection(collName: string): boolean {
  return collName === 'system' || collName.includes('semantic') || collName.includes('component');
}

/**
 * Check if a variable is semantic (vs core/primitive).
 * Checks BOTH the variable name AND collection name.
 * Semantic variables have names like "system/text/...", "component/button/...", etc.
 * Core variables have names like "color/moonlight/...", "spacing/...", etc.
 */
function isSemanticVar(normalizedVarName: string, collName: string): boolean {
  if (normalizedVarName.startsWith('system/') || normalizedVarName.startsWith('component/')) {
    return true;
  }
  return isSemanticCollection(collName);
}

/**
 * Check if a variable is a component-scoped variable (e.g., component/text/button-color/...).
 * Component variables are scoped to specific components and should NOT be used as
 * replacement candidates during value-based matching (Phase 2).
 * Only system-level semantic variables should be picked by the fixer.
 */
function isComponentVar(normalizedVarName: string, collName: string): boolean {
  return normalizedVarName.startsWith('component/') || collName.includes('component');
}

// ─── Index Building ──────────────────────────────────────────────────────

async function buildVariableIndex(): Promise<VariableIndex> {
  const variables = await figma.variables.getLocalVariablesAsync();
  const collections = await figma.variables.getLocalVariableCollectionsAsync();

  const collectionNames = new Map<string, string>();
  const defaultModes = new Map<string, string>();
  for (const c of collections) {
    collectionNames.set(c.id, normalizePath(c.name));
    defaultModes.set(c.id, c.defaultModeId);
  }

  const byFullPath = new Map<string, Variable>();
  const byName = new Map<string, Variable[]>();
  const variableById = new Map<string, Variable>();

  for (const v of variables) {
    if (Object.keys(v.valuesByMode).length === 0) continue;
    variableById.set(v.id, v);

    const collName = collectionNames.get(v.variableCollectionId) || '';
    const normalizedName = normalizePath(v.name);
    const fullPath = collName ? collName + '/' + normalizedName : normalizedName;

    byFullPath.set(fullPath, v);

    const list = byName.get(normalizedName) || [];
    list.push(v);
    byName.set(normalizedName, list);
  }

  // Build resolved value indexes (following ALL alias chains)
  const byResolvedColor = new Map<string, Variable[]>();
  const byResolvedNumber = new Map<number, Variable[]>();
  const resolvedColorById = new Map<string, string>();
  const resolvedNumberById = new Map<string, number>();

  for (const v of variables) {
    if (Object.keys(v.valuesByMode).length === 0) continue;

    const collName = collectionNames.get(v.variableCollectionId) || '';
    const normalizedName = normalizePath(v.name);
    const isSemantic = isSemanticVar(normalizedName, collName);

    if (v.resolvedType === 'COLOR') {
      const rgba = resolveToRgba(v, defaultModes, variableById);
      if (rgba) {
        // Use full hex (including alpha) to distinguish opaque from semi-transparent.
        // This prevents matching e.g. #ffffff (opaque) to #ffffffb2 (70% opacity).
        const hex = rgbToHex(rgba);

        resolvedColorById.set(v.id, hex);

        const list = byResolvedColor.get(hex) || [];
        if (isSemantic) {
          list.unshift(v); // semantic variables first
        } else {
          list.push(v);
        }
        byResolvedColor.set(hex, list);
      }
    } else if (v.resolvedType === 'FLOAT') {
      const num = resolveToNumber(v, defaultModes, variableById);
      if (num !== null) {
        resolvedNumberById.set(v.id, num);

        const list = byResolvedNumber.get(num) || [];
        if (isSemantic) {
          list.unshift(v);
        } else {
          list.push(v);
        }
        byResolvedNumber.set(num, list);
      }
    }
  }

  console.log('[Fixer] Index built: ' + byFullPath.size + ' vars, ' +
    byResolvedColor.size + ' unique colors, ' + byResolvedNumber.size + ' unique numbers');

  return {
    byFullPath, byName, collectionNames, defaultModes,
    byResolvedColor, byResolvedNumber, resolvedColorById, resolvedNumberById,
  };
}

/** Get or build the variable index (cached for 5s) */
async function getVariableIndex(): Promise<VariableIndex> {
  const now = Date.now();
  if (_cachedIndex && (now - _indexTimestamp) < INDEX_TTL_MS) {
    return _cachedIndex;
  }
  _cachedIndex = await buildVariableIndex();
  _indexTimestamp = now;
  return _cachedIndex;
}

// ─── Library Variable Support ────────────────────────────────────────────

interface LibraryVarEntry {
  key: string;
  name: string;
  resolvedType: VariableResolvedDataType;
  collectionName: string;
}

let _libraryVarCache: Map<string, LibraryVarEntry[]> | null = null;
let _libraryCacheTimestamp = 0;
const LIBRARY_CACHE_TTL_MS = 30000; // 30s cache

/**
 * Build a map of library variables indexed by normalized name.
 * Cached for 30 seconds to avoid repeated API calls during bulk fixes.
 */
async function getLibraryVariableMap(): Promise<Map<string, LibraryVarEntry[]>> {
  const now = Date.now();
  if (_libraryVarCache && (now - _libraryCacheTimestamp) < LIBRARY_CACHE_TTL_MS) {
    return _libraryVarCache;
  }

  const map = new Map<string, LibraryVarEntry[]>();

  try {
    if (!figma.teamLibrary || !figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync) {
      console.log('[Fixer] Team library API not available');
      _libraryVarCache = map;
      _libraryCacheTimestamp = now;
      return map;
    }

    const collections = await figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync();
    for (const collection of collections) {
      const variables = await figma.teamLibrary.getVariablesInLibraryCollectionAsync(collection.key);
      for (const v of variables) {
        const normalized = normalizePath(v.name);
        const list = map.get(normalized) || [];
        list.push({
          key: v.key,
          name: v.name,
          resolvedType: v.resolvedType,
          collectionName: collection.name,
        });
        map.set(normalized, list);
      }
    }
    console.log('[Fixer] Library variable map: ' + map.size + ' unique names from ' + collections.length + ' collections');
  } catch (e) {
    console.warn('[Fixer] Could not fetch library variables:', e);
  }

  _libraryVarCache = map;
  _libraryCacheTimestamp = now;
  return map;
}

/**
 * Phase 3: Search team library variables by name and import if found.
 * Handles the common case where variables are published in a shared library
 * but haven't been explicitly imported into the current file yet.
 *
 * Tries multiple name strategies:
 * 1. Exact name match on primary token path
 * 2. Suffix match on primary token path
 * 3. Alias chain paths (the token may reference core tokens under different names)
 */
async function findAndImportLibraryVariable(
  tokenPath: string,
  expectedType: VariableResolvedDataType | undefined,
  tokens?: TokenCollection | null
): Promise<Variable | null> {
  const libraryVars = await getLibraryVariableMap();
  if (libraryVars.size === 0) return null;

  // Try the primary token path first, then alias chain paths
  const pathsToTry = [tokenPath];
  if (tokens) {
    // Walk the alias chain to collect all alternative paths
    let currentPath = tokenPath;
    const visited = new Set<string>();
    while (!visited.has(currentPath)) {
      visited.add(currentPath);
      const token = tokens.tokens.get(currentPath);
      if (token && token.isAlias && token.aliasPath) {
        pathsToTry.push(token.aliasPath);
        currentPath = token.aliasPath;
      } else {
        break;
      }
    }
  }

  for (const path of pathsToTry) {
    const normalized = normalizePath(path);

    // Strategy 1: Exact name match
    const exact = libraryVars.get(normalized);
    if (exact) {
      for (const c of exact) {
        if (!expectedType || c.resolvedType === expectedType) {
          try {
            const imported = await figma.variables.importVariableByKeyAsync(c.key);
            console.log('[Fixer] Imported library variable: ' + c.name + ' from ' + c.collectionName);
            _cachedIndex = null; // invalidate local cache since we imported
            return imported;
          } catch (e) {
            console.warn('[Fixer] Failed to import ' + c.name + ':', e);
          }
        }
      }
    }

    // Strategy 2: Suffix match (variable name = trailing portion of token path)
    let bestMatch: LibraryVarEntry | null = null;
    let bestLen = 0;
    for (const [varName, vars] of libraryVars) {
      const segCount = varName.split('/').length;
      if (segCount >= 2 && segCount > bestLen && pathEndsWith(normalized, varName)) {
        for (const c of vars) {
          if (!expectedType || c.resolvedType === expectedType) {
            bestMatch = c;
            bestLen = segCount;
            break;
          }
        }
      }
    }

    if (bestMatch) {
      try {
        const imported = await figma.variables.importVariableByKeyAsync(bestMatch.key);
        console.log('[Fixer] Imported library variable (suffix): ' + bestMatch.name + ' from ' + bestMatch.collectionName);
        _cachedIndex = null;
        return imported;
      } catch (e) {
        console.warn('[Fixer] Failed to import ' + bestMatch.name + ':', e);
      }
    }
  } // end for pathsToTry

  return null;
}

// ─── Context Helpers ─────────────────────────────────────────────────────

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

// ─── Read Current Node Value ─────────────────────────────────────────────

interface CurrentColorValue { type: 'color'; hex: string }
interface CurrentNumberValue { type: 'number'; value: number }
type CurrentValue = CurrentColorValue | CurrentNumberValue | null;

/**
 * Read the current visual value from a node property.
 * This is the value we MUST preserve when applying the fix.
 */
function readCurrentValue(node: SceneNode, property: string): CurrentValue {
  // Color fills (include paint opacity to distinguish opaque from semi-transparent)
  const fillMatch = property.match(/^fills\[(\d+)\]$/);
  if (fillMatch && 'fills' in node) {
    const idx = parseInt(fillMatch[1], 10);
    const fills = (node as GeometryMixin).fills;
    if (Array.isArray(fills) && fills[idx] && fills[idx].type === 'SOLID') {
      const paint = fills[idx] as SolidPaint;
      const opacity = paint.opacity ?? 1;
      const hex = rgbToHex({ ...paint.color, a: opacity });
      return { type: 'color', hex };
    }
  }

  // Color strokes (include paint opacity)
  const strokeMatch = property.match(/^strokes\[(\d+)\]$/);
  if (strokeMatch && 'strokes' in node) {
    const idx = parseInt(strokeMatch[1], 10);
    const strokes = (node as GeometryMixin).strokes;
    if (Array.isArray(strokes) && strokes[idx] && strokes[idx].type === 'SOLID') {
      const paint = strokes[idx] as SolidPaint;
      const opacity = paint.opacity ?? 1;
      const hex = rgbToHex({ ...paint.color, a: opacity });
      return { type: 'color', hex };
    }
  }

  // Number properties
  const nodeWithProps = node as unknown as Record<string, unknown>;
  const val = nodeWithProps[property];
  if (typeof val === 'number') {
    return { type: 'number', value: val };
  }

  return null;
}

// ─── Variable Matching (Value-First) ────────────────────────────────────

function typeMatches(v: Variable, expected?: VariableResolvedDataType): boolean {
  return !expected || v.resolvedType === expected;
}

/**
 * Find the Figma variable to bind for a given token path.
 *
 * Value-first design:
 * 1. Try name-based match (full path, name-only, suffix) — reject if resolved value mismatches
 * 2. Fall back to value-based lookup — find all variables with exact same color, score by context
 *
 * This guarantees zero visual change.
 */
async function findVariableForToken(
  tokenPath: string,
  index: VariableIndex,
  expectedType: VariableResolvedDataType | undefined,
  tokens: TokenCollection | null | undefined,
  context: { property: string; nodeType: string } | undefined,
  currentValue: CurrentValue
): Promise<Variable | null> {
  const cvDesc = currentValue
    ? (currentValue.type === 'color' ? currentValue.hex : String(currentValue.value))
    : 'unknown';
  console.log('[Fixer] Finding variable for "' + tokenPath + '" (current: ' + cvDesc + ')');

  const keywords = context ? getContextKeywords(context.property, context.nodeType) : [];

  // ── Phase 1: Name-based match with value verification ──
  // Only try the PRIMARY token path here — NOT alias chain paths.
  // Alias chains point to core tokens (e.g., color.moonlight.moonlight-500)
  // which would match core variables, bypassing semantic ones.
  // Phase 2 handles value-based matching with proper semantic scoring.
  {
    const match = tryNameBasedMatch(tokenPath, index, expectedType, context);
    if (match) {
      // Verify the variable resolves to the same value as the node's current value
      if (currentValue && currentValue.type === 'color') {
        const varHex = index.resolvedColorById.get(match.id);
        if (varHex && varHex !== currentValue.hex) {
          console.log('[Fixer] Name match "' + match.name + '" rejected: color ' +
            varHex + ' != ' + currentValue.hex);
          // Fall through to Phase 2
        } else {
          console.log('[Fixer] Name match: ' + match.name);
          return match;
        }
      } else if (currentValue && currentValue.type === 'number') {
        const varNum = index.resolvedNumberById.get(match.id);
        if (varNum !== undefined && varNum !== currentValue.value) {
          // Allow "close" matches (same tolerance as lint rules: diff ≤ 1 or pctDiff ≤ 5%)
          // The user accepted this trade-off by clicking Fix on a close-match suggestion
          const diff = Math.abs(varNum - currentValue.value);
          const pctDiff = currentValue.value !== 0 ? diff / Math.abs(currentValue.value) : diff;
          if (diff <= 1 || pctDiff <= 0.05) {
            console.log('[Fixer] Name match (close, diff=' + diff.toFixed(2) + '): ' + match.name);
            return match;
          }
          console.log('[Fixer] Name match "' + match.name + '" rejected: number ' +
            varNum + ' != ' + currentValue.value + ' (diff=' + diff.toFixed(2) + ')');
          // Fall through to Phase 2
        } else {
          console.log('[Fixer] Name match: ' + match.name);
          return match;
        }
      } else {
        console.log('[Fixer] Name match: ' + match.name);
        return match;
      }
    }
  }

  // ── Phase 2: Value-first match with context scoring ──
  // Exclude component-scoped variables (component/...) — they are scoped to specific
  // components and should not be used as general-purpose replacement candidates.
  const excludeComponent = (v: Variable): boolean => {
    const collName = index.collectionNames.get(v.variableCollectionId) || '';
    return !isComponentVar(normalizePath(v.name), collName);
  };

  if (currentValue && currentValue.type === 'color') {
    const candidates = index.byResolvedColor.get(currentValue.hex);
    if (candidates && candidates.length > 0) {
      const nonComponent = candidates.filter(v => typeMatches(v, expectedType) && excludeComponent(v));
      if (nonComponent.length > 0) {
        const best = pickBestVariable(nonComponent, index, keywords, tokenPath, tokens);
        console.log('[Fixer] Value match (' + nonComponent.length + ' candidates, component excluded): ' + best.name);
        return best;
      }
      // Fallback: if no non-component candidates, use all typed candidates
      const typed = candidates.filter(v => typeMatches(v, expectedType));
      if (typed.length > 0) {
        const best = pickBestVariable(typed, index, keywords, tokenPath, tokens);
        console.log('[Fixer] Value match (fallback with component, ' + typed.length + ' candidates): ' + best.name);
        return best;
      }
    }
  }

  if (currentValue && currentValue.type === 'number') {
    const candidates = index.byResolvedNumber.get(currentValue.value);
    if (candidates && candidates.length > 0) {
      const nonComponent = candidates.filter(v => typeMatches(v, expectedType) && excludeComponent(v));
      if (nonComponent.length > 0) {
        const best = pickBestVariable(nonComponent, index, keywords, tokenPath, tokens);
        console.log('[Fixer] Number value match (' + nonComponent.length + ' candidates, component excluded): ' + best.name);
        return best;
      }
      // Fallback: if no non-component candidates, use all typed candidates
      const typed = candidates.filter(v => typeMatches(v, expectedType));
      if (typed.length > 0) {
        const best = pickBestVariable(typed, index, keywords, tokenPath, tokens);
        console.log('[Fixer] Number value match (fallback with component, ' + typed.length + ' candidates): ' + best.name);
        return best;
      }
    }

    // Phase 2b: Close number value match (diff ≤ 1)
    // When no exact value match exists, find variables with close values.
    // Scores by token path similarity to prefer the suggested token's variable.
    let bestCloseVar: Variable | null = null;
    let bestCloseDiff = Infinity;
    let bestCloseScore = -Infinity;
    for (const [numVal, vars] of index.byResolvedNumber) {
      const diff = Math.abs(numVal - currentValue.value);
      if (diff > 0 && diff <= 1) {
        const typed = vars.filter(v => typeMatches(v, expectedType) && excludeComponent(v));
        if (typed.length > 0) {
          const best = pickBestVariable(typed, index, keywords, tokenPath, tokens);
          // Score: prefer closer values, then higher context/name score
          const nameScore = normalizePath(best.name) === normalizePath(tokenPath) ? 20 :
            pathEndsWith(normalizePath(tokenPath), normalizePath(best.name)) ? 15 : 0;
          const score = nameScore + contextScore(normalizePath(best.name), keywords) - diff;
          if (score > bestCloseScore || (score === bestCloseScore && diff < bestCloseDiff)) {
            bestCloseVar = best;
            bestCloseDiff = diff;
            bestCloseScore = score;
          }
        }
      }
    }
    if (bestCloseVar) {
      console.log('[Fixer] Close number match (diff=' + bestCloseDiff.toFixed(2) + '): ' + bestCloseVar.name);
      return bestCloseVar;
    }
  }

  // ── Phase 3: Library variable search by name ──
  // When no local variable matches, search team library collections
  // and import a matching variable on demand.
  console.log('[Fixer] Trying library variables for: ' + tokenPath);
  const libraryVar = await findAndImportLibraryVariable(tokenPath, expectedType, tokens);
  if (libraryVar) {
    return libraryVar;
  }

  console.log('[Fixer] No variable found (local: ' + index.byResolvedNumber.size +
    ' number vars, ' + index.byResolvedColor.size + ' color vars): ' + tokenPath);
  return null;
}

/** Try name-based strategies 1-3 for a single path */
function tryNameBasedMatch(
  tokenPath: string,
  index: VariableIndex,
  expectedType: VariableResolvedDataType | undefined,
  context?: { property: string; nodeType: string }
): Variable | null {
  const normalized = normalizePath(tokenPath);

  // Strategy 1: Full path (collection/varName)
  const full = index.byFullPath.get(normalized);
  if (full && typeMatches(full, expectedType)) return full;

  // Strategy 2: Name only
  const nameMatches = index.byName.get(normalized);
  if (nameMatches) {
    const typed = nameMatches.filter(v => typeMatches(v, expectedType));
    if (typed.length === 1) return typed[0];
    if (typed.length > 1) return pickBestFromMultiple(typed, index, context);
  }

  // Strategy 3: Suffix match (variable name = trailing portion of token path, ≥2 segments)
  let bestSuffix: Variable | null = null;
  let bestLen = 0;
  for (const [varName, vars] of index.byName) {
    const segCount = varName.split('/').length;
    if (segCount >= 2 && segCount > bestLen && pathEndsWith(normalized, varName)) {
      const typed = vars.filter(v => typeMatches(v, expectedType));
      if (typed.length > 0) {
        bestSuffix = typed.length === 1 ? typed[0] : pickBestFromMultiple(typed, index, context);
        bestLen = segCount;
      }
    }
  }

  return bestSuffix;
}

/** Pick the best variable when multiple share the same name (across collections) */
function pickBestFromMultiple(
  vars: Variable[],
  index: VariableIndex,
  context?: { property: string; nodeType: string }
): Variable {
  const keywords = context ? getContextKeywords(context.property, context.nodeType) : [];

  // Hard partition: system semantic > core (component variables excluded)
  const system: Variable[] = [];
  const nonComponent: Variable[] = [];
  for (const v of vars) {
    const normalizedName = normalizePath(v.name);
    const collName = index.collectionNames.get(v.variableCollectionId) || '';
    if (isComponentVar(normalizedName, collName)) continue;
    nonComponent.push(v);
    if (isSemanticVar(normalizedName, collName)) system.push(v);
  }
  const pool = system.length > 0 ? system : nonComponent.length > 0 ? nonComponent : vars;
  if (pool.length === 1) return pool[0];

  let best = pool[0];
  let bestScore = -1;

  for (const v of pool) {
    let score = 0;
    score += contextScore(normalizePath(v.name), keywords);
    if (score > bestScore) {
      bestScore = score;
      best = v;
    }
  }

  return best;
}

/**
 * Pick the best variable from value-matched candidates.
 *
 * Hard partition: system semantic variables (system/...) ALWAYS win over core.
 * Component variables (component/...) are excluded — they are scoped to
 * specific components and should not be used as general-purpose replacements.
 *
 * Within the semantic pool, scores by:
 * - +10: context keyword match (text/icon/background/border)
 * - +20: variable name exactly matches the suggested token path
 * - +15: variable name is a suffix of the token path (≥2 segments)
 */
function pickBestVariable(
  candidates: Variable[],
  index: VariableIndex,
  keywords: string[],
  tokenPath: string,
  _tokens: TokenCollection | null | undefined
): Variable {
  if (candidates.length === 1) return candidates[0];

  // Hard partition: system semantic > core (component variables excluded)
  // Three tiers: system/ variables are preferred, then core, never component/
  const system: Variable[] = [];
  const core: Variable[] = [];
  for (const v of candidates) {
    const normalizedName = normalizePath(v.name);
    const collName = index.collectionNames.get(v.variableCollectionId) || '';
    if (isComponentVar(normalizedName, collName)) {
      continue; // Skip component-scoped variables entirely
    }
    if (isSemanticVar(normalizedName, collName)) {
      system.push(v);
    } else {
      core.push(v);
    }
  }
  const pool = system.length > 0 ? system : core;
  if (pool.length === 1) return pool[0];

  // Score within the pool using ONLY the primary token path (not alias chain)
  const normalizedTokenPath = normalizePath(tokenPath);

  let best = pool[0];
  let bestScore = -Infinity;

  for (const v of pool) {
    let score = 0;
    const normalizedName = normalizePath(v.name);
    const collName = index.collectionNames.get(v.variableCollectionId) || '';
    const fullPath = collName ? collName + '/' + normalizedName : normalizedName;

    // Context keyword match (+10) — most important for disambiguation
    score += contextScore(normalizedName, keywords);

    // Token path name similarity (+20 exact, +15 suffix)
    // Only check against the PRIMARY token path — NOT alias chain paths,
    // which point to core tokens and would give core variables a name bonus.
    if (fullPath === normalizedTokenPath || normalizedName === normalizedTokenPath) {
      score += 20;
    } else if (normalizedName.split('/').length >= 2 && pathEndsWith(normalizedTokenPath, normalizedName)) {
      score += 15;
    }

    if (score > bestScore) {
      bestScore = score;
      best = v;
    }
  }

  return best;
}

// ─── Expected Type Mapping ───────────────────────────────────────────────

function getExpectedVariableType(ruleId: LintRuleId): VariableResolvedDataType | undefined {
  switch (ruleId) {
    case 'no-hardcoded-colors':
    case 'no-unknown-styles':
      return 'COLOR';
    case 'no-hardcoded-spacing':
    case 'no-hardcoded-radii':
    case 'no-hardcoded-stroke-weight':
    case 'no-hardcoded-sizing':
    case 'no-hardcoded-typography':
      return 'FLOAT';
    default:
      return undefined;
  }
}

// ─── Property Application ────────────────────────────────────────────────

function colorToString(paint: SolidPaint): string {
  const r = Math.round(paint.color.r * 255);
  const g = Math.round(paint.color.g * 255);
  const b = Math.round(paint.color.b * 255);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

async function applyColorBinding(
  node: SceneNode,
  property: string,
  variable: Variable
): Promise<FixResult> {
  const fillMatch = property.match(/^fills\[(\d+)\]$/);
  const strokeMatch = property.match(/^strokes\[(\d+)\]$/);

  if (fillMatch && 'fills' in node) {
    const idx = parseInt(fillMatch[1], 10);
    const fills = (node as GeometryMixin).fills;
    if (!Array.isArray(fills) || !fills[idx]) {
      return { success: false, message: 'Fill not found at index ' + idx };
    }
    try {
      const paint = fills[idx] as SolidPaint;
      const beforeValue = paint.boundVariables?.color
        ? `var(${paint.boundVariables.color.id})`
        : (paint.type === 'SOLID' ? colorToString(paint) : 'gradient/image');

      const newFills = [...fills] as SolidPaint[];
      newFills[idx] = figma.variables.setBoundVariableForPaint(
        newFills[idx] as SolidPaint, 'color', variable
      );
      (node as GeometryMixin).fills = newFills;

      return { success: true, beforeValue, afterValue: variable.name, actionType: 'rebind' };
    } catch (e) {
      return { success: false, message: 'Fill bind failed: ' + (e instanceof Error ? e.message : String(e)) };
    }
  }

  if (strokeMatch && 'strokes' in node) {
    const idx = parseInt(strokeMatch[1], 10);
    const strokes = (node as GeometryMixin).strokes;
    if (!Array.isArray(strokes) || !strokes[idx]) {
      return { success: false, message: 'Stroke not found at index ' + idx };
    }
    try {
      const paint = strokes[idx] as SolidPaint;
      const beforeValue = paint.boundVariables?.color
        ? `var(${paint.boundVariables.color.id})`
        : (paint.type === 'SOLID' ? colorToString(paint) : 'gradient/image');

      const newStrokes = [...strokes] as SolidPaint[];
      newStrokes[idx] = figma.variables.setBoundVariableForPaint(
        newStrokes[idx] as SolidPaint, 'color', variable
      );
      (node as GeometryMixin).strokes = newStrokes;

      return { success: true, beforeValue, afterValue: variable.name, actionType: 'rebind' };
    } catch (e) {
      return { success: false, message: 'Stroke bind failed: ' + (e instanceof Error ? e.message : String(e)) };
    }
  }

  return { success: false, message: 'Unknown color property: ' + property };
}

function getNumberPropertyValue(node: SceneNode, property: string): string {
  const nodeWithProps = node as unknown as Record<string, unknown>;
  const boundVars = (node as unknown as { boundVariables?: Record<string, { id: string }> }).boundVariables;
  if (boundVars && boundVars[property]) {
    return `var(${boundVars[property].id})`;
  }
  const value = nodeWithProps[property];
  return typeof value === 'number' ? String(value) : 'unknown';
}

async function applyNumberBinding(
  node: SceneNode,
  property: string,
  variable: Variable
): Promise<FixResult> {
  if (!('boundVariables' in node)) {
    return { success: false, message: 'Node does not support variable bindings' };
  }

  const fieldMap: Record<string, VariableBindableNodeField> = {
    itemSpacing: 'itemSpacing',
    counterAxisSpacing: 'counterAxisSpacing',
    paddingTop: 'paddingTop',
    paddingRight: 'paddingRight',
    paddingBottom: 'paddingBottom',
    paddingLeft: 'paddingLeft',
    cornerRadius: 'topLeftRadius',
    topLeftRadius: 'topLeftRadius',
    topRightRadius: 'topRightRadius',
    bottomLeftRadius: 'bottomLeftRadius',
    bottomRightRadius: 'bottomRightRadius',
    strokeWeight: 'strokeWeight',
    strokeTopWeight: 'strokeTopWeight',
    strokeRightWeight: 'strokeRightWeight',
    strokeBottomWeight: 'strokeBottomWeight',
    strokeLeftWeight: 'strokeLeftWeight',
    width: 'width',
    height: 'height',
    minWidth: 'minWidth',
    maxWidth: 'maxWidth',
    minHeight: 'minHeight',
    maxHeight: 'maxHeight',
  };

  const field = fieldMap[property];
  if (!field) {
    return { success: false, message: 'Property is not bindable: ' + property };
  }

  try {
    const beforeValue = getNumberPropertyValue(node, property);
    const bindableNode = node as SceneNode & {
      setBoundVariable: (field: VariableBindableNodeField, variable: Variable) => void;
    };

    if (property === 'cornerRadius' && 'cornerRadius' in node && typeof (node as FrameNode).cornerRadius === 'number') {
      bindableNode.setBoundVariable('topLeftRadius', variable);
      bindableNode.setBoundVariable('topRightRadius', variable);
      bindableNode.setBoundVariable('bottomLeftRadius', variable);
      bindableNode.setBoundVariable('bottomRightRadius', variable);
    } else {
      bindableNode.setBoundVariable(field, variable);
    }

    return { success: true, beforeValue, afterValue: variable.name, actionType: 'rebind' };
  } catch (e) {
    return { success: false, message: 'Number bind failed: ' + (e instanceof Error ? e.message : String(e)) };
  }
}

async function applyTypographyBinding(
  node: SceneNode,
  property: string,
  variable: Variable
): Promise<FixResult> {
  if (node.type !== 'TEXT') {
    return { success: false, message: 'Node is not a text node' };
  }

  if (property === 'paragraphSpacing') {
    try {
      const textNode = node as TextNode;
      const beforeValue = getNumberPropertyValue(textNode, 'paragraphSpacing');
      textNode.setBoundVariable('paragraphSpacing', variable);
      return { success: true, beforeValue, afterValue: variable.name, actionType: 'rebind' };
    } catch (e) {
      return { success: false, message: 'Typography bind failed: ' + (e instanceof Error ? e.message : String(e)) };
    }
  }

  return {
    success: false,
    message: property + ' cannot be bound to variables. Use "Apply Style" with an existing text style instead.',
  };
}

// ─── Detach + Rebind (Unknown Styles) ────────────────────────────────────

/**
 * Detach an unknown fill/stroke style, then immediately bind the underlying
 * paint to the matching token variable. Single-action fix for unknown styles.
 */
async function detachAndRebind(
  node: SceneNode,
  styleProperty: string,
  tokenPath: string,
  index: VariableIndex,
  tokens: TokenCollection | null | undefined
): Promise<FixResult> {
  const paintProperty = styleProperty === 'fillStyle' ? 'fills[0]' : 'strokes[0]';

  // Step 1: Detach the style
  if (styleProperty === 'fillStyle' && 'fillStyleId' in node) {
    (node as GeometryMixin & { fillStyleId: string }).fillStyleId = '';
  } else if (styleProperty === 'strokeStyle' && 'strokeStyleId' in node) {
    (node as GeometryMixin & { strokeStyleId: string }).strokeStyleId = '';
  } else {
    return { success: false, message: 'Node does not support style: ' + styleProperty };
  }

  // Step 2: Read the now-hardcoded color (including paint opacity)
  const currentValue = readCurrentValue(node, paintProperty);
  if (!currentValue || currentValue.type !== 'color') {
    return { success: true, message: 'Style detached (no solid paint to rebind)', actionType: 'detach' };
  }

  // Step 3: Find matching variable
  const variable = await findVariableForToken(
    tokenPath, index, 'COLOR', tokens,
    { property: paintProperty, nodeType: node.type },
    currentValue
  );

  if (!variable) {
    return { success: true, message: 'Style detached (no matching variable found for rebind)', actionType: 'detach' };
  }

  // Step 4: Bind the variable
  console.log('[Fixer] Detach+rebind: binding "' + variable.name + '" -> ' + paintProperty + ' on "' + node.name + '"');
  const bindResult = await applyColorBinding(node, paintProperty, variable);
  if (bindResult.success) {
    return { success: true, beforeValue: 'style', afterValue: variable.name, actionType: 'rebind' };
  }

  // Binding failed but detach succeeded
  return { success: true, message: 'Style detached but rebind failed: ' + bindResult.message, actionType: 'detach' };
}

// ─── Public Fix API ──────────────────────────────────────────────────────

/** Apply a fix to a single violation */
export async function applyFix(
  nodeId: string,
  property: string,
  tokenPath: string,
  ruleId: LintRuleId,
  _themeConfigs: ThemeConfig[],
  tokens?: TokenCollection | null
): Promise<FixResult> {
  console.log('[Fixer] applyFix:', { nodeId, property, tokenPath, ruleId });

  try {
    const node = await figma.getNodeByIdAsync(nodeId);
    if (!node || node.type === 'DOCUMENT' || node.type === 'PAGE') {
      return { success: false, message: 'Node not found: ' + nodeId };
    }

    const sceneNode = node as SceneNode;
    const index = await getVariableIndex();

    // Special handling for no-unknown-styles: detach + rebind for fill/stroke, detach only for text/effect
    if (ruleId === 'no-unknown-styles') {
      if (property === 'fillStyle' || property === 'strokeStyle') {
        return detachAndRebind(sceneNode, property, tokenPath, index, tokens);
      }
      return detachStyle(nodeId, property);
    }

    const expectedType = getExpectedVariableType(ruleId);

    // Read the node's CURRENT visual value — this is what we must preserve
    const currentValue = readCurrentValue(sceneNode, property);

    const variable = await findVariableForToken(
      tokenPath, index, expectedType, tokens,
      { property, nodeType: sceneNode.type },
      currentValue
    );

    if (!variable) {
      return {
        success: false,
        message: 'No Figma variable found for token: ' + tokenPath
          + (currentValue && currentValue.type === 'number'
            ? ' (value: ' + currentValue.value + ')'
            : currentValue && currentValue.type === 'color'
            ? ' (color: ' + currentValue.hex + ')'
            : '')
          + '. Ensure variables are synced via Tokens Studio or available in a team library.',
      };
    }

    console.log('[Fixer] Binding "' + variable.name + '" -> ' + property + ' on "' + sceneNode.name + '"');

    switch (ruleId) {
      case 'no-hardcoded-colors':
        return applyColorBinding(sceneNode, property, variable);

      case 'no-hardcoded-spacing':
      case 'no-hardcoded-radii':
      case 'no-hardcoded-stroke-weight':
      case 'no-hardcoded-sizing':
        return applyNumberBinding(sceneNode, property, variable);

      case 'no-hardcoded-typography':
        return applyTypographyBinding(sceneNode, property, variable);

      case 'no-orphaned-variables':
      case 'prefer-semantic-variables':
        if (variable.resolvedType === 'COLOR') {
          return applyColorBinding(sceneNode, property, variable);
        }
        if (variable.resolvedType === 'FLOAT') {
          if (['fontSize', 'lineHeight', 'letterSpacing', 'paragraphSpacing'].includes(property)) {
            return applyTypographyBinding(sceneNode, property, variable);
          }
          return applyNumberBinding(sceneNode, property, variable);
        }
        return { success: false, message: 'Cannot rebind variable type: ' + variable.resolvedType };

      default:
        return { success: false, message: 'Auto-fix not supported for: ' + ruleId };
    }
  } catch (e) {
    const msg = 'Fix error: ' + (e instanceof Error ? e.message : String(e));
    console.error('[Fixer]', msg);
    return { success: false, message: msg };
  }
}

/** Apply fixes to multiple violations */
export async function applyBulkFix(
  fixes: Array<{
    nodeId: string;
    property: string;
    tokenPath: string;
    ruleId: string;
  }>,
  themeConfigs: ThemeConfig[],
  onProgress?: BulkFixProgressCallback,
  tokens?: TokenCollection | null
): Promise<{ successful: number; failed: number; errors: string[]; actions: FixActionDetail[] }> {
  let successful = 0;
  let failed = 0;
  const errors: string[] = [];
  const actions: FixActionDetail[] = [];

  for (let i = 0; i < fixes.length; i++) {
    const fix = fixes[i];

    let nodeName = 'Unknown';
    try {
      const node = await figma.getNodeByIdAsync(fix.nodeId);
      if (node && 'name' in node) nodeName = node.name;
    } catch { /* ignore */ }

    const result = await applyFix(
      fix.nodeId, fix.property, fix.tokenPath,
      fix.ruleId as LintRuleId, themeConfigs, tokens
    );

    const action: FixActionDetail = {
      nodeId: fix.nodeId,
      nodeName,
      property: fix.property,
      actionType: result.actionType || 'rebind',
      beforeValue: result.beforeValue || 'unknown',
      afterValue: result.afterValue || fix.tokenPath,
      status: result.success ? 'success' : 'failed',
      errorMessage: result.message,
      timestamp: Date.now(),
    };

    actions.push(action);

    if (result.success) {
      successful++;
    } else {
      failed++;
      if (result.message) errors.push(fix.nodeId + ': ' + result.message);
    }

    if (onProgress) {
      onProgress({ current: i + 1, total: fixes.length, currentAction: action });
    }

    // Yield to prevent blocking
    await new Promise(resolve => setTimeout(resolve, 0));
  }

  return { successful, failed, errors, actions };
}

// ─── Unbind / Detach / Style Operations ──────────────────────────────────

function getBoundVariableFromPaint(paint: SolidPaint): string | null {
  return paint.boundVariables?.color?.id || null;
}

/** Unbind a variable from a property (keeps current visual value) */
export async function unbindVariable(
  nodeId: string,
  property: string
): Promise<FixResult> {
  console.log('[Fixer] unbindVariable:', { nodeId, property });

  try {
    const node = await figma.getNodeByIdAsync(nodeId);
    if (!node || node.type === 'DOCUMENT' || node.type === 'PAGE') {
      return { success: false, message: 'Node not found: ' + nodeId };
    }

    const sceneNode = node as SceneNode;
    const fillMatch = property.match(/^fills\[(\d+)\]$/);
    const strokeMatch = property.match(/^strokes\[(\d+)\]$/);

    if (fillMatch && 'fills' in sceneNode) {
      const index = parseInt(fillMatch[1], 10);
      const fills = (sceneNode as GeometryMixin).fills;
      if (Array.isArray(fills) && fills[index]) {
        const paint = fills[index] as SolidPaint;
        const boundVarId = getBoundVariableFromPaint(paint);
        const beforeValue = boundVarId ? `var(${boundVarId})` : colorToString(paint);

        if (paint.type === 'SOLID') {
          const newFills = [...fills];
          newFills[index] = {
            type: 'SOLID',
            color: paint.color,
            opacity: paint.opacity,
            visible: paint.visible,
            blendMode: paint.blendMode,
          };
          (sceneNode as GeometryMixin).fills = newFills;
          return { success: true, beforeValue, afterValue: colorToString(paint), actionType: 'unbind' };
        }
      }
    }

    if (strokeMatch && 'strokes' in sceneNode) {
      const index = parseInt(strokeMatch[1], 10);
      const strokes = (sceneNode as GeometryMixin).strokes;
      if (Array.isArray(strokes) && strokes[index]) {
        const paint = strokes[index] as SolidPaint;
        const boundVarId = getBoundVariableFromPaint(paint);
        const beforeValue = boundVarId ? `var(${boundVarId})` : colorToString(paint);

        if (paint.type === 'SOLID') {
          const newStrokes = [...strokes];
          newStrokes[index] = {
            type: 'SOLID',
            color: paint.color,
            opacity: paint.opacity,
            visible: paint.visible,
            blendMode: paint.blendMode,
          };
          (sceneNode as GeometryMixin).strokes = newStrokes;
          return { success: true, beforeValue, afterValue: colorToString(paint), actionType: 'unbind' };
        }
      }
    }

    if (sceneNode.type === 'TEXT' && property === 'paragraphSpacing') {
      const textNode = sceneNode as TextNode;
      const beforeValue = getNumberPropertyValue(textNode, 'paragraphSpacing');
      const currentValue = String(textNode.paragraphSpacing);
      textNode.setBoundVariable('paragraphSpacing', null);
      return { success: true, beforeValue, afterValue: currentValue, actionType: 'unbind' };
    }

    if ('setBoundVariable' in sceneNode) {
      const bindableNode = sceneNode as SceneNode & {
        setBoundVariable: (field: VariableBindableNodeField, variable: Variable | null) => void;
      };

      const propertyToField: Record<string, VariableBindableNodeField> = {
        itemSpacing: 'itemSpacing',
        counterAxisSpacing: 'counterAxisSpacing',
        paddingTop: 'paddingTop',
        paddingRight: 'paddingRight',
        paddingBottom: 'paddingBottom',
        paddingLeft: 'paddingLeft',
        topLeftRadius: 'topLeftRadius',
        topRightRadius: 'topRightRadius',
        bottomLeftRadius: 'bottomLeftRadius',
        bottomRightRadius: 'bottomRightRadius',
        cornerRadius: 'topLeftRadius',
        strokeWeight: 'strokeWeight',
        strokeTopWeight: 'strokeTopWeight',
        strokeRightWeight: 'strokeRightWeight',
        strokeBottomWeight: 'strokeBottomWeight',
        strokeLeftWeight: 'strokeLeftWeight',
        width: 'width',
        height: 'height',
        minWidth: 'minWidth',
        maxWidth: 'maxWidth',
        minHeight: 'minHeight',
        maxHeight: 'maxHeight',
      };

      const field = propertyToField[property];
      if (field) {
        const beforeValue = getNumberPropertyValue(sceneNode, property);
        const nodeWithProps = sceneNode as unknown as Record<string, unknown>;
        const currentValue = String(nodeWithProps[property] ?? 'unknown');

        if (property === 'cornerRadius') {
          bindableNode.setBoundVariable('topLeftRadius', null);
          bindableNode.setBoundVariable('topRightRadius', null);
          bindableNode.setBoundVariable('bottomLeftRadius', null);
          bindableNode.setBoundVariable('bottomRightRadius', null);
        } else {
          bindableNode.setBoundVariable(field, null);
        }
        return { success: true, beforeValue, afterValue: currentValue, actionType: 'unbind' };
      }
    }

    return { success: false, message: 'Cannot unbind property: ' + property };
  } catch (e) {
    const msg = 'Unbind error: ' + (e instanceof Error ? e.message : String(e));
    console.error('[Fixer]', msg);
    return { success: false, message: msg };
  }
}

/** Detach a style from a node (keeps current visual appearance) */
export async function detachStyle(
  nodeId: string,
  property: string
): Promise<FixResult> {
  console.log('[Fixer] detachStyle:', { nodeId, property });

  try {
    const node = await figma.getNodeByIdAsync(nodeId);
    if (!node || node.type === 'DOCUMENT' || node.type === 'PAGE') {
      return { success: false, message: 'Node not found: ' + nodeId };
    }

    const sceneNode = node as SceneNode;

    switch (property) {
      case 'fillStyle':
        if ('fillStyleId' in sceneNode) {
          const nodeWithStyle = sceneNode as GeometryMixin & { fillStyleId: string };
          const beforeValue = nodeWithStyle.fillStyleId || 'none';
          nodeWithStyle.fillStyleId = '';
          return { success: true, message: 'Fill style detached', beforeValue, afterValue: 'detached', actionType: 'detach' };
        }
        break;

      case 'strokeStyle':
        if ('strokeStyleId' in sceneNode) {
          const nodeWithStyle = sceneNode as GeometryMixin & { strokeStyleId: string };
          const beforeValue = nodeWithStyle.strokeStyleId || 'none';
          nodeWithStyle.strokeStyleId = '';
          return { success: true, message: 'Stroke style detached', beforeValue, afterValue: 'detached', actionType: 'detach' };
        }
        break;

      case 'textStyle':
        if (sceneNode.type === 'TEXT') {
          const textNode = sceneNode as TextNode;
          const rawStyleId = textNode.textStyleId;
          const beforeValue = typeof rawStyleId === 'symbol' ? 'mixed' : (rawStyleId || 'none');
          await textNode.setTextStyleIdAsync('');
          return { success: true, message: 'Text style detached', beforeValue, afterValue: 'detached', actionType: 'detach' };
        }
        break;

      case 'effectStyle':
        if ('effectStyleId' in sceneNode) {
          const nodeWithStyle = sceneNode as BlendMixin & { effectStyleId: string };
          const beforeValue = nodeWithStyle.effectStyleId || 'none';
          nodeWithStyle.effectStyleId = '';
          return { success: true, message: 'Effect style detached', beforeValue, afterValue: 'detached', actionType: 'detach' };
        }
        break;

      default:
        return { success: false, message: 'Unknown style property: ' + property };
    }

    return { success: false, message: 'Node does not support style: ' + property };
  } catch (e) {
    const msg = 'Detach style error: ' + (e instanceof Error ? e.message : String(e));
    console.error('[Fixer]', msg);
    return { success: false, message: msg };
  }
}

/** Bulk detach styles from multiple nodes */
export async function bulkDetachStyles(
  detaches: Array<{ nodeId: string; property: string }>
): Promise<{ successful: number; failed: number; errors: string[] }> {
  let successful = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const detach of detaches) {
    const result = await detachStyle(detach.nodeId, detach.property);
    if (result.success) {
      successful++;
    } else {
      failed++;
      if (result.message) errors.push(detach.nodeId + ': ' + result.message);
    }
    await new Promise(resolve => setTimeout(resolve, 0));
  }

  return { successful, failed, errors };
}

/** Apply a text style to a text node */
export async function applyTextStyle(
  nodeId: string,
  textStyleId: string
): Promise<FixResult> {
  console.log('[Fixer] applyTextStyle:', { nodeId, textStyleId });

  try {
    const node = await figma.getNodeByIdAsync(nodeId);
    if (!node || node.type !== 'TEXT') {
      return { success: false, message: 'Node not found or not a text node: ' + nodeId };
    }

    const textNode = node as TextNode;
    const style = await figma.getStyleByIdAsync(textStyleId);
    if (!style || style.type !== 'TEXT') {
      return { success: false, message: 'Text style not found: ' + textStyleId };
    }

    const rawStyleId = textNode.textStyleId;
    const beforeValue = typeof rawStyleId === 'symbol' ? 'mixed styles' : (rawStyleId || 'no style');

    await textNode.setTextStyleIdAsync(textStyleId);

    return { success: true, beforeValue, afterValue: style.name, actionType: 'apply-style' };
  } catch (e) {
    const msg = 'Apply text style error: ' + (e instanceof Error ? e.message : String(e));
    console.error('[Fixer]', msg);
    return { success: false, message: msg };
  }
}
