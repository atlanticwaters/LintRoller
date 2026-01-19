/**
 * DTCG Token Parser
 *
 * Parses Tokens Studio DTCG-compliant JSON files and resolves aliases.
 */

import type {
  RawToken,
  ResolvedToken,
  TokenCollection,
  TokenFileInput,
  TokenSetMetadata,
  TokenType,
  LAB,
} from './types';
import { hexToLab } from './color-distance';

/** Internal token with source tracking */
interface InternalToken extends RawToken {
  _sourcePath: string;
}

/**
 * Check if a value is an alias reference (e.g., "{brand.brand-300}")
 */
function isAliasValue(value: unknown): value is string {
  return typeof value === 'string' && /^\{[^}]+\}$/.test(value);
}

/**
 * Extract the referenced path from an alias value
 * "{brand.brand-300}" -> "brand.brand-300"
 */
function extractAliasPath(value: string): string {
  return value.slice(1, -1);
}

/**
 * Check if an object is a DTCG token (has $value property)
 */
function isToken(obj: unknown): obj is RawToken {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    '$value' in obj &&
    !('$themes' in obj) // Exclude $themes.json objects
  );
}

/**
 * Normalize color value to lowercase hex
 */
function normalizeColor(value: string): string {
  // Handle hex colors
  if (value.startsWith('#')) {
    return value.toLowerCase();
  }
  // Pass through gradients and other formats
  return value;
}

/**
 * DTCG Token Parser class
 */
export class TokenParser {
  private rawTokens: Map<string, InternalToken> = new Map();
  private resolvedTokens: Map<string, ResolvedToken> = new Map();
  private resolutionStack: Set<string> = new Set();

  /**
   * Parse token files and resolve all aliases
   */
  parseTokenFiles(files: TokenFileInput[], metadata?: TokenSetMetadata): TokenCollection {
    // Clear previous state
    this.rawTokens.clear();
    this.resolvedTokens.clear();

    // Parse files in order (order matters for overrides)
    const orderedFiles = this.orderFiles(files, metadata);

    for (const file of orderedFiles) {
      this.parseTokenFile(file.content, file.path);
    }

    // Resolve all aliases
    this.resolveAllAliases();

    // Build collection with indexes
    return this.buildCollection();
  }

  /**
   * Order files according to metadata tokenSetOrder
   */
  private orderFiles(files: TokenFileInput[], metadata?: TokenSetMetadata): TokenFileInput[] {
    if (!metadata?.tokenSetOrder) {
      return files;
    }

    const ordered: TokenFileInput[] = [];
    const remaining = new Set(files);

    for (const setPath of metadata.tokenSetOrder) {
      const file = files.find(f => f.path === setPath || f.path.replace(/\.json$/, '') === setPath);
      if (file) {
        ordered.push(file);
        remaining.delete(file);
      }
    }

    // Add any remaining files not in metadata
    for (const file of remaining) {
      ordered.push(file);
    }

    return ordered;
  }

  /**
   * Recursively parse a token file into the raw tokens map
   */
  private parseTokenFile(content: Record<string, unknown>, sourcePath: string, pathPrefix = ''): void {
    for (const [key, value] of Object.entries(content)) {
      // Skip metadata keys
      if (key.startsWith('$')) {
        continue;
      }

      const currentPath = pathPrefix ? `${pathPrefix}.${key}` : key;

      if (isToken(value)) {
        // It's a token - add to raw tokens
        this.rawTokens.set(currentPath, {
          $value: value.$value,
          $type: value.$type,
          $description: value.$description,
          $extensions: value.$extensions,
          _sourcePath: sourcePath,
        });
      } else if (typeof value === 'object' && value !== null) {
        // It's a nested group - recurse
        this.parseTokenFile(value as Record<string, unknown>, sourcePath, currentPath);
      }
    }
  }

  /**
   * Resolve all aliases in the raw tokens
   */
  private resolveAllAliases(): void {
    for (const path of this.rawTokens.keys()) {
      if (!this.resolvedTokens.has(path)) {
        this.resolveToken(path);
      }
    }
  }

