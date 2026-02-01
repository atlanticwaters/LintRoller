/**
 * Figma Plugin Main Entry Point
 *
 * Initializes the plugin, handles UI communication, and coordinates scanning.
 */

import type {
  LintConfig,
  LintResults,
  LintRuleId,
  LintSummary,
  LintViolation,
  ScanScope,
  Severity,
  TokenCollection,
  ThemeConfig,
} from '../shared/types';
import { getDefaultConfig } from '../shared/types';
import type { UIToPluginMessage, PluginToUIMessage } from '../shared/messages';
import { TokenParser } from '../shared/token-parser';
import { FigmaScanner } from './scanner';
import { PropertyInspector } from './inspector';
import { createRules } from './rules';
import { getLocalVariables, buildMatchedVariableIdSet } from './variables';
import { applyFix, applyBulkFix, unbindVariable, detachStyle, bulkDetachStyles, applyTextStyle } from './fixer';
import { clearTextStyleCache } from './rules/no-hardcoded-typography';
import { syncTokensToVariables, resetVariables, getSyncStatus, analyzeSyncDiff } from './sync';

// Plugin state
let tokenCollection: TokenCollection | null = null;
let loadedThemeConfigs: ThemeConfig[] = [];
let currentConfig: LintConfig = getDefaultConfig();
let isLoadingTokens = false;

/**
 * Send message to UI
 */
function postMessage(message: PluginToUIMessage): void {
  figma.ui.postMessage(message);
}

/**
 * Initialize the plugin UI
 */
figma.showUI(__html__, {
  width: 420,
  height: 600,
  themeColors: false,
});

/**
 * Process token files received from the UI
 * (UI fetches tokens to avoid CSP restrictions in the plugin sandbox)
 */
