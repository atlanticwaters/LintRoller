/**
 * Message types for Plugin <-> UI communication
 */

import type { LintConfig, LintResults, ScanScope } from './types';

/**
 * Detailed information about a fix action for activity logging
 */
export interface FixActionDetail {
  nodeId: string;
  nodeName: string;
  property: string;
  actionType: 'rebind' | 'unbind' | 'detach' | 'apply-style' | 'ignore';
  beforeValue: string;
  afterValue: string;
  status: 'success' | 'failed';
  errorMessage?: string;
  timestamp: number;
}

// Messages from UI to Plugin

export interface StartScanMessage {
  type: 'START_SCAN';
  scope: ScanScope;
  config: LintConfig;
}

export interface SelectNodeMessage {
  type: 'SELECT_NODE';
  nodeId: string;
}

export interface ExportResultsMessage {
  type: 'EXPORT_RESULTS';
  format: 'json' | 'csv';
}

export interface UpdateConfigMessage {
  type: 'UPDATE_CONFIG';
  config: LintConfig;
}

export interface GetTokensMessage {
  type: 'GET_TOKENS';
}

export interface ApplyFixMessage {
  type: 'APPLY_FIX';
  nodeId: string;
  property: string;
  tokenPath: string;
  ruleId: string;
}

export interface UnbindVariableMessage {
  type: 'UNBIND_VARIABLE';
  nodeId: string;
  property: string;
}

export interface DetachStyleMessage {
  type: 'DETACH_STYLE';
  nodeId: string;
  property: string;
}

export interface BulkDetachStylesMessage {
  type: 'BULK_DETACH_STYLES';
  detaches: Array<{
    nodeId: string;
    property: string;
  }>;
}

export interface ApplyBulkFixMessage {
  type: 'APPLY_BULK_FIX';
  fixes: Array<{
    nodeId: string;
    property: string;
    tokenPath: string;
    ruleId: string;
  }>;
}

export interface AutoFixPathMismatchesMessage {
  type: 'AUTO_FIX_PATH_MISMATCHES';
  fixes: Array<{
    nodeId: string;
    property: string;
    tokenPath: string;
  }>;
}

export interface ApplyTextStyleMessage {
  type: 'APPLY_TEXT_STYLE';
  nodeId: string;
  textStyleId: string;
  /** Original property from the violation (e.g., 'fontSize', 'lineHeight') for tracking fixes */
  property: string;
}

/** Message sent from UI to plugin with loaded token files */
export interface TokenFilesLoadedMessage {
  type: 'TOKEN_FILES_LOADED';
  files: Array<{
    path: string;
    content: Record<string, unknown>;
  }>;
}

/** Message to save ignored violations to persistent storage */
export interface SaveIgnoredViolationsMessage {
  type: 'SAVE_IGNORED_VIOLATIONS';
  /** Array of violation keys in format "nodeId:property" */
  ignoredKeys: string[];
}

/** Message to request loading ignored violations from storage */
export interface LoadIgnoredViolationsMessage {
  type: 'LOAD_IGNORED_VIOLATIONS';
}

// Sync-related messages

/** Options for sync operation */
export interface SyncOptionsMessage {
  createNew?: boolean;
  updateExisting?: boolean;
  deleteOrphans?: boolean;
  collectionNames?: {
    core?: string;
    semantic?: string;
    component?: string;
  };
}

/** Request sync status */
export interface GetSyncStatusMessage {
  type: 'GET_SYNC_STATUS';
}

/** Request sync diff analysis */
export interface GetSyncDiffMessage {
  type: 'GET_SYNC_DIFF';
  options?: SyncOptionsMessage;
}

/** Start full sync operation */
export interface StartSyncMessage {
  type: 'START_SYNC';
  options?: SyncOptionsMessage;
}

/** Reset variables to match token source */
export interface ResetVariablesMessage {
  type: 'RESET_VARIABLES';
}

