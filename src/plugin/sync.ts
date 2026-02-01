/**
 * Token → Figma Variable Sync Module
 *
 * Creates and updates Figma Variable Collections and Variables
 * from DTCG token files.
 */

import type { TokenCollection, ResolvedToken, ThemeConfig } from '../shared/types';

/**
 * Options for sync operation
 */
export interface SyncOptions {
  /** Whether to create new variables (default: true) */
  createNew: boolean;
  /** Whether to update existing variables (default: true) */
  updateExisting: boolean;
  /** Whether to delete orphaned variables not in token source (default: false) */
  deleteOrphans: boolean;
  /** Collection name mapping override */
  collectionNames?: {
    core?: string;
    semantic?: string;
    component?: string;
  };
}

/**
 * Result of a sync operation
 */
export interface SyncResult {
  success: boolean;
  created: number;
  updated: number;
  deleted: number;
  skipped: number;
  errors: string[];
  collections: CollectionSyncResult[];
}

/**
 * Result for a single collection
 */
export interface CollectionSyncResult {
  collectionId: string;
  collectionName: string;
  layer: 'core' | 'semantic' | 'component';
  variablesCreated: number;
  variablesUpdated: number;
  variablesDeleted: number;
}

/**
 * Diff between current Figma state and token source
 */
export interface SyncDiff {
  toCreate: Array<{ path: string; layer: string; value: string | number }>;
  toUpdate: Array<{ path: string; layer: string; oldValue: string | number; newValue: string | number }>;
  toDelete: Array<{ path: string; layer: string; variableId: string }>;
  unchanged: number;
}

/**
 * Progress callback for sync operations
 */
export type SyncProgressCallback = (progress: {
  phase: 'analyzing' | 'creating' | 'updating' | 'deleting' | 'complete';
  current: number;
  total: number;
  message: string;
}) => void;

/**
 * Determine which layer a token belongs to based on its source file
 */
function getTokenLayer(token: ResolvedToken): 'core' | 'semantic' | 'component' {
  const sourceFile = token.sourceFile.toLowerCase();
  if (sourceFile.includes('core') || sourceFile.includes('primitives')) {
    return 'core';
  }
  if (sourceFile.includes('semantic')) {
    return 'semantic';
  }
  if (sourceFile.includes('component')) {
    return 'component';
  }
  // Default based on path
  if (token.path.startsWith('system.') || token.path.startsWith('core.')) {
    return 'core';
  }
  if (token.path.startsWith('component.')) {
    return 'component';
  }
  return 'semantic';
}

/**
 * Convert token path to Figma variable name
 * Figma uses "/" as separator, tokens use "."
 */
function tokenPathToVariableName(tokenPath: string): string {
  return tokenPath.replace(/\./g, '/');
}

/**
 * Convert Figma variable name to token path
 */
