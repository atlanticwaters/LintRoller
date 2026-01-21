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
import { FigmaScanner, processInChunks } from './scanner';
import { PropertyInspector } from './inspector';
import { createRules } from './rules';
import { getLocalVariables, buildMatchedVariableIdSet } from './variables';
import { loadAllTokenData } from './tokens-data';
import { applyFix, applyBulkFix, unbindVariable, detachStyle, bulkDetachStyles } from './fixer';

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
 * Initialize tokens from remote GitHub Pages
 */
async function initializeTokens(): Promise<void> {
  if (isLoadingTokens) return;
  isLoadingTokens = true;

  try {
    console.log('Loading tokens from GitHub Pages...');

    // Load all token data from remote
    const { metadata, themes, files } = await loadAllTokenData();

    // Store theme configs for later use
    loadedThemeConfigs = themes;

    // Parse tokens
    const parser = new TokenParser();
    tokenCollection = parser.parseTokenFiles(files, metadata);

    console.log(`Loaded ${tokenCollection.tokens.size} tokens from ${files.length} files`);

    postMessage({
      type: 'TOKENS_LOADED',
      tokenCount: tokenCollection.tokens.size,
      tokenPaths: Array.from(tokenCollection.tokens.keys()),
    });
  } catch (error) {
    console.error('Failed to initialize tokens:', error);
    postMessage({
      type: 'ERROR',
      message: `Failed to load tokens: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
        // Retry loading if not loaded yet
        initializeTokens();
      }
      break;

    case 'EXPORT_RESULTS':
      // Export is handled client-side in the UI
      break;

    case 'APPLY_FIX':
      {
        console.log('[Plugin] APPLY_FIX:', msg.nodeId, msg.property, msg.tokenPath, msg.ruleId);
        console.log('[Plugin] Theme configs available:', loadedThemeConfigs.length);
        try {
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
        const bulkResult = await applyBulkFix(msg.fixes, loadedThemeConfigs);
        postMessage({
          type: 'BULK_FIX_COMPLETE',
          successful: bulkResult.successful,
          failed: bulkResult.failed,
          errors: bulkResult.errors,
        });
      }
      break;

    case 'UNBIND_VARIABLE':
      {
        const unbindResult = await unbindVariable(msg.nodeId, msg.property);
        postMessage({
          type: 'FIX_APPLIED',
          success: unbindResult.success,
          nodeId: msg.nodeId,
          property: msg.property,
          message: unbindResult.message,
        });
      }
      break;

    case 'DETACH_STYLE':
      {
        const detachResult = await detachStyle(msg.nodeId, msg.property);
        postMessage({
          type: 'FIX_APPLIED',
          success: detachResult.success,
          nodeId: msg.nodeId,
          property: msg.property,
          message: detachResult.message,
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
  }
};

// Initialize tokens on startup
initializeTokens();
