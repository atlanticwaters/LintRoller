/**
 * Variable Remapper
 *
 * Scans for two kinds of bad bindings:
 *
 * 1. **Broken** — the variable ID doesn't resolve at all (deleted variable).
 *    Match replacement by reading the node's current visual value.
 *
 * 2. **Stale** — the variable ID still resolves (from Figma's old library cache)
 *    but the variable is NOT local, and a local variable with the SAME NAME exists
 *    under a different ID. This happens after library re-import / Tokens Studio re-sync.
 *    Figma shows the ⊘ icon for these in the Selection Colors panel.
 *
 * For stale bindings, the fix is simple: rebind to the local variable with matching name.
 * For broken bindings, we fall back to value-based matching (same as before).
 */

import type { RemapEntry, RemapScanResult, RemapApplyResult, ScanScope } from '../shared/types';
import { normalizePath } from '../shared/path-utils';
import { rgbToHex } from './inspector';
import {
  getVariableIndex,
  isSemanticVar,
  contextScore,
  getContextKeywords,
  applyColorBinding,
  applyNumberBinding,
  type VariableIndex,
} from './fixer';

// ─── Bindable Property Lists ─────────────────────────────────────────────

const NUMBER_PROPERTIES = [
  'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
  'itemSpacing', 'counterAxisSpacing',
  'cornerRadius', 'topLeftRadius', 'topRightRadius',
  'bottomLeftRadius', 'bottomRightRadius',
  'strokeWeight', 'strokeTopWeight', 'strokeRightWeight',
  'strokeBottomWeight', 'strokeLeftWeight',
  'width', 'height', 'minWidth', 'maxWidth', 'minHeight', 'maxHeight',
  'fontSize', 'lineHeight', 'letterSpacing', 'paragraphSpacing',
];

// ─── Binding Extraction ──────────────────────────────────────────────────

interface FoundBinding {
  nodeId: string;
  nodeName: string;
  nodeType: string;
  property: string;
  variableId: string;
}

/**
 * Extract all variable binding IDs from a single node.
 */
function extractBindings(node: SceneNode): FoundBinding[] {
  const bindings: FoundBinding[] = [];
  const nodeId = node.id;
  const nodeName = node.name;
  const nodeType = node.type;

  // Paint bindings (fills)
  if ('fills' in node) {
    const fills = (node as GeometryMixin).fills;
    if (Array.isArray(fills)) {
      for (let i = 0; i < fills.length; i++) {
        const paint = fills[i] as unknown as { boundVariables?: { color?: { id: string } } };
        const id = paint.boundVariables?.color?.id;
        if (id) {
          bindings.push({ nodeId, nodeName, nodeType, property: `fills[${i}]`, variableId: id });
        }
      }
    }
  }

  // Paint bindings (strokes)
  if ('strokes' in node) {
    const strokes = (node as GeometryMixin).strokes;
    if (Array.isArray(strokes)) {
      for (let i = 0; i < strokes.length; i++) {
        const paint = strokes[i] as unknown as { boundVariables?: { color?: { id: string } } };
        const id = paint.boundVariables?.color?.id;
        if (id) {
          bindings.push({ nodeId, nodeName, nodeType, property: `strokes[${i}]`, variableId: id });
        }
      }
    }
  }

  // Number property bindings
  const boundVars = (node.boundVariables as Record<string, { id: string } | undefined>) || {};
  for (const prop of NUMBER_PROPERTIES) {
    const binding = boundVars[prop];
    if (binding?.id) {
      bindings.push({ nodeId, nodeName, nodeType, property: prop, variableId: binding.id });
    }
  }

  return bindings;
}

// ─── Value Reading ───────────────────────────────────────────────────────

function readColorValue(node: SceneNode, property: string): string | null {
  const fillMatch = property.match(/^fills\[(\d+)\]$/);
  if (fillMatch && 'fills' in node) {
    const idx = parseInt(fillMatch[1], 10);
    const fills = (node as GeometryMixin).fills;
    if (Array.isArray(fills) && fills[idx] && fills[idx].type === 'SOLID') {
      const paint = fills[idx] as SolidPaint;
      const paintOpacity = paint.opacity ?? 1;
      return rgbToHex({ ...paint.color, a: paintOpacity });
    }
  }

  const strokeMatch = property.match(/^strokes\[(\d+)\]$/);
  if (strokeMatch && 'strokes' in node) {
    const idx = parseInt(strokeMatch[1], 10);
    const strokes = (node as GeometryMixin).strokes;
    if (Array.isArray(strokes) && strokes[idx] && strokes[idx].type === 'SOLID') {
      const paint = strokes[idx] as SolidPaint;
      const paintOpacity = paint.opacity ?? 1;
      return rgbToHex({ ...paint.color, a: paintOpacity });
    }
  }

  return null;
}