function variableNameToTokenPath(variableName: string): string {
  return variableName.replace(/\//g, '.');
}

/**
 * Get the Figma variable type for a token type
 */
function getVariableType(token: ResolvedToken): VariableResolvedDataType {
  switch (token.type) {
    case 'color':
      return 'COLOR';
    case 'number':
    case 'dimension':
      return 'FLOAT';
    default:
      // For typography and other complex types, we'd need STRING
      // but Figma doesn't support string variables for all use cases
      return 'FLOAT';
  }
}

/**
 * Parse a hex color string to Figma RGB
 */
function hexToFigmaRGB(hex: string): RGB {
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255;
  return { r, g, b };
}

/**
 * Parse a dimension value to a number
 */
function parseDimension(value: string | number): number {
  if (typeof value === 'number') {
    return value;
  }
  // Remove units (px, rem, em, etc.)
  const numericValue = parseFloat(value.replace(/[^0-9.-]/g, ''));
  return isNaN(numericValue) ? 0 : numericValue;
}

/**
 * Convert a resolved token value to a Figma variable value
 */
function tokenValueToFigmaValue(token: ResolvedToken): VariableValue | null {
  const value = token.resolvedValue;

  switch (token.type) {
    case 'color':
      if (typeof value === 'string' && value.startsWith('#')) {
        return hexToFigmaRGB(value);
      }
      return null;

    case 'number':
      if (typeof value === 'number') {
        return value;
      }
      if (typeof value === 'string') {
        const num = parseFloat(value);
        return isNaN(num) ? null : num;
      }
      return null;

    case 'dimension':
      return parseDimension(value);

    default:
      // For unsupported types, try to parse as number
      if (typeof value === 'number') {
        return value;
      }
      if (typeof value === 'string') {
        const num = parseFloat(value);
        if (!isNaN(num)) {
          return num;
        }
      }
      return null;
  }
}

/**
 * Get or create a Variable Collection
 */
async function getOrCreateCollection(
  name: string,
  modes: string[]
): Promise<VariableCollection> {
  const collections = await figma.variables.getLocalVariableCollectionsAsync();

  // Look for existing collection by name
  let collection = collections.find(c => c.name === name);

  if (!collection) {
    // Create new collection
    collection = figma.variables.createVariableCollection(name);
    console.log(`[Sync] Created collection: ${name}`);
  }

  // Ensure all modes exist
  const existingModeNames = collection.modes.map(m => m.name);
  for (const modeName of modes) {
    if (!existingModeNames.includes(modeName)) {
      // Add mode if it doesn't exist
      // Note: First mode is created with collection, can't rename via API easily
      if (collection.modes.length === 1 && collection.modes[0].name === 'Mode 1') {
        // Rename the default mode
        collection.renameMode(collection.modes[0].modeId, modeName);
        console.log(`[Sync] Renamed default mode to: ${modeName}`);
      } else {
        collection.addMode(modeName);
        console.log(`[Sync] Added mode: ${modeName}`);
      }
    }
  }

  return collection;
}

/**
 * Find existing variable by name in a collection
 */
async function findVariableByName(
  collection: VariableCollection,
  name: string
): Promise<Variable | null> {
  for (const varId of collection.variableIds) {
    try {
      const variable = await figma.variables.getVariableByIdAsync(varId);
      if (variable && variable.name === name) {
        return variable;
      }
    } catch {
      // Variable may have been deleted
    }
  }
  return null;
}

/**
 * Get mode values for a token based on theme configuration
 */
function getModeValues(
  token: ResolvedToken,
  tokens: TokenCollection,
  themes: ThemeConfig[],
  collection: VariableCollection
): Map<string, VariableValue> {
  const modeValues = new Map<string, VariableValue>();

  // Get the base value
  const baseValue = tokenValueToFigmaValue(token);
  if (baseValue === null) {
    return modeValues;
  }

  // For semantic tokens, we need to look up the value for each theme/mode
  const layer = getTokenLayer(token);

  if (layer === 'semantic') {
    // Look for light and dark variants
    for (const mode of collection.modes) {
      const modeName = mode.name.toLowerCase();

      // Try to find a mode-specific token
      // Pattern: check if there's a token with same path in a mode-specific file
      let modeValue = baseValue;

      // Check themes to see which token sets are enabled for this mode
      const matchingTheme = themes.find(t =>
        t.name.toLowerCase().includes(modeName) ||
        (t.group && t.group.toLowerCase().includes(modeName))
      );

      if (matchingTheme) {
        // The theme tells us which token sets to use for this mode
        // For now, use the base resolved value
        // In a full implementation, we'd re-resolve based on theme's selectedTokenSets
      }

      modeValues.set(mode.modeId, modeValue);
    }
  } else {
    // Core and component tokens typically have the same value across modes
    for (const mode of collection.modes) {
      modeValues.set(mode.modeId, baseValue);
    }
  }

  return modeValues;
}

/**
 * Check if two Figma values are equal
 */
function valuesEqual(a: VariableValue, b: VariableValue): boolean {
  if (typeof a === 'number' && typeof b === 'number') {
    return Math.abs(a - b) < 0.0001;
  }
  if (typeof a === 'object' && typeof b === 'object' && a !== null && b !== null) {
    // Compare RGB colors
    const aRGB = a as RGB;
    const bRGB = b as RGB;
    return (
      Math.abs(aRGB.r - bRGB.r) < 0.0001 &&
      Math.abs(aRGB.g - bRGB.g) < 0.0001 &&
      Math.abs(aRGB.b - bRGB.b) < 0.0001
    );
  }
  return a === b;
}

/**
 * Analyze differences between token source and Figma variables
 */
export async function analyzeSyncDiff(
  tokens: TokenCollection,
  themes: ThemeConfig[],
  options: Partial<SyncOptions> = {}
): Promise<SyncDiff> {
  const diff: SyncDiff = {
    toCreate: [],
    toUpdate: [],
    toDelete: [],
    unchanged: 0,
  };

  const collectionNames = {
    core: options.collectionNames?.core || 'Core',
    semantic: options.collectionNames?.semantic || 'Semantic',
    component: options.collectionNames?.component || 'Component',
  };

  // Get existing collections
  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  const collectionsByName = new Map<string, VariableCollection>();
  for (const col of collections) {
    collectionsByName.set(col.name, col);
  }

  // Track which variable IDs we've seen
  const seenVariableIds = new Set<string>();

  // Analyze each token
  for (const [tokenPath, token] of tokens.tokens) {
    // Skip tokens we can't convert to Figma variables
    const figmaValue = tokenValueToFigmaValue(token);
    if (figmaValue === null) {
      continue;
    }

    const layer = getTokenLayer(token);
    const collectionName = collectionNames[layer];
    const variableName = tokenPathToVariableName(tokenPath);

    const collection = collectionsByName.get(collectionName);
    if (!collection) {
      // Collection doesn't exist, token needs to be created
      diff.toCreate.push({
        path: tokenPath,
        layer,
        value: token.resolvedValue,
      });
      continue;
    }

    // Look for existing variable
    const existingVariable = await findVariableByName(collection, variableName);
    if (!existingVariable) {
      // Variable doesn't exist, needs to be created
      diff.toCreate.push({
        path: tokenPath,
        layer,
        value: token.resolvedValue,
      });
      continue;
    }

    seenVariableIds.add(existingVariable.id);

    // Check if value needs updating
    const modeId = collection.modes[0].modeId;
    const currentValue = existingVariable.valuesByMode[modeId];

    if (!valuesEqual(currentValue, figmaValue)) {
      diff.toUpdate.push({
        path: tokenPath,
        layer,
        oldValue: typeof currentValue === 'object' ? JSON.stringify(currentValue) : currentValue,
        newValue: token.resolvedValue,
      });
    } else {
      diff.unchanged++;
    }
  }

  // Check for orphaned variables (if deleteOrphans is considered)
  if (options.deleteOrphans) {
    for (const [name, collection] of collectionsByName) {
      // Only check our managed collections
      if (!Object.values(collectionNames).includes(name)) {
        continue;
      }

      const layer = Object.entries(collectionNames).find(([, v]) => v === name)?.[0] as 'core' | 'semantic' | 'component' | undefined;
      if (!layer) continue;

      for (const varId of collection.variableIds) {
        if (!seenVariableIds.has(varId)) {
          const variable = await figma.variables.getVariableByIdAsync(varId);
          if (variable) {
            diff.toDelete.push({
              path: variableNameToTokenPath(variable.name),
              layer,
              variableId: varId,
            });
          }
        }
      }
    }
  }

  return diff;
}

/**
 * Sync all tokens to Figma variables
 */
export async function syncTokensToVariables(
  tokens: TokenCollection,
  themes: ThemeConfig[],
  options: Partial<SyncOptions> = {},
  onProgress?: SyncProgressCallback
): Promise<SyncResult> {
  const opts: SyncOptions = {
    createNew: options.createNew ?? true,
    updateExisting: options.updateExisting ?? true,
    deleteOrphans: options.deleteOrphans ?? false,
    collectionNames: {
      core: options.collectionNames?.core || 'Core',
      semantic: options.collectionNames?.semantic || 'Semantic',
      component: options.collectionNames?.component || 'Component',
    },
  };

  const result: SyncResult = {
    success: true,
    created: 0,
    updated: 0,
    deleted: 0,
    skipped: 0,
    errors: [],
    collections: [],
  };

  try {
    // Determine modes from themes
    const modeNames: string[] = [];
    for (const theme of themes) {
      if (theme.name && !modeNames.includes(theme.name)) {
        modeNames.push(theme.name);
      }
    }
    // Default to Light/Dark if no themes defined
    if (modeNames.length === 0) {
      modeNames.push('Light', 'Dark');
    }

    onProgress?.({
      phase: 'analyzing',
      current: 0,
      total: tokens.tokens.size,
      message: 'Analyzing tokens...',
    });

    // Group tokens by layer
    const tokensByLayer = new Map<'core' | 'semantic' | 'component', ResolvedToken[]>();
    tokensByLayer.set('core', []);
    tokensByLayer.set('semantic', []);
    tokensByLayer.set('component', []);

    for (const token of tokens.tokens.values()) {
      const layer = getTokenLayer(token);
      tokensByLayer.get(layer)!.push(token);
    }

    // Process each layer
    const layers: Array<'core' | 'semantic' | 'component'> = ['core', 'semantic', 'component'];
    let totalProcessed = 0;
    const totalTokens = tokens.tokens.size;

    for (const layer of layers) {
      const layerTokens = tokensByLayer.get(layer) || [];
      if (layerTokens.length === 0) continue;

      const collectionName = opts.collectionNames![layer]!;

      // Get or create collection
      const collection = await getOrCreateCollection(collectionName, modeNames);

      const collectionResult: CollectionSyncResult = {
        collectionId: collection.id,
        collectionName: collectionName,
        layer,
        variablesCreated: 0,
        variablesUpdated: 0,
        variablesDeleted: 0,
      };

      // Track existing variables for orphan detection
      const existingVarNames = new Set<string>();
      for (const varId of collection.variableIds) {
        const variable = await figma.variables.getVariableByIdAsync(varId);
        if (variable) {
          existingVarNames.add(variable.name);
        }
      }

      // Process each token
      for (const token of layerTokens) {
        totalProcessed++;

        const variableName = tokenPathToVariableName(token.path);
        const figmaValue = tokenValueToFigmaValue(token);

        if (figmaValue === null) {
          result.skipped++;
          continue;
        }

        const variableType = getVariableType(token);

        onProgress?.({
          phase: existingVarNames.has(variableName) ? 'updating' : 'creating',
          current: totalProcessed,
          total: totalTokens,
          message: `Processing ${token.path}`,
        });

        try {
          // Check if variable exists
          const existingVariable = await findVariableByName(collection, variableName);

          if (existingVariable) {
            // Update existing variable
            if (opts.updateExisting) {
              // Get mode values
              const modeValues = getModeValues(token, tokens, themes, collection);

              // Update value for each mode
              for (const [modeId, value] of modeValues) {
                existingVariable.setValueForMode(modeId, value);
              }

              collectionResult.variablesUpdated++;
              result.updated++;
            } else {
              result.skipped++;
            }

            // Remove from existing set (not orphaned)
            existingVarNames.delete(variableName);
          } else if (opts.createNew) {
            // Create new variable
            const variable = figma.variables.createVariable(
              variableName,
              collection,
              variableType
            );

            // Set description if available
            if (token.description) {
              variable.description = token.description;
            }

            // Get mode values and set them
            const modeValues = getModeValues(token, tokens, themes, collection);
            for (const [modeId, value] of modeValues) {
              variable.setValueForMode(modeId, value);
            }

            collectionResult.variablesCreated++;
            result.created++;
          }
        } catch (error) {
          const errorMsg = `Failed to sync ${token.path}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          result.errors.push(errorMsg);
          console.error('[Sync]', errorMsg);
        }
      }

      // Handle orphaned variables
      if (opts.deleteOrphans) {
        for (const orphanName of existingVarNames) {
          onProgress?.({
            phase: 'deleting',
            current: totalProcessed,
            total: totalTokens,
            message: `Removing orphaned: ${orphanName}`,
          });

          try {
            const orphanVariable = await findVariableByName(collection, orphanName);
            if (orphanVariable) {
              orphanVariable.remove();
              collectionResult.variablesDeleted++;
              result.deleted++;
            }
          } catch (error) {
            result.errors.push(`Failed to delete ${orphanName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
      }

      result.collections.push(collectionResult);
    }

    onProgress?.({
      phase: 'complete',
      current: totalTokens,
      total: totalTokens,
      message: `Sync complete: ${result.created} created, ${result.updated} updated`,
    });

  } catch (error) {
    result.success = false;
    result.errors.push(`Sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    console.error('[Sync] Fatal error:', error);
  }

  return result;
}

/**
 * Reset all variables to match token source (update values only)
 */
export async function resetVariables(
  tokens: TokenCollection,
  themes: ThemeConfig[],
  onProgress?: SyncProgressCallback
): Promise<SyncResult> {
  return syncTokensToVariables(tokens, themes, {
    createNew: false,
    updateExisting: true,
    deleteOrphans: false,
  }, onProgress);
}

/**
 * Get current sync status
 */
export async function getSyncStatus(
  tokens: TokenCollection,
  collectionNames?: { core?: string; semantic?: string; component?: string }
): Promise<{
  totalTokens: number;
  totalVariables: number;
  collections: Array<{
    name: string;
    layer: string;
    variableCount: number;
    modeCount: number;
  }>;
  syncedPercentage: number;
}> {
  const names = {
    core: collectionNames?.core || 'Core',
    semantic: collectionNames?.semantic || 'Semantic',
    component: collectionNames?.component || 'Component',
  };

  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  let totalVariables = 0;

  const collectionInfo: Array<{
    name: string;
    layer: string;
    variableCount: number;
    modeCount: number;
  }> = [];

  for (const [layer, name] of Object.entries(names)) {
    const collection = collections.find(c => c.name === name);
    if (collection) {
      totalVariables += collection.variableIds.length;
      collectionInfo.push({
        name,
        layer,
        variableCount: collection.variableIds.length,
        modeCount: collection.modes.length,
      });
    }
  }

  // Count syncable tokens (those that can be converted to Figma variables)
  let syncableTokens = 0;
  for (const token of tokens.tokens.values()) {
    if (tokenValueToFigmaValue(token) !== null) {
      syncableTokens++;
    }
  }

  return {
    totalTokens: syncableTokens,
    totalVariables,
    collections: collectionInfo,
    syncedPercentage: syncableTokens > 0 ? Math.round((totalVariables / syncableTokens) * 100) : 0,
  };
}
