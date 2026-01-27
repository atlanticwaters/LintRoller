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
  actionType: 'rebind' | 'unbind' | 'detach';
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
  | AutoFixPathMismatchesMessage;

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
  actionType?: 'rebind' | 'unbind' | 'detach';
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
  | BulkDetachCompleteMessage;