  /**
   * Resolve a single token, following alias chain if needed
   */
  private resolveToken(path: string): ResolvedToken {
    // Check if already resolved
    if (this.resolvedTokens.has(path)) {
      return this.resolvedTokens.get(path)!;
    }

    const raw = this.rawTokens.get(path);
    if (!raw) {
      throw new Error(`Token not found: ${path}`);
    }

    // Check for circular reference
    if (this.resolutionStack.has(path)) {
      const cycle = [...this.resolutionStack, path].join(' -> ');
      throw new Error(`Circular reference detected: ${cycle}`);
    }

    const value = raw.$value;

    if (isAliasValue(value)) {
      // It's an alias - resolve the referenced token
      const aliasPath = extractAliasPath(value);

      this.resolutionStack.add(path);

      let referenced: ResolvedToken;
      try {
        referenced = this.resolveToken(aliasPath);
      } catch (error) {
        // If reference not found, create a placeholder
        if ((error as Error).message.includes('Token not found')) {
          // Reference doesn't exist - mark as unresolved alias
          const resolved: ResolvedToken = {
            path,
            rawValue: value,
            resolvedValue: value, // Keep alias as-is
            type: raw.$type || 'color',
            description: raw.$description,
            isAlias: true,
            aliasPath,
            sourceFile: raw._sourcePath,
          };
          this.resolvedTokens.set(path, resolved);
          this.resolutionStack.delete(path);
          return resolved;
        }
        throw error;
      }

      this.resolutionStack.delete(path);

      const resolved: ResolvedToken = {
        path,
        rawValue: value,
        resolvedValue: referenced.resolvedValue,
        type: raw.$type || referenced.type,
        description: raw.$description,
        isAlias: true,
        aliasPath,
        sourceFile: raw._sourcePath,
      };

      this.resolvedTokens.set(path, resolved);
      return resolved;
    }

    // Direct value - not an alias
    let resolvedValue: string | number = value;

    // Normalize color values
    if (raw.$type === 'color' && typeof value === 'string') {
      resolvedValue = normalizeColor(value);
    }

    const resolved: ResolvedToken = {
      path,
      rawValue: value,
      resolvedValue,
      type: raw.$type || 'color',
      description: raw.$description,
      isAlias: false,
      sourceFile: raw._sourcePath,
    };

    this.resolvedTokens.set(path, resolved);
    return resolved;
  }

  /**
   * Build the final TokenCollection with lookup indexes
   */
  private buildCollection(): TokenCollection {
    const tokens = new Map(this.resolvedTokens);
    const byType = new Map<TokenType, ResolvedToken[]>();
    const colorValues = new Map<string, string>();
    const numberValues = new Map<number, string[]>();
    const colorLab = new Map<string, LAB>();

    for (const token of tokens.values()) {
      // Index by type
      const typeList = byType.get(token.type) || [];
      typeList.push(token);
      byType.set(token.type, typeList);

      // Index color values by hex
      if (token.type === 'color' && typeof token.resolvedValue === 'string') {
        const hex = token.resolvedValue.toLowerCase();
        // Only index if it's a valid hex color (not gradient)
        if (hex.startsWith('#') && !colorValues.has(hex)) {
          colorValues.set(hex, token.path);

          // Pre-compute LAB value for Delta E calculations
          const lab = hexToLab(hex);
          if (lab) {
            colorLab.set(hex, lab);
          }
        }
      }

      // Index number values
      if ((token.type === 'number' || token.type === 'dimension') && typeof token.resolvedValue === 'number') {
        const list = numberValues.get(token.resolvedValue) || [];
        list.push(token.path);
        numberValues.set(token.resolvedValue, list);
      }
    }

    return {
      tokens,
      byType,
      colorValues,
      numberValues,
      colorLab,
    };
  }
}

/**
 * Parse metadata file content
 */
export function parseMetadata(content: unknown): TokenSetMetadata | undefined {
  if (
    typeof content === 'object' &&
    content !== null &&
    'tokenSetOrder' in content &&
    Array.isArray((content as TokenSetMetadata).tokenSetOrder)
  ) {
    return content as TokenSetMetadata;
  }
  return undefined;
}

/**
 * Convenience function to parse token files from raw JSON
 */
export function parseTokens(
  files: Array<{ path: string; content: string }>,
  metadataContent?: string
): TokenCollection {
  const parser = new TokenParser();

  const parsedFiles: TokenFileInput[] = files.map(f => ({
    path: f.path,
    content: JSON.parse(f.content),
  }));

  const metadata = metadataContent ? parseMetadata(JSON.parse(metadataContent)) : undefined;

  return parser.parseTokenFiles(parsedFiles, metadata);
}