function readNumberValue(node: SceneNode, property: string): number | null {
  const val = (node as unknown as Record<string, unknown>)[property];
  return typeof val === 'number' ? val : null;
}

// ─── Suggestion Matching (value-based, for broken bindings) ──────────────

function suggestColorReplacement(
  hex: string,
  property: string,
  nodeType: string,
  index: VariableIndex,
  preferredCollection?: string
): RemapEntry['suggestedVariable'] | undefined {
  const candidates = index.byResolvedColor.get(hex);
  if (!candidates || candidates.length === 0) {
    console.log('[Remapper]   No color candidates for hex=' + hex);
    return undefined;
  }

  console.log('[Remapper]   Color candidates for ' + hex + ': ' +
    candidates.map(v => v.name + ' (id=' + v.id + ')').join(', '));

  // If we know the old collection, prefer candidates from the same collection
  let filtered = candidates;
  if (preferredCollection) {
    const sameCollection = candidates.filter(v => {
      const cName = index.collectionNames.get(v.variableCollectionId) || '';
      return cName === preferredCollection;
    });
    if (sameCollection.length > 0) {
      filtered = sameCollection;
      console.log('[Remapper]   Filtered to same collection "' + preferredCollection + '": ' +
        sameCollection.map(v => v.name).join(', '));
    } else {
      console.log('[Remapper]   No same-collection candidates for "' + preferredCollection + '", using all');
    }
  }

  const keywords = getContextKeywords(property, nodeType);

  const semantic: Variable[] = [];
  const core: Variable[] = [];
  for (const v of filtered) {
    const normalizedName = normalizePath(v.name);
    const collName = index.collectionNames.get(v.variableCollectionId) || '';
    if (isSemanticVar(normalizedName, collName)) {
      semantic.push(v);
    } else {
      core.push(v);
    }
  }
  const pool = semantic.length > 0 ? semantic : core;

  let best = pool[0];
  let bestScore = -Infinity;
  for (const v of pool) {
    const score = contextScore(normalizePath(v.name), keywords);
    if (score > bestScore) {
      bestScore = score;
      best = v;
    }
  }

  const collName = index.collectionNames.get(best.variableCollectionId) || '';
  return {
    id: best.id,
    name: best.name,
    collection: collName,
    matchMethod: 'value',
    confidence: semantic.length > 0 ? 'high' : 'medium',
  };
}

function suggestNumberReplacement(
  value: number,
  property: string,
  nodeType: string,
  index: VariableIndex,
  preferredCollection?: string
): RemapEntry['suggestedVariable'] | undefined {
  const candidates = index.byResolvedNumber.get(value);
  if (!candidates || candidates.length === 0) return undefined;

  // If we know the old collection, prefer candidates from the same collection
  let filtered = candidates;
  if (preferredCollection) {
    const sameCollection = candidates.filter(v => {
      const cName = index.collectionNames.get(v.variableCollectionId) || '';
      return cName === preferredCollection;
    });
    if (sameCollection.length > 0) {
      filtered = sameCollection;
    }
  }

  const keywords = getContextKeywords(property, nodeType);

  const semantic: Variable[] = [];
  const core: Variable[] = [];
  for (const v of filtered) {
    const normalizedName = normalizePath(v.name);
    const collName = index.collectionNames.get(v.variableCollectionId) || '';
    if (isSemanticVar(normalizedName, collName)) {
      semantic.push(v);
    } else {
      core.push(v);
    }
  }
  const pool = semantic.length > 0 ? semantic : core;

  let best = pool[0];
  let bestScore = -Infinity;
  for (const v of pool) {
    const score = contextScore(normalizePath(v.name), keywords);
    if (score > bestScore) {
      bestScore = score;
      best = v;
    }
  }

  const collName = index.collectionNames.get(best.variableCollectionId) || '';
  return {
    id: best.id,
    name: best.name,
    collection: collName,
    matchMethod: 'value',
    confidence: semantic.length > 0 ? 'high' : 'medium',
  };
}

// ─── Public API ──────────────────────────────────────────────────────────

/**
 * Scan for broken AND stale variable bindings across the document.
 */