function processTokenFiles(files: Array<{ path: string; content: Record<string, unknown> }>): void {
  if (isLoadingTokens) return;
  isLoadingTokens = true;

  try {
    console.log('[Plugin] Processing token files from UI...');

    // Parse tokens
    const parser = new TokenParser();
    tokenCollection = parser.parseTokenFiles(files);

    console.log(`[Plugin] Loaded ${tokenCollection.tokens.size} tokens from ${files.length} files`);
    console.log(`[Plugin] Color values in index: ${tokenCollection.colorValues.size}`);
    console.log(`[Plugin] Number values in index: ${tokenCollection.numberValues.size}`);

    // Debug: Show some sample color tokens
    if (tokenCollection.colorValues.size > 0) {
      const sampleColors = Array.from(tokenCollection.colorValues.entries()).slice(0, 10);
      console.log('[Plugin] Sample color tokens (semantic preferred):', sampleColors);

      // Count how many are semantic vs core
      let semanticCount = 0;
      let coreCount = 0;
      for (const tokenPath of tokenCollection.colorValues.values()) {
        if (tokenPath.startsWith('system.') || tokenPath.startsWith('component.')) {
          semanticCount++;
        } else {
          coreCount++;
        }
      }
      console.log(`[Plugin] Color token index: ${semanticCount} semantic, ${coreCount} core`);
    } else {
      console.warn('[Plugin] No color tokens found! Checking token types...');
      const colorTokens = tokenCollection.byType.get('color') || [];
      console.log(`[Plugin] Tokens with type "color": ${colorTokens.length}`);
      if (colorTokens.length > 0) {
        console.log('[Plugin] Sample color tokens by type:', colorTokens.slice(0, 3).map(t => ({
          path: t.path,
          resolvedValue: t.resolvedValue,
          type: t.type
        })));
      }
    }

    postMessage({
      type: 'TOKENS_LOADED',
      tokenCount: tokenCollection.tokens.size,
      tokenPaths: Array.from(tokenCollection.tokens.keys()),
    });
  } catch (error) {
    console.error('[Plugin] Failed to process tokens:', error);
    postMessage({
      type: 'ERROR',
      message: `Failed to process tokens: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  } finally {
    isLoadingTokens = false;
  }
}

/**
 * Build summary statistics from violations
 */
function buildSummary(violations: LintViolation[]): LintSummary {
  const byRule: Record<LintRuleId, number> = {
    'no-hardcoded-colors': 0,
    'no-hardcoded-typography': 0,
    'no-hardcoded-spacing': 0,
    'no-hardcoded-radii': 0,
    'no-orphaned-variables': 0,
    'no-unknown-styles': 0,
  };

  const bySeverity: Record<Severity, number> = {
    error: 0,
    warning: 0,
    info: 0,
  };

  for (const violation of violations) {
    byRule[violation.ruleId]++;
    bySeverity[violation.severity]++;
  }

  return {
    total: violations.length,
    byRule,
    bySeverity,
  };
}

/**
 * Handle scan request from UI
 */
async function handleStartScan(scope: ScanScope, config: LintConfig): Promise<void> {
  if (!tokenCollection) {
    postMessage({ type: 'ERROR', message: 'Tokens not loaded yet. Please wait...' });
    return;
  }

  const startTime = Date.now();

  try {
    // Clear cached text styles so they're reloaded for this scan
    clearTextStyleCache();

    // Update config
    currentConfig = config;

    // Initialize scanner and inspector
    const scanner = new FigmaScanner(config);
    const inspector = new PropertyInspector();

    // Load Figma variables for orphan detection
    const figmaVariables = await getLocalVariables();

    // Build set of variable IDs that have matching tokens (using normalized path comparison)
    const matchedVariableIds = buildMatchedVariableIdSet(figmaVariables, tokenCollection);
    console.log(`Found ${matchedVariableIds.size} variables with matching tokens out of ${figmaVariables.size} total`);

    // Create rules
    const rules = createRules(config, tokenCollection, figmaVariables, matchedVariableIds);

    // Gather nodes
    const nodes = await scanner.gatherNodes(scope);

    postMessage({
      type: 'SCAN_STARTED',
      totalNodes: nodes.length,
    });

    // Process nodes and collect violations
    const violations: LintViolation[] = [];

    // Process nodes sequentially to handle async rules
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];

      // Inspect all properties
      const inspections = inspector.inspectNode(node);

      // Run all enabled rules (some may be async)
      for (const rule of rules) {
        const ruleViolations = await rule.check(node, inspections);
        violations.push(...ruleViolations);
      }

      // Report progress every 50 nodes
      if (i % 50 === 0 || i === nodes.length - 1) {
        postMessage({
          type: 'SCAN_PROGRESS',
          processed: i + 1,
          total: nodes.length,
        });

        // Yield to prevent blocking
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    // Build results
    const results: LintResults = {
      violations,
      summary: buildSummary(violations),
      metadata: {
        scannedNodes: nodes.length,
        scanDurationMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      },
    };

    postMessage({ type: 'SCAN_COMPLETE', results });
  } catch (error) {
    console.error('Scan failed:', error);
    postMessage({
      type: 'ERROR',
      message: error instanceof Error ? error.message : 'Unknown error during scan',
    });
  }
}

/**
 * Handle node selection request from UI
 */
async function handleSelectNode(nodeId: string): Promise<void> {
  const success = await FigmaScanner.selectNode(nodeId);
  postMessage({ type: 'NODE_SELECTED', success });
}

/**
 * Handle messages from UI
 */
figma.ui.onmessage = async (msg: UIToPluginMessage) => {
  console.log('[Plugin] Received message:', msg.type, msg);

  switch (msg.type) {
    case 'START_SCAN':
      await handleStartScan(msg.scope, msg.config);
      break;

    case 'SELECT_NODE':
      await handleSelectNode(msg.nodeId);
      break;

    case 'UPDATE_CONFIG':
      currentConfig = msg.config;
      break;

    case 'GET_TOKENS':
      if (tokenCollection) {
        postMessage({
          type: 'TOKENS_LOADED',
          tokenCount: tokenCollection.tokens.size,
          tokenPaths: Array.from(tokenCollection.tokens.keys()),
        });
      } else {
        // Tokens not loaded yet - UI should send them
        postMessage({
          type: 'ERROR',
          message: 'Tokens not loaded yet. Please wait for UI to load tokens.',
        });
      }
      break;

    case 'TOKEN_FILES_LOADED':
      processTokenFiles(msg.files);
      break;

    case 'EXPORT_RESULTS':
      // Export is handled client-side in the UI
      break;

    case 'APPLY_FIX':
      {
        console.log('[Plugin] APPLY_FIX:', msg.nodeId, msg.property, msg.tokenPath, msg.ruleId);
        console.log('[Plugin] Theme configs available:', loadedThemeConfigs.length);
        try {
          // Get node name for display
          let nodeName = 'Unknown';
          const node = await figma.getNodeByIdAsync(msg.nodeId);
          if (node && 'name' in node) {
            nodeName = node.name;
          }

          const result = await applyFix(
            msg.nodeId,
            msg.property,
            msg.tokenPath,
            msg.ruleId as LintRuleId,
            loadedThemeConfigs
          );
          console.log('[Plugin] APPLY_FIX result:', result);
          postMessage({
            type: 'FIX_APPLIED',
            success: result.success,
            nodeId: msg.nodeId,
            property: msg.property,
            message: result.message || (result.success ? undefined : 'Fix failed'),
            nodeName,
            beforeValue: result.beforeValue,
            afterValue: result.afterValue,
            actionType: result.actionType,
          });
        } catch (error) {
          console.error('[Plugin] APPLY_FIX error:', error);
          postMessage({
            type: 'FIX_APPLIED',
            success: false,
            nodeId: msg.nodeId,
            property: msg.property,
            message: 'Error: ' + (error instanceof Error ? error.message : 'Unknown error'),
          });
        }
      }
      break;

    case 'APPLY_BULK_FIX':
      {
        const bulkResult = await applyBulkFix(
          msg.fixes,
          loadedThemeConfigs,
          (progress) => {
            postMessage({
              type: 'FIX_PROGRESS',
              current: progress.current,
              total: progress.total,
              currentAction: progress.currentAction,
            });
          }
        );
        postMessage({
          type: 'BULK_FIX_COMPLETE',
          successful: bulkResult.successful,
          failed: bulkResult.failed,
          errors: bulkResult.errors,
          actions: bulkResult.actions,
        });
      }
      break;

    case 'UNBIND_VARIABLE':
      {
        // Get node name for display
        let nodeName = 'Unknown';
        const unbindNode = await figma.getNodeByIdAsync(msg.nodeId);
        if (unbindNode && 'name' in unbindNode) {
          nodeName = unbindNode.name;
        }

        const unbindResult = await unbindVariable(msg.nodeId, msg.property);
        postMessage({
          type: 'FIX_APPLIED',
          success: unbindResult.success,
          nodeId: msg.nodeId,
          property: msg.property,
          message: unbindResult.message,
          nodeName,
          beforeValue: unbindResult.beforeValue,
          afterValue: unbindResult.afterValue,
          actionType: unbindResult.actionType,
        });
      }
      break;

    case 'DETACH_STYLE':
      {
        // Get node name for display
        let detachNodeName = 'Unknown';
        const detachNode = await figma.getNodeByIdAsync(msg.nodeId);
        if (detachNode && 'name' in detachNode) {
          detachNodeName = detachNode.name;
        }

        const detachResult = await detachStyle(msg.nodeId, msg.property);
        postMessage({
          type: 'FIX_APPLIED',
          success: detachResult.success,
          nodeId: msg.nodeId,
          property: msg.property,
          message: detachResult.message,
          nodeName: detachNodeName,
          beforeValue: detachResult.beforeValue,
          afterValue: detachResult.afterValue,
          actionType: detachResult.actionType,
        });
      }
      break;

    case 'BULK_DETACH_STYLES':
      {
        const bulkDetachResult = await bulkDetachStyles(msg.detaches);
        postMessage({
          type: 'BULK_DETACH_COMPLETE',
          successful: bulkDetachResult.successful,
          failed: bulkDetachResult.failed,
          errors: bulkDetachResult.errors,
        });
      }
      break;

    case 'AUTO_FIX_PATH_MISMATCHES':
      {
        // Auto-fix path mismatches uses the same bulk fix mechanism
        // but with a specific rule ID for path mismatches
        const pathMismatchFixes = msg.fixes.map(fix => ({
          nodeId: fix.nodeId,
          property: fix.property,
          tokenPath: fix.tokenPath,
          ruleId: 'no-orphaned-variables' as const,
        }));

        const pathMismatchResult = await applyBulkFix(
          pathMismatchFixes,
          loadedThemeConfigs,
          (progress) => {
            postMessage({
              type: 'FIX_PROGRESS',
              current: progress.current,
              total: progress.total,
              currentAction: progress.currentAction,
            });
          }
        );
        postMessage({
          type: 'BULK_FIX_COMPLETE',
          successful: pathMismatchResult.successful,
          failed: pathMismatchResult.failed,
          errors: pathMismatchResult.errors,
          actions: pathMismatchResult.actions,
        });
      }
      break;

    case 'APPLY_TEXT_STYLE':
      {
        console.log('[Plugin] APPLY_TEXT_STYLE:', msg.nodeId, msg.textStyleId, msg.property);
        const result = await applyTextStyle(msg.nodeId, msg.textStyleId);

        // Get node name for display
        let nodeName = 'Unknown';
        try {
          const node = await figma.getNodeByIdAsync(msg.nodeId);
          if (node && 'name' in node) {
            nodeName = node.name;
          }
        } catch {
          // Ignore error
        }

        postMessage({
          type: 'FIX_APPLIED',
          success: result.success,
          nodeId: msg.nodeId,
          property: msg.property,
          message: result.message,
          nodeName,
          beforeValue: result.beforeValue,
          afterValue: result.afterValue,
          actionType: result.actionType,
        });
      }
      break;

    case 'SAVE_IGNORED_VIOLATIONS':
      {
        try {
          await figma.clientStorage.setAsync('ignoredViolations', msg.ignoredKeys);
          console.log('[Plugin] Saved', msg.ignoredKeys.length, 'ignored violations to storage');
        } catch (error) {
          console.error('[Plugin] Failed to save ignored violations:', error);
        }
      }
      break;

    case 'LOAD_IGNORED_VIOLATIONS':
      {
        try {
          const ignoredKeys = await figma.clientStorage.getAsync('ignoredViolations') as string[] | undefined;
          postMessage({
            type: 'IGNORED_VIOLATIONS_LOADED',
            ignoredKeys: ignoredKeys || [],
          });
          console.log('[Plugin] Loaded', (ignoredKeys || []).length, 'ignored violations from storage');
        } catch (error) {
          console.error('[Plugin] Failed to load ignored violations:', error);
          postMessage({
            type: 'IGNORED_VIOLATIONS_LOADED',
            ignoredKeys: [],
          });
        }
      }
      break;

    case 'GET_SYNC_STATUS':
      {
        if (!tokenCollection) {
          postMessage({ type: 'ERROR', message: 'Tokens not loaded yet' });
          break;
        }
        try {
          const status = await getSyncStatus(tokenCollection);
          postMessage({
            type: 'SYNC_STATUS',
            ...status,
          });
        } catch (error) {
          console.error('[Plugin] Failed to get sync status:', error);
          postMessage({ type: 'ERROR', message: 'Failed to get sync status' });
        }
      }
      break;

    case 'GET_SYNC_DIFF':
      {
        if (!tokenCollection) {
          postMessage({ type: 'ERROR', message: 'Tokens not loaded yet' });
          break;
        }
        try {
          const diff = await analyzeSyncDiff(tokenCollection, loadedThemeConfigs, msg.options);
          postMessage({
            type: 'SYNC_DIFF',
            ...diff,
          });
        } catch (error) {
          console.error('[Plugin] Failed to analyze sync diff:', error);
          postMessage({ type: 'ERROR', message: 'Failed to analyze sync diff' });
        }
      }
      break;

    case 'START_SYNC':
      {
        if (!tokenCollection) {
          postMessage({ type: 'ERROR', message: 'Tokens not loaded yet' });
          break;
        }
        try {
          console.log('[Plugin] Starting sync with options:', msg.options);
          const result = await syncTokensToVariables(
            tokenCollection,
            loadedThemeConfigs,
            msg.options,
            (progress) => {
              postMessage({
                type: 'SYNC_PROGRESS',
                ...progress,
              });
            }
          );
          postMessage({
            type: 'SYNC_COMPLETE',
            ...result,
          });
        } catch (error) {
          console.error('[Plugin] Sync failed:', error);
          postMessage({
            type: 'SYNC_COMPLETE',
            success: false,
            created: 0,
            updated: 0,
            deleted: 0,
            skipped: 0,
            errors: [error instanceof Error ? error.message : 'Unknown error'],
            collections: [],
          });
        }
      }
      break;

    case 'RESET_VARIABLES':
      {
        if (!tokenCollection) {
          postMessage({ type: 'ERROR', message: 'Tokens not loaded yet' });
          break;
        }
        try {
          console.log('[Plugin] Resetting variables to match token source');
          const result = await resetVariables(
            tokenCollection,
            loadedThemeConfigs,
            (progress) => {
              postMessage({
                type: 'SYNC_PROGRESS',
                ...progress,
              });
            }
          );
          postMessage({
            type: 'SYNC_COMPLETE',
            ...result,
          });
        } catch (error) {
          console.error('[Plugin] Reset failed:', error);
          postMessage({
            type: 'SYNC_COMPLETE',
            success: false,
            created: 0,
            updated: 0,
            deleted: 0,
            skipped: 0,
            errors: [error instanceof Error ? error.message : 'Unknown error'],
            collections: [],
          });
        }
      }
      break;
  }
};

// Tokens are now loaded by the UI and sent via TOKEN_FILES_LOADED message
console.log('[Plugin] Ready. Waiting for UI to send token files...');
