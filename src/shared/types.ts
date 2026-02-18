/**
 * Core types for the Design Token Linter
 */

import type { LAB, ColorMatch } from './color-distance';
import type { NumberMatch } from './number-matching';

// Re-export for convenience
export type { LAB, ColorMatch, NumberMatch };

// DTCG Token Types
export type TokenType = 'color' | 'number' | 'dimension' | 'text' | 'shadow' | 'typography';

/**
 * Raw token as parsed from DTCG JSON
 */
export interface RawToken {
  $value: string | number;
  $type: TokenType;
  $description?: string;
  $extensions?: Record<string, unknown>;
}

/**
 * Resolved token with computed value after alias resolution
 */
export interface ResolvedToken {
  /** Full path: "brand.brand-300" or "Spacing 0" */
  path: string;
  /** Original value (may be alias like "{brand.brand-300}") */
  rawValue: string | number;
  /** Fully resolved value */
  resolvedValue: string | number;
  /** Token type from DTCG spec */
  type: TokenType;
  /** Optional description */
  description?: string;
  /** Whether this token references another token */
  isAlias: boolean;
  /** If alias, the path it references */
  aliasPath?: string;
  /** Source file for debugging */
  sourceFile: string;
}

/**
 * Collection of parsed and resolved tokens with lookup indexes
 */
export interface TokenCollection {
  /** All tokens by path */
  tokens: Map<string, ResolvedToken>;
  /** Tokens grouped by type */
  byType: Map<TokenType, ResolvedToken[]>;
  /** Color hex values to preferred token path (lowercase, prefers semantic tokens) */
  colorValues: Map<string, string>;
  /** Color hex values to ALL token paths (lowercase) - for context-aware suggestions */
  allColorPaths: Map<string, string[]>;
  /** Number values to token paths (for spacing, radius, etc.) */
  numberValues: Map<number, string[]>;
  /** Pre-computed LAB values for color tokens (for Delta E calculations) */
  colorLab: Map<string, LAB>;
}

/**
 * Tokens Studio metadata file structure
 */
export interface TokenSetMetadata {
  tokenSetOrder: string[];
}

/**
 * Theme configuration from $themes.json
 */
export interface ThemeConfig {
  id: string;
  name: string;
  group?: string;
  selectedTokenSets: Record<string, 'enabled' | 'disabled' | 'source'>;
  figmaVariableReferences?: Record<string, string>;
  figmaCollectionId?: string;
  figmaModeId?: string;
}

/**
 * Input for token file parsing
 */
export interface TokenFileInput {
  /** Relative path like "Color/Default" */
  path: string;
  /** Parsed JSON content */
  content: Record<string, unknown>;
}

// Lint Rule Types

export type LintRuleId =
  | 'no-hardcoded-colors'
  | 'no-hardcoded-typography'
  | 'no-hardcoded-spacing'
  | 'no-hardcoded-radii'
  | 'no-hardcoded-stroke-weight'
  | 'no-hardcoded-sizing'
  | 'no-orphaned-variables'
  | 'no-unknown-styles'
  | 'prefer-semantic-variables';

export type TokenSource = 'local' | 'github';

export type Severity = 'error' | 'warning' | 'info';

/**
 * Configuration for a single lint rule
 */
export interface RuleConfig {
  enabled: boolean;
  severity: Severity;
}

/**
 * Full lint configuration
 */
export interface LintConfig {
  rules: Record<LintRuleId, RuleConfig>;
  skipHiddenLayers: boolean;
  skipLockedLayers: boolean;
}

/**
 * Match confidence level for token suggestions
 */
export type MatchConfidence = 'exact' | 'close' | 'approximate';

/**
 * Alternative token suggestion
 */
export interface TokenSuggestion {
  /** Token path */
  path: string;
  /** Token's resolved value */
  value: string | number;
  /** Distance metric (Delta E for colors, px difference for numbers) */
  distance: number;
  /** Human-readable description of the match quality */
  description: string;
}

/**
 * A single lint violation found during scanning
 */
export interface LintViolation {
  /** Unique ID for this violation */
  id: string;
  /** Which rule found this */
  ruleId: LintRuleId;
  /** Severity level */
  severity: Severity;
  /** Figma node ID */
  nodeId: string;
  /** Node name */
  nodeName: string;
  /** Node type (RECTANGLE, TEXT, etc.) */
  nodeType: string;
  /** Full layer path: "Frame > Group > Rectangle" */
  layerPath: string;
  /** Property with issue: "fills[0]", "fontSize", etc. */
  property: string;
  /** Current value */
  currentValue: string | number;
  /** Human-readable message */
  message: string;
  /** Suggested token to use, if one matches */
  suggestedToken?: string;
  /** Confidence level of the suggestion */
  suggestionConfidence?: MatchConfidence;
  /** Alternative token suggestions */
  alternativeTokens?: TokenSuggestion[];
  /** Whether this violation can be fixed by unbinding the variable */
  canUnbind?: boolean;
  /** Whether this violation can be fixed by detaching the style */
  canDetach?: boolean;
  /** Whether this is a path syntax mismatch (/ vs . notation) that can be auto-fixed */
  isPathMismatch?: boolean;
  /** The correct token path after normalization (for path mismatches) */
  normalizedMatchPath?: string;
  /** Suggested text style to apply (for typography properties that can't use variables) */
  suggestedTextStyle?: TextStyleSuggestion;
  /** Whether this violation can be fixed by applying a text style */
  canApplyTextStyle?: boolean;
  /** Whether this violation can be ignored (no fix available within tolerance) */
  canIgnore?: boolean;
  /** Hex color of the current value (for color swatches in UI) */
  currentHexColor?: string;
  /** Hex color of the suggested token (for color swatches in UI) */
  suggestedHexColor?: string;
}

