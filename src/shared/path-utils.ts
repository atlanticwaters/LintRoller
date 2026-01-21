/**
 * Path Normalization Utilities
 *
 * Handles conversion between different path formats used by:
 * - Token paths (dot notation): "brand.colors.primary"
 * - Figma variable names (slash notation): "brand/colors/primary"
 */

/**
 * Normalize a path for comparison.
 * Converts both dot and slash notations to a consistent format (slashes).
 *
 * @example
 * normalizePath("brand.colors.primary") // "brand/colors/primary"
 * normalizePath("brand/colors/primary") // "brand/colors/primary"
 * normalizePath("Brand / Colors / Primary") // "brand/colors/primary"
 */
export function normalizePath(path: string): string {
  return path
    .toLowerCase()
    .replace(/\./g, '/')           // dots → slashes
    .replace(/\s*\/\s*/g, '/')     // normalize " / " → "/"
    .replace(/\s+/g, '-')          // spaces → dashes
    .replace(/^\/+|\/+$/g, '');    // trim leading/trailing slashes
}

/**
 * Convert a token path (dot notation) to Figma variable name format (slash notation)
 *
 * @example
 * tokenPathToVariableName("brand.colors.primary") // "brand/colors/primary"
 */
export function tokenPathToVariableName(tokenPath: string): string {
  return tokenPath.replace(/\./g, '/');
}

/**
 * Convert a Figma variable name (slash notation) to token path format (dot notation)
 *
 * @example
 * variableNameToTokenPath("brand/colors/primary") // "brand.colors.primary"
 */
export function variableNameToTokenPath(variableName: string): string {
  return variableName.replace(/\//g, '.');
}

/**
 * Check if two paths match after normalization
 *
 * @example
 * pathsMatch("brand.colors.primary", "brand/colors/primary") // true
 * pathsMatch("Brand / Colors", "brand/colors") // true
 */
export function pathsMatch(path1: string, path2: string): boolean {
  return normalizePath(path1) === normalizePath(path2);
}

/**
 * Check if path1 ends with path2 (after normalization)
 * Useful for matching partial paths like "primary" to "brand/colors/primary"
 */
export function pathEndsWith(fullPath: string, suffix: string): boolean {
  const normalizedFull = normalizePath(fullPath);
  const normalizedSuffix = normalizePath(suffix);

  if (normalizedFull === normalizedSuffix) {
    return true;
  }

  return normalizedFull.endsWith('/' + normalizedSuffix);
}

/**
 * Check if path1 contains path2 (after normalization)
 */
export function pathContains(fullPath: string, part: string): boolean {
  return normalizePath(fullPath).includes(normalizePath(part));
}

/**
 * Build a normalized lookup map from token paths
 * Maps normalized paths to original paths for reverse lookup
 */
export function buildNormalizedPathMap(paths: string[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const path of paths) {
    map.set(normalizePath(path), path);
  }
  return map;
}

/**
 * Find the best matching token path for a variable name
 * Returns the original (non-normalized) token path if found
 */
export function findMatchingTokenPath(
  variableName: string,
  tokenPaths: string[],
  collectionName?: string
): string | undefined {
  const normalizedName = normalizePath(variableName);
  const normalizedTokens = buildNormalizedPathMap(tokenPaths);

  // 1. Direct match
  if (normalizedTokens.has(normalizedName)) {
    return normalizedTokens.get(normalizedName);
  }

  // 2. Try with collection name prefix
  if (collectionName) {
    const withCollection = normalizePath(`${collectionName}/${variableName}`);
    if (normalizedTokens.has(withCollection)) {
      return normalizedTokens.get(withCollection);
    }
  }

  // 3. Try suffix match (variable name might be a subset of token path)
  for (const [normalized, original] of normalizedTokens) {
    if (pathEndsWith(normalized, normalizedName)) {
      return original;
    }
  }

  // 4. Try if token path is suffix of variable name
  for (const [normalized, original] of normalizedTokens) {
    if (pathEndsWith(normalizedName, normalized)) {
      return original;
    }
  }

  return undefined;
}
