/**
 * Remote Token Data Loader
 *
 * Fetches token data from GitHub Pages.
 */

import type { TokenFileInput, TokenSetMetadata, ThemeConfig } from '../shared/types';

// Base URL for token files
const TOKENS_BASE_URL = 'https://atlanticwaters.github.io/Tokens-Studio-Sandbox';

// Token file paths (derived from $metadata.json tokenSetOrder)
const TOKEN_FILE_PATHS = [
  'Color/Default',
  'Typography/Default',
  'Spacing/Mode 1',
  'Radius/Mode 1',
  'Effects/Mode 1',
  'Border Width/Mode 1',
  'iOS Overrides/Light',
  'iOS Overrides/Dark',
  'Buttons/Mode 1',
  'Semantic Tokens/Light Mode',
  'Semantic Tokens/Dark Mode',
  'Component Tokens/Light Mode',
  'Component Tokens/Dark Mode',
];

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
 * Load token metadata from remote
 */
export async function loadTokenMetadata(): Promise<TokenSetMetadata> {
  try {
    const metadata = await fetchJson<TokenSetMetadata>(`${TOKENS_BASE_URL}/$metadata.json`);
    return metadata;
  } catch (error) {
    console.warn('Failed to load remote metadata, using defaults:', error);
    return {
      tokenSetOrder: TOKEN_FILE_PATHS,
    };
  }
}

/**
 * Load theme configurations from remote
 */
export async function loadThemeConfigs(): Promise<ThemeConfig[]> {
  try {
    const themes = await fetchJson<ThemeConfig[]>(`${TOKENS_BASE_URL}/$themes.json`);
    return themes;
  } catch (error) {
    console.warn('Failed to load remote themes:', error);
    return [];
  }
}

/**
 * Load all token files from remote GitHub Pages
 */
export async function loadTokenFiles(): Promise<TokenFileInput[]> {
  const metadata = await loadTokenMetadata();
  const tokenFiles: TokenFileInput[] = [];

  // Load each token file
  for (const tokenPath of metadata.tokenSetOrder) {
    try {
      // URL encode the path (handle spaces and special characters)
      const encodedPath = tokenPath.split('/').map(encodeURIComponent).join('/');
      const url = `${TOKENS_BASE_URL}/${encodedPath}.json`;

      console.log(`Loading tokens from: ${url}`);
      const content = await fetchJson<Record<string, unknown>>(url);

      tokenFiles.push({
        path: tokenPath,
        content,
      });
    } catch (error) {
      console.warn(`Failed to load token file ${tokenPath}:`, error);
    }
  }

  console.log(`Loaded ${tokenFiles.length} token files`);
  return tokenFiles;
}

/**
 * Load all token data (metadata, themes, and token files)
 */
export async function loadAllTokenData(): Promise<{
  metadata: TokenSetMetadata;
  themes: ThemeConfig[];
  files: TokenFileInput[];
}> {
  // Load metadata and themes in parallel
  const [metadata, themes] = await Promise.all([
    loadTokenMetadata(),
    loadThemeConfigs(),
  ]);

  // Load token files (sequentially to respect order)
  const files = await loadTokenFiles();

  return { metadata, themes, files };
}

// Export for backward compatibility
export const tokenMetadata: TokenSetMetadata = {
  tokenSetOrder: TOKEN_FILE_PATHS,
};

export const themeConfigs: ThemeConfig[] = [];
