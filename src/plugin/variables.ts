/**
 * Figma Variable Collection Utilities
 *
 * Query and manage Figma variables for orphan detection.
 */

import type { ThemeConfig } from '../shared/types';

/**
 * Variable information
 */
export interface VariableInfo {
  id: string;
  name: string;
  collectionId: string;
  collectionName: string;
  resolvedType: VariableResolvedDataType;
}

/**
 * Collection information
 */
export interface CollectionInfo {
  id: string;
  name: string;
  modes: Array<{ modeId: string; name: string }>;
  variableIds: string[];
}

/**
 * Load all local variables from the document
 */
export async function getLocalVariables(): Promise<Map<string, VariableInfo>> {
  const variables = await figma.variables.getLocalVariablesAsync();
  const collections = await figma.variables.getLocalVariableCollectionsAsync();

  const collectionMap = new Map<string, VariableCollection>();
  for (const collection of collections) {
    collectionMap.set(collection.id, collection);
  }

  const result = new Map<string, VariableInfo>();

  for (const variable of variables) {
    const collection = collectionMap.get(variable.variableCollectionId);
    result.set(variable.id, {
      id: variable.id,
      name: variable.name,
      collectionId: variable.variableCollectionId,
      collectionName: collection?.name || 'Unknown',
      resolvedType: variable.resolvedType,
    });
  }

  return result;
}

/**
 * Load all local variable collections
 */
export async function getLocalCollections(): Promise<Map<string, CollectionInfo>> {
  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  const result = new Map<string, CollectionInfo>();

  for (const collection of collections) {
    result.set(collection.id, {
      id: collection.id,
      name: collection.name,
      modes: collection.modes,
      variableIds: collection.variableIds,
    });
  }

  return result;
}

/**
 * Get variable by ID
 */
export async function getVariableById(id: string): Promise<Variable | null> {
  try {
    return await figma.variables.getVariableByIdAsync(id);
  } catch {
    return null;
  }
}

/**
 * Build a set of known token variable IDs from theme configs
 */
export function buildTokenVariableIdSet(themeConfigs: ThemeConfig[]): Set<string> {
  const ids = new Set<string>();

  for (const theme of themeConfigs) {
    if (theme.figmaVariableReferences) {
      for (const varId of Object.values(theme.figmaVariableReferences)) {
        if (varId) {
          ids.add(varId);
        }
      }
    }
  }

  return ids;
}

/**
 * Map Figma variable names to token paths
 */
export function buildVariableNameToTokenPathMap(
  variables: Map<string, VariableInfo>,
  tokenPaths: string[]
): Map<string, string> {
  const map = new Map<string, string>();

  // Build a lookup of normalized token paths
  const normalizedTokens = new Map<string, string>();
  for (const path of tokenPaths) {
    // Normalize: lowercase, remove spaces, replace dots with slashes
    const normalized = path.toLowerCase().replace(/\s+/g, '-').replace(/\./g, '/');
    normalizedTokens.set(normalized, path);
  }

  for (const variable of variables.values()) {
    // Try to match variable name to token path
    const normalizedName = variable.name.toLowerCase().replace(/\s+/g, '-').replace(/\./g, '/');

    // Direct match
    if (normalizedTokens.has(normalizedName)) {
      map.set(variable.id, normalizedTokens.get(normalizedName)!);
      continue;
    }

    // Try with collection name prefix
    const withCollection = `${variable.collectionName}/${normalizedName}`.toLowerCase().replace(/\s+/g, '-');
    if (normalizedTokens.has(withCollection)) {
      map.set(variable.id, normalizedTokens.get(withCollection)!);
    }
  }

  return map;
}
