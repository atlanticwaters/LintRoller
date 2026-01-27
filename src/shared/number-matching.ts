/**
 * Number Matching Utilities
 *
 * Provides proximity-based matching for numeric values like spacing and radii.
 */

/**
 * Number match result
 */
export interface NumberMatch {
  tokenPath: string;
  tokenValue: number;
  difference: number;
  percentDifference: number;
  isExact: boolean;
}

/** Tolerance thresholds for "close" matches */
const CLOSE_TOLERANCE_PERCENT = 0.25; // 25%
const CLOSE_TOLERANCE_ABSOLUTE = 4; // 4px

/** Maximum tolerance to include in results (always show closest options) */
const MAX_TOLERANCE_PERCENT = 1.0; // 100%
const MAX_TOLERANCE_ABSOLUTE = 20; // 20px

/**
 * Find closest matching number tokens for a given value
 *
 * @param targetValue - The numeric value to match
 * @param numberTokens - Map of values to token paths
 * @param preferredKeywords - Keywords to prioritize in token names (e.g., ['spacing', 'gap'])
 * @param maxResults - Maximum number of results to return (default: 5)
 * @param tolerance - Maximum percentage difference for "close" matches (default: 0.25 = 25%)
 * @param absoluteTolerance - Maximum absolute difference in px for "close" matches (default: 4)
 */
export function findClosestNumbers(
  targetValue: number,
  numberTokens: Map<number, string[]>,
  preferredKeywords: string[] = [],
  maxResults: number = 5,
  tolerance: number = CLOSE_TOLERANCE_PERCENT,
  absoluteTolerance: number = CLOSE_TOLERANCE_ABSOLUTE
): NumberMatch[] {
  const matches: NumberMatch[] = [];

  for (const [tokenValue, paths] of numberTokens.entries()) {
    const difference = Math.abs(targetValue - tokenValue);
    const percentDiff = targetValue !== 0 ? difference / targetValue : tokenValue !== 0 ? 1 : 0;
    const isExact = difference === 0;

    // Always include if within expanded tolerance (to ensure we always have suggestions)
    const withinExpandedPercent = percentDiff <= MAX_TOLERANCE_PERCENT;
    const withinExpandedAbsolute = difference <= MAX_TOLERANCE_ABSOLUTE;

    if (isExact || withinExpandedPercent || withinExpandedAbsolute) {
      // Add all paths for this value
      for (const path of paths) {
        matches.push({
          tokenPath: path,
          tokenValue,
          difference,
          percentDifference: percentDiff,
          isExact,
        });
      }
    }
  }

  // Sort matches
  matches.sort((a, b) => {
    // Exact matches first
    if (a.isExact && !b.isExact) return -1;
    if (!a.isExact && b.isExact) return 1;

    // For non-exact matches, prefer smaller differences
    if (a.difference !== b.difference) {
      return a.difference - b.difference;
    }

    // Prefer semantic tokens (system.*, component.*) over core tokens
    const aIsSemantic = isSemanticTokenPath(a.tokenPath);
    const bIsSemantic = isSemanticTokenPath(b.tokenPath);
    if (aIsSemantic && !bIsSemantic) return -1;
    if (!aIsSemantic && bIsSemantic) return 1;

    // If same difference, prefer tokens with preferred keywords
    if (preferredKeywords.length > 0) {
      const aHasKeyword = hasPreferredKeyword(a.tokenPath, preferredKeywords);
      const bHasKeyword = hasPreferredKeyword(b.tokenPath, preferredKeywords);
      if (aHasKeyword && !bHasKeyword) return -1;
      if (!aHasKeyword && bHasKeyword) return 1;
    }

    return 0;
  });

  return matches.slice(0, maxResults);
}

/**
 * Check if a token path contains any preferred keyword
 */
function hasPreferredKeyword(path: string, keywords: string[]): boolean {
  const lowerPath = path.toLowerCase();
  return keywords.some(kw => lowerPath.includes(kw.toLowerCase()));
}

/**
 * Check if a token path is a semantic token (should be preferred for suggestions)
 */
function isSemanticTokenPath(path: string): boolean {
  return path.startsWith('system.') || path.startsWith('component.');
}

/**
 * Find the single best matching number token
 *
 * @param targetValue - The numeric value to match
 * @param numberTokens - Map of values to token paths
 * @param preferredKeywords - Keywords to prioritize
 */
export function findBestNumberMatch(
  targetValue: number,
  numberTokens: Map<number, string[]>,
  preferredKeywords: string[] = []
): NumberMatch | undefined {
  const matches = findClosestNumbers(targetValue, numberTokens, preferredKeywords, 1);
  return matches.length > 0 ? matches[0] : undefined;
}

/**
 * Get a human-readable description of number match quality
 */
export function getNumberMatchDescription(match: NumberMatch): string {
  if (match.isExact) {
    return 'exact match';
  }

  if (match.difference <= 1) {
    return 'off by ' + match.difference + 'px';
  }

  if (match.percentDifference <= 0.05) {
    return 'within 5%';
  }

  if (match.percentDifference <= 0.1) {
    return 'within 10%';
  }

  return 'off by ' + Math.round(match.difference) + 'px (' + Math.round(match.percentDifference * 100) + '%)';
}

/**
 * Spacing-specific keywords for prioritizing spacing tokens
 */
export const SPACING_KEYWORDS = ['spacing', 'space', 'gap', 'padding', 'margin', 'inset'];

/**
 * Radius-specific keywords for prioritizing radius tokens
 */
export const RADIUS_KEYWORDS = ['radius', 'corner', 'round', 'border-radius'];

/**
 * Typography-specific keywords for prioritizing typography tokens
 */
export const TYPOGRAPHY_KEYWORDS = ['font', 'text', 'line', 'letter', 'size', 'typography'];
