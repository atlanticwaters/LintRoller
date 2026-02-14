/**
 * UI-Side Token Loader
 *
 * Supports two token sources:
 *   - "local": Uses bundled token data (inlined at build time, no network required)
 *   - "github": Fetches token data from GitHub (UI context has relaxed CSP)
 */

import type { TokenSource } from '../shared/types';
import { BUNDLED_TOKEN_FILES } from './bundled-tokens';

// Base URL for token files (using raw GitHub content)
const TOKENS_BASE_URL = 'https://raw.githubusercontent.com/atlanticwaters/Tokens-Studio-Sandbox/main';

// Fallback token file paths if metadata fetch fails
const FALLBACK_TOKEN_FILE_PATHS = [
  // Core tokens (primitives)
  'core/colors',
  'core/neutrals',
  'core/border',
  'core/elevation',
  'core/font-family',
  'core/font-size',
  'core/font-weight',
  'core/letter-spacing',
  'core/line-height',
  'core/position',
  'core/spacing',
  // Semantic tokens
  'semantic/light',
  'semantic/dark',
];

export interface TokenFileData {
  path: string;
  content: Record<string, unknown>;
}

/**
 * Fetch JSON from a URL
 */
async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

/**
 * Load all token files from remote GitHub.
 * Fetches $metadata.json first to discover the full token set order,
 * then loads each file. Falls back to hardcoded paths if metadata fetch fails.
 */
export async function loadTokenFilesFromGitHub(): Promise<TokenFileData[]> {
  const tokenFiles: TokenFileData[] = [];

  // Try to fetch metadata for the full file list
  let tokenPaths = FALLBACK_TOKEN_FILE_PATHS;
  try {
    const metadata = await fetchJson<{ tokenSetOrder: string[] }>(
      `${TOKENS_BASE_URL}/$metadata.json`
    );
    if (metadata.tokenSetOrder && metadata.tokenSetOrder.length > 0) {
      tokenPaths = metadata.tokenSetOrder;
      console.log(`[UI] Loaded metadata with ${tokenPaths.length} token sets`);
    }
  } catch (error) {
    console.warn('[UI] Failed to load metadata, using fallback file paths:', error);
  }

  // Load each token file
  for (const tokenPath of tokenPaths) {
    try {
      const url = `${TOKENS_BASE_URL}/${tokenPath}.json`;
      console.log(`[UI] Loading tokens from: ${url}`);
      const content = await fetchJson<Record<string, unknown>>(url);

      tokenFiles.push({
        path: tokenPath,
        content,
      });
    } catch (error) {
      console.warn(`[UI] Failed to load token file ${tokenPath}:`, error);
    }
  }

  console.log(`[UI] Loaded ${tokenFiles.length} token files from GitHub`);
  return tokenFiles;
}

/**
 * Load all token files from the local bundle (embedded at build time).
 * Returns instantly — no network required.
 */
export function loadTokenFilesLocal(): TokenFileData[] {
  console.log(`[UI] Loading ${BUNDLED_TOKEN_FILES.length} bundled token files`);
  return BUNDLED_TOKEN_FILES;
}

/**
 * Load token files based on the selected source.
 */
export async function loadTokenFilesBySource(source: TokenSource): Promise<TokenFileData[]> {
  if (source === 'local') {
    return loadTokenFilesLocal();
  }
  return loadTokenFilesFromGitHub();
}