export type UIToPluginMessage =
  | StartScanMessage
  | SelectNodeMessage
  | ExportResultsMessage
  | UpdateConfigMessage
  | GetTokensMessage
  | ApplyFixMessage
  | ApplyBulkFixMessage
  | UnbindVariableMessage
  | DetachStyleMessage
  | BulkDetachStylesMessage
  | AutoFixPathMismatchesMessage
  | ApplyTextStyleMessage
  | TokenFilesLoadedMessage
  | SaveIgnoredViolationsMessage
  | LoadIgnoredViolationsMessage
  | GetSyncStatusMessage
  | GetSyncDiffMessage
  | StartSyncMessage
  | ResetVariablesMessage;

// Messages from Plugin to UI

export interface ScanStartedMessage {
  type: 'SCAN_STARTED';
  totalNodes: number;
}

export interface ScanProgressMessage {
  type: 'SCAN_PROGRESS';
  processed: number;
  total: number;
}

export interface ScanCompleteMessage {
  type: 'SCAN_COMPLETE';
  results: LintResults;
}

export interface NodeSelectedMessage {
  type: 'NODE_SELECTED';
  success: boolean;
}

export interface ErrorMessage {
  type: 'ERROR';
  message: string;
}

export interface TokensLoadedMessage {
  type: 'TOKENS_LOADED';
  tokenCount: number;
  tokenPaths: string[];
}

export interface FixAppliedMessage {
  type: 'FIX_APPLIED';
  success: boolean;
  nodeId: string;
  property: string;
  message?: string;
  /** Node name for display purposes */
  nodeName?: string;
  /** Value before the fix was applied */
  beforeValue?: string;
  /** Value after the fix was applied */
  afterValue?: string;
  /** Type of fix action performed */
  actionType?: 'rebind' | 'unbind' | 'detach' | 'apply-style';
}

export interface FixProgressMessage {
  type: 'FIX_PROGRESS';
  current: number;
  total: number;
  currentAction: FixActionDetail;
}

export interface BulkFixCompleteMessage {
  type: 'BULK_FIX_COMPLETE';
  successful: number;
  failed: number;
  errors: string[];
  /** Detailed list of all fix actions performed */
  actions?: FixActionDetail[];
}

export interface BulkDetachCompleteMessage {
  type: 'BULK_DETACH_COMPLETE';
  successful: number;
  failed: number;
  errors: string[];
}

/** Message returning loaded ignored violations from storage */
export interface IgnoredViolationsLoadedMessage {
  type: 'IGNORED_VIOLATIONS_LOADED';
  /** Array of violation keys in format "nodeId:property" */
  ignoredKeys: string[];
}

// Sync response messages

/** Sync status response */
export interface SyncStatusMessage {
  type: 'SYNC_STATUS';
  totalTokens: number;
  totalVariables: number;
  collections: Array<{
    name: string;
    layer: string;
    variableCount: number;
    modeCount: number;
  }>;
  syncedPercentage: number;
}

/** Sync diff analysis response */
export interface SyncDiffMessage {
  type: 'SYNC_DIFF';
  toCreate: Array<{ path: string; layer: string; value: string | number }>;
  toUpdate: Array<{ path: string; layer: string; oldValue: string | number; newValue: string | number }>;
  toDelete: Array<{ path: string; layer: string; variableId: string }>;
  unchanged: number;
}

/** Sync progress update */
export interface SyncProgressMessage {
  type: 'SYNC_PROGRESS';
  phase: 'analyzing' | 'creating' | 'updating' | 'deleting' | 'complete';
  current: number;
  total: number;
  message: string;
}

/** Sync complete response */
export interface SyncCompleteMessage {
  type: 'SYNC_COMPLETE';
  success: boolean;
  created: number;
  updated: number;
  deleted: number;
  skipped: number;
  errors: string[];
  collections: Array<{
    collectionId: string;
    collectionName: string;
    layer: 'core' | 'semantic' | 'component';
    variablesCreated: number;
    variablesUpdated: number;
    variablesDeleted: number;
  }>;
}

export type PluginToUIMessage =
  | ScanStartedMessage
  | ScanProgressMessage
  | ScanCompleteMessage
  | NodeSelectedMessage
  | ErrorMessage
  | TokensLoadedMessage
  | FixAppliedMessage
  | FixProgressMessage
  | BulkFixCompleteMessage
  | BulkDetachCompleteMessage
  | IgnoredViolationsLoadedMessage
  | SyncStatusMessage
  | SyncDiffMessage
  | SyncProgressMessage
  | SyncCompleteMessage;
