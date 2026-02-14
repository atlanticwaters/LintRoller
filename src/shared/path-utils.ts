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

/** Common prefixes to strip when matching variable names to token paths */
const COMMON_PREFIXES = [
  'system/', 'component/', 'core/', 'semantic/', 'primitive/',
  'color/', 'colours/', 'colors/',
  'light/', 'dark/',
  'semantic/light/', 'semantic/dark/',
];

/**
 * Strip common namespace prefixes from a normalized path.
 * Used as a fallback matching strategy when direct matching fails.
 */
function stripCommonPrefixes(normalizedPath: string): string {
  let stripped = normalizedPath;
  for (const prefix of COMMON_PREFIXES) {
    if (stripped.startsWith(prefix)) {
      stripped = stripped.slice(prefix.length);
      // Only strip one prefix level to avoid over-stripping
      break;
    }
  }
  return stripped;
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

  // 5. Strip common prefixes from both sides and try matching the remainder
  // This handles cases like variable "system/background/foo" vs token "semantic/light/background/foo"
  const strippedName = stripCommonPrefixes(normalizedName);
  if (strippedName !== normalizedName) {
    for (const [normalized, original] of normalizedTokens) {
      const strippedToken = stripCommonPrefixes(normalized);
      if (strippedToken === strippedName) {
        return original;
      }
    }
  }

  // 6. Try stripping prefix only from token paths (variable has no prefix to strip)
  for (const [normalized, original] of normalizedTokens) {
    const strippedToken = stripCommonPrefixes(normalized);
    if (strippedToken !== normalized && strippedToken === normalizedName) {
      return original;
    }
  }

  return undefined;
}

/**
 * Score how similar two paths are based on shared segments.
 * Returns a value from 0 (no overlap) to 1 (identical after normalization).
 *
 * Scoring prioritizes:
 * 1. Matching segments from the end (most specific part of the path)
 * 2. Total number of matching segments
 * 3. Partial segment similarity (e.g., "transparent-10" vs "transparent-5")
 */
export function scorePathSimilarity(path1: string, path2: string): number {
  const norm1 = normalizePath(path1);
  const norm2 = normalizePath(path2);

  if (norm1 === norm2) return 1;

  const segs1 = norm1.split('/');
  const segs2 = norm2.split('/');
  const maxLen = Math.max(segs1.length, segs2.length);
  if (maxLen === 0) return 0;

  let score = 0;

  // 1. Count exact segment matches (order-independent)
  const seg2Set = new Set(segs2);
  let exactMatches = 0;
  for (const seg of segs1) {
    if (seg.length > 1 && seg2Set.has(seg)) {
      exactMatches++;
    }
  }
  // Base score: proportion of matching segments (strongest signal)
  score += (exactMatches / maxLen) * 0.5;

  // 2. Consecutive head match bonus: matching from the front shows shared hierarchy
  // e.g., "system/background/container-color/..." matching from the start
  const minLen = Math.min(segs1.length, segs2.length);
  let headMatches = 0;
  for (let i = 0; i < minLen; i++) {
    if (segs1[i] === segs2[i]) {
      headMatches++;
    } else {
      break;
    }
  }
  score += (headMatches / maxLen) * 0.3;

  // 3. Partial similarity for the tail segment (handles "transparent-10" vs "transparent-5")
  const tail1 = segs1[segs1.length - 1];
  const tail2 = segs2[segs2.length - 1];
  if (tail1 !== tail2 && tail1 && tail2) {
    // Check if they share a common prefix (e.g., "transparent-")
    const minTailLen = Math.min(tail1.length, tail2.length);
    let commonPrefixLen = 0;
    for (let i = 0; i < minTailLen; i++) {
      if (tail1[i] === tail2[i]) {
        commonPrefixLen++;
      } else {
        break;
      }
    }
    // Only count if at least half the shorter segment matches
    if (commonPrefixLen > minTailLen * 0.5) {
      score += (commonPrefixLen / Math.max(tail1.length, tail2.length)) * 0.2;
    }
  } else if (tail1 === tail2) {
    score += 0.2;
  }

  return Math.min(score, 1);
}

/**
 * Find the best fuzzy-matching token paths for a variable name.
 * Returns matches sorted by similarity score (highest first).
 *
 * @param variableName - The Figma variable name to match
 * @param tokenPaths - All available token paths to search
 * @param minScore - Minimum similarity score (0-1) to include (default: 0.4)
 * @param maxResults - Maximum number of results to return (default: 5)
 */
export function findFuzzyMatchingTokenPaths(
  variableName: string,
  tokenPaths: string[],
  minScore: number = 0.4,
  maxResults: number = 5
): Array<{ path: string; score: number }> {
  const results: Array<{ path: string; score: number }> = [];

  for (const tokenPath of tokenPaths) {
    const score = scorePathSimilarity(variableName, tokenPath);
    if (score >= minScore) {
      results.push({ path: tokenPath, score });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, maxResults);
}