export async function scanForBrokenBindings(
  scope: ScanScope,
  onProgress?: (processed: number, total: number) => void
): Promise<RemapScanResult> {
  // 1. Build local-variable lookup: id → Variable, and name → Variable[]
  const localVars = await figma.variables.getLocalVariablesAsync();
  const localById = new Map<string, Variable>();
  const localByName = new Map<string, Variable[]>();

  // Also build local collection name lookup
  const localCollections = await figma.variables.getLocalVariableCollectionsAsync();
  const localCollNameById = new Map<string, string>();
  for (const coll of localCollections) {
    localCollNameById.set(coll.id, coll.name);
  }

  for (const v of localVars) {
    localById.set(v.id, v);
    // Index by normalized name — multiple vars may share a name across collections
    const normalizedName = normalizePath(v.name);
    const existing = localByName.get(normalizedName);
    if (existing) {
      existing.push(v);
    } else {
      localByName.set(normalizedName, [v]);
    }
  }

  console.log('[Remapper] ══════════════════════════════════════════════');
  console.log('[Remapper] Local variables: ' + localVars.length +
    ' (indexed ' + localByName.size + ' unique names, ' +
    localCollections.length + ' collections)');

  // 2. Gather all nodes
  const nodes: SceneNode[] = [];
  if (scope.type === 'selection') {
    flattenAll(figma.currentPage.selection as SceneNode[], nodes);
  } else if (scope.type === 'current_page') {
    flattenAll(figma.currentPage.children as SceneNode[], nodes);
  } else {
    await figma.loadAllPagesAsync();
    for (const page of figma.root.children) {
      flattenAll(page.children as SceneNode[], nodes);
    }
  }

  console.log('[Remapper] Scanning ' + nodes.length + ' nodes (scope=' + scope.type + ')');

  // 3. Extract all bindings and classify into: valid, stale, or broken
  let totalBindings = 0;
  let validBindings = 0;
  let brokenBindings = 0;
  let staleBindings = 0;

  // Group stale/broken bindings by old variable ID
  const problemByVarId = new Map<string, {
    kind: 'stale' | 'broken';
    oldVarName?: string;
    oldCollectionName?: string;
    bindings: FoundBinding[];
  }>();

  let logged = 0;

  for (let i = 0; i < nodes.length; i++) {
    const bindings = extractBindings(nodes[i]);

    for (const b of bindings) {
      totalBindings++;

      // Fast path: binding points to a local variable → healthy
      if (localById.has(b.variableId)) {
        validBindings++;
        continue;
      }

      // Slow path: try async resolve (library/cached variable)
      let resolvedVar: Variable | null = null;
      try {
        resolvedVar = await figma.variables.getVariableByIdAsync(b.variableId);
      } catch {
        // Variable truly doesn't exist
      }

      if (resolvedVar) {
        // The variable resolves — but is it stale?
        // Stale = a LOCAL variable with the SAME NAME exists but has a DIFFERENT ID.
        const normalizedName = normalizePath(resolvedVar.name);
        const localCandidates = localByName.get(normalizedName);
        // Find a local var with same name AND different ID
        const localMatch = localCandidates?.find(v => v.id !== b.variableId);

        if (localMatch) {
          // STALE: binding → old cached var, but local var with same name exists
          staleBindings++;

          // Resolve the old variable's collection name for collection-aware matching
          let oldCollName = '';
          try {
            const oldColl = await figma.variables.getVariableCollectionByIdAsync(resolvedVar.variableCollectionId);
            if (oldColl) oldCollName = oldColl.name;
          } catch { /* cache miss — ignore */ }

          if (logged < 30) {
            const matchCollName = localCollNameById.get(localMatch.variableCollectionId) || '?';
            console.log('[Remapper] STALE: node="' + b.nodeName + '" prop=' + b.property +
              ' boundTo="' + resolvedVar.name + '" (id=' + b.variableId +
              ', coll="' + oldCollName + '")' +
              ' → local replacement: "' + localMatch.name + '" (id=' + localMatch.id +
              ', coll="' + matchCollName + '")');
            logged++;
          }

          const existing = problemByVarId.get(b.variableId);
          if (existing) {
            existing.bindings.push(b);
          } else {
            problemByVarId.set(b.variableId, {
              kind: 'stale',
              oldVarName: resolvedVar.name,
              oldCollectionName: oldCollName,
              bindings: [b],
            });
          }
        } else {
          // Healthy library variable (no local replacement needed)
          validBindings++;
        }
      } else {
        // BROKEN: variable ID doesn't resolve at all
        brokenBindings++;

        if (logged < 30) {
          console.log('[Remapper] BROKEN: node="' + b.nodeName + '" prop=' + b.property +
            ' varId=' + b.variableId + ' → no variable found');
          logged++;
        }

        const existing = problemByVarId.get(b.variableId);
        if (existing) {
          existing.bindings.push(b);
        } else {
          problemByVarId.set(b.variableId, {
            kind: 'broken',
            bindings: [b],
          });
        }
      }
    }

    if (onProgress && (i % 100 === 0 || i === nodes.length - 1)) {
      onProgress(i + 1, nodes.length);
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }

  console.log('[Remapper] ──────────────────────────────────────────────');
  console.log('[Remapper] Scan summary: ' + totalBindings + ' total bindings');
  console.log('[Remapper]   ' + validBindings + ' valid (local or healthy library)');
  console.log('[Remapper]   ' + staleBindings + ' stale (old library ID, local replacement exists)');
  console.log('[Remapper]   ' + brokenBindings + ' broken (variable ID gone)');
  console.log('[Remapper]   ' + problemByVarId.size + ' unique variable IDs to remap');

  // 4. Build RemapEntry for each problem variable
  const index = await getVariableIndex();
  const remapEntries: RemapEntry[] = [];

  for (const [oldVarId, problem] of problemByVarId) {
    const rep = problem.bindings[0];

    console.log('[Remapper] ── ' + problem.kind.toUpperCase() + ': oldId=' + oldVarId +
      (problem.oldVarName ? ' name="' + problem.oldVarName + '"' : '') +
      ' (' + problem.bindings.length + ' usages)');

    const entry: RemapEntry = {
      oldVariableId: oldVarId,
      oldVariableName: problem.oldVarName,
      kind: problem.kind,
      usageCount: problem.bindings.length,
      confirmed: false,
      propertyHint: rep.property,
      nodeTypeHint: rep.nodeType,
    };

    if (problem.kind === 'stale' && problem.oldVarName) {
      // For stale bindings: match by name + same collection — high confidence
      const normalizedName = normalizePath(problem.oldVarName);
      const candidates = localByName.get(normalizedName);

      if (candidates && candidates.length > 0) {
        // Prefer the candidate whose collection name matches the old collection
        let bestMatch = candidates[0];
        if (candidates.length > 1 && problem.oldCollectionName) {
          const sameCollMatch = candidates.find(v => {
            const cName = localCollNameById.get(v.variableCollectionId) || '';
            return cName === problem.oldCollectionName;
          });
          if (sameCollMatch) {
            bestMatch = sameCollMatch;
          } else {
            console.log('[Remapper]   WARNING: no same-collection match for "' +
              problem.oldVarName + '" in coll="' + problem.oldCollectionName +
              '", using first candidate from coll="' +
              (localCollNameById.get(candidates[0].variableCollectionId) || '?') + '"');
          }
        }

        const collName = localCollNameById.get(bestMatch.variableCollectionId) || '';
        entry.suggestedVariable = {
          id: bestMatch.id,
          name: bestMatch.name,
          collection: collName,
          matchMethod: 'name',
          confidence: 'high',
        };
        console.log('[Remapper]   SUGGESTION (name+collection match): "' + bestMatch.name +
          '" (id=' + bestMatch.id + ', coll=' + collName +
          ', oldColl=' + (problem.oldCollectionName || '?') + ')');
      }
    } else {
      // For broken bindings: match by visual value (pass collection hint if available)
      const node = await figma.getNodeByIdAsync(rep.nodeId);
      if (node && node.type !== 'DOCUMENT' && node.type !== 'PAGE') {
        const sceneNode = node as SceneNode;
        const isColor = rep.property.startsWith('fills[') || rep.property.startsWith('strokes[');
        const prefColl = problem.oldCollectionName;

        if (isColor) {
          const hex = readColorValue(sceneNode, rep.property);
          console.log('[Remapper]   Read color: ' + (hex ?? 'null'));
          if (hex) {
            entry.currentValue = hex;
            entry.suggestedVariable = suggestColorReplacement(hex, rep.property, rep.nodeType, index, prefColl);
          }
        } else {
          const num = readNumberValue(sceneNode, rep.property);
          console.log('[Remapper]   Read number: ' + (num !== null ? num : 'null'));
          if (num !== null) {
            entry.currentValue = String(num);
            entry.suggestedVariable = suggestNumberReplacement(num, rep.property, rep.nodeType, index, prefColl);
          }
        }
      }
    }

    if (!entry.suggestedVariable) {
      console.log('[Remapper]   NO SUGGESTION found');
    }

    remapEntries.push(entry);
  }

  remapEntries.sort((a, b) => b.usageCount - a.usageCount);

  console.log('[Remapper] ══════════════════════════════════════════════');
  console.log('[Remapper] Final: ' + remapEntries.length + ' remap entries (' +
    remapEntries.filter(e => e.kind === 'stale').length + ' stale, ' +
    remapEntries.filter(e => e.kind === 'broken').length + ' broken), ' +
    remapEntries.filter(e => e.suggestedVariable).length + ' with suggestions');

  return { totalBindings, validBindings, brokenBindings, staleBindings, remapEntries };
}

/**
 * Apply remap operations: rebind stale/broken variables to new ones.
 */
export async function applyRemaps(
  remaps: Array<{ oldVariableId: string; newVariableId: string }>,
  onProgress?: (current: number, total: number) => void
): Promise<RemapApplyResult> {
  let remapped = 0;
  let failed = 0;
  const errors: string[] = [];

  console.log('[Remapper] ══════════════════════════════════════════════');
  console.log('[Remapper] Applying ' + remaps.length + ' remap(s):');
  for (const r of remaps) {
    console.log('[Remapper]   oldId=' + r.oldVariableId + ' → newId=' + r.newVariableId);
  }

  // Build a lookup of old → new variable
  const remapMap = new Map<string, string>();
  for (const r of remaps) {
    remapMap.set(r.oldVariableId, r.newVariableId);
  }

  // Resolve all new variables upfront
  const newVarById = new Map<string, Variable>();
  for (const newId of new Set(remapMap.values())) {
    try {
      const v = await figma.variables.getVariableByIdAsync(newId);
      if (v) {
        newVarById.set(newId, v);
        console.log('[Remapper]   Resolved new var: id=' + newId + ' → "' + v.name + '" type=' + v.resolvedType);
      } else {
        errors.push('Failed to resolve new variable: ' + newId);
      }
    } catch (e) {
      errors.push('Failed to resolve new variable: ' + newId + ': ' + (e instanceof Error ? e.message : String(e)));
    }
  }

  // Scan all nodes to find bindings referencing old IDs
  const nodes: SceneNode[] = [];
  await figma.loadAllPagesAsync();
  for (const page of figma.root.children) {
    flattenAll(page.children as SceneNode[], nodes);
  }

  console.log('[Remapper] Scanning ' + nodes.length + ' nodes to apply remaps');

  let processed = 0;
  const totalNodes = nodes.length;

  for (let i = 0; i < totalNodes; i++) {
    const node = nodes[i];
    const bindings = extractBindings(node);

    for (const b of bindings) {
      const newVarId = remapMap.get(b.variableId);
      if (!newVarId) continue;

      const newVar = newVarById.get(newVarId);
      if (!newVar) {
        failed++;
        errors.push(b.nodeName + '.' + b.property + ': new variable not resolved');
        continue;
      }

      console.log('[Remapper]   REBIND: node="' + b.nodeName + '" prop=' + b.property +
        ' oldId=' + b.variableId + ' → "' + newVar.name + '" (id=' + newVar.id + ')');

      try {
        const isColor = b.property.startsWith('fills[') || b.property.startsWith('strokes[');
        if (isColor) {
          const result = await applyColorBinding(node, b.property, newVar);
          if (result.success) {
            remapped++;
          } else {
            failed++;
            errors.push(b.nodeName + '.' + b.property + ': ' + result.message);
            console.log('[Remapper]     Failed: ' + result.message);
          }
        } else {
          const result = await applyNumberBinding(node, b.property, newVar);
          if (result.success) {
            remapped++;
          } else {
            failed++;
            errors.push(b.nodeName + '.' + b.property + ': ' + result.message);
            console.log('[Remapper]     Failed: ' + result.message);
          }
        }
      } catch (e) {
        failed++;
        errors.push(b.nodeName + '.' + b.property + ': ' + (e instanceof Error ? e.message : String(e)));
      }
    }

    processed++;
    if (onProgress && (processed % 50 === 0 || processed === totalNodes)) {
      onProgress(processed, totalNodes);
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }

  console.log('[Remapper] ══════════════════════════════════════════════');
  console.log('[Remapper] Remap complete: ' + remapped + ' remapped, ' + failed + ' failed');
  return { remapped, failed, errors };
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function flattenAll(roots: readonly SceneNode[], out: SceneNode[]): void {
  for (const node of roots) {
    out.push(node);
    if ('children' in node) {
      flattenAll(node.children as SceneNode[], out);
    }
  }
}