/**
 * Text style suggestion for typography violations
 */
export interface TextStyleSuggestion {
  /** Figma text style ID */
  id: string;
  /** Text style name */
  name: string;
  /** Font size of the style */
  fontSize?: number;
  /** Line height of the style */
  lineHeight?: number;
  /** Letter spacing of the style */
  letterSpacing?: number;
  /** How well this style matches the current value */
  matchQuality: 'exact' | 'partial';
}

/**
 * Summary statistics for lint results
 */
export interface LintSummary {
  total: number;
  byRule: Record<LintRuleId, number>;
  bySeverity: Record<Severity, number>;
}

/**
 * Metadata about the scan
 */
export interface ScanMetadata {
  scannedNodes: number;
  scanDurationMs: number;
  timestamp: string;
}

/**
 * Complete lint results
 */
export interface LintResults {
  violations: LintViolation[];
  summary: LintSummary;
  metadata: ScanMetadata;
}

/**
 * Scope for scanning
 */
export interface ScanScope {
  type: 'selection' | 'current_page' | 'full_document';
}

/**
 * Property inspection result from scanner
 */
export interface PropertyInspection {
  /** Property name: "fills[0]", "fontSize", etc. */
  property: string;
  /** Whether this property is bound to a variable */
  isBound: boolean;
  /** Figma variable ID if bound */
  boundVariableId?: string;
  /** Figma variable name if bound */
  boundVariableName?: string;
  /** The raw value of the property */
  rawValue: unknown;
}

// ─── Variable Remap Types ────────────────────────────────────────────────

/**
 * A single stale or broken variable binding found during remap scan.
 *
 * "Stale" means the variable ID still resolves (from an old library import cache)
 * but a local variable with the same name exists under a different ID.
 * "Broken" means the variable ID doesn't resolve at all.
 */
export interface RemapEntry {
  /** The old variable ID that needs remapping */
  oldVariableId: string;
  /** The name of the old variable (if resolvable, e.g. stale library import) */
  oldVariableName?: string;
  /** Whether this is a stale-but-resolvable binding vs fully broken */
  kind: 'stale' | 'broken';
  /** Number of nodes using this binding */
  usageCount: number;
  /** Suggested replacement variable, if one was found */
  suggestedVariable?: {
    id: string;
    name: string;
    collection: string;
    matchMethod: 'name' | 'value' | 'name+value';
    confidence: 'high' | 'medium' | 'low';
  };
  /** Whether the user has confirmed this remap */
  confirmed: boolean;
  /** The current visual value read from a representative node */
  currentValue?: string;
  /** Property type hint (e.g., 'fills[0]', 'paddingTop') */
  propertyHint?: string;
  /** Node type hint for context scoring */
  nodeTypeHint?: string;
}

/**
 * Result of scanning for broken variable bindings
 */
export interface RemapScanResult {
  /** Total variable bindings inspected */
  totalBindings: number;
  /** Bindings pointing to healthy local variables */
  validBindings: number;
  /** Bindings where the variable ID doesn't resolve at all */
  brokenBindings: number;
  /** Bindings that resolve to a remote/cached var but a local replacement exists */
  staleBindings: number;
  /** Grouped entries (stale + broken) with suggestions */
  remapEntries: RemapEntry[];
}

/**
 * Result of applying remap operations
 */
export interface RemapApplyResult {
  /** Number of bindings successfully remapped */
  remapped: number;
  /** Number of bindings that failed to remap */
  failed: number;
  /** Error messages for failures */
  errors: string[];
}

/**
 * Default configuration
 */
export function getDefaultConfig(): LintConfig {
  return {
    rules: {
      'no-hardcoded-colors': { enabled: true, severity: 'error' },
      'no-hardcoded-typography': { enabled: true, severity: 'warning' },
      'no-hardcoded-spacing': { enabled: true, severity: 'warning' },
      'no-hardcoded-radii': { enabled: true, severity: 'warning' },
      'no-hardcoded-stroke-weight': { enabled: true, severity: 'warning' },
      'no-hardcoded-sizing': { enabled: true, severity: 'warning' },
      'no-orphaned-variables': { enabled: true, severity: 'error' },
      'no-unknown-styles': { enabled: true, severity: 'warning' },
      'prefer-semantic-variables': { enabled: true, severity: 'info' },
    },
    skipHiddenLayers: true,
    skipLockedLayers: false,
  };
}
