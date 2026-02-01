/**
 * Main Application Component
 */

import { useState, useEffect, useCallback } from 'preact/hooks';
import type {
  LintConfig,
  LintResults,
  LintViolation,
  ScanScope,
} from '../shared/types';
import { getDefaultConfig } from '../shared/types';
import type { PluginToUIMessage, UIToPluginMessage, FixActionDetail } from '../shared/messages';
import { Header } from './components/Header';
import { Summary } from './components/Summary';
import { ProgressBar } from './components/ProgressBar';
import { FixStatusBar } from './components/FixStatusBar';
import { ActivityLog } from './components/ActivityLog';
import { ResultsList } from './components/ResultsList';
import { ConfigPanel } from './components/ConfigPanel';
import { SyncPanel } from './components/SyncPanel';
import { loadTokenFiles } from './tokens-loader';

type View = 'results' | 'config' | 'sync';

export function App() {
  const [config, setConfig] = useState<LintConfig>(getDefaultConfig());
  const [results, setResults] = useState<LintResults | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isFixing, setIsFixing] = useState(false);
  const [progress, setProgress] = useState({ processed: 0, total: 0 });
  const [scope, setScope] = useState<ScanScope['type']>('current_page');
  const [view, setView] = useState<View>('results');
  const [groupBy, setGroupBy] = useState<'rule' | 'node'>('rule');
  const [tokenCount, setTokenCount] = useState(0);
  const [fixedViolations, setFixedViolations] = useState<Set<string>>(new Set());
  const [ignoredViolations, setIgnoredViolations] = useState<Set<string>>(new Set());
  const [fixActions, setFixActions] = useState<FixActionDetail[]>([]);
  const [fixProgress, setFixProgress] = useState<{ current: number; total: number } | null>(null);
  const [showActivityLog, setShowActivityLog] = useState(false);
  const [ignoredViolationsLoaded, setIgnoredViolationsLoaded] = useState(false);

  // Send message to plugin
  const postMessage = useCallback((message: UIToPluginMessage) => {
    parent.postMessage({ pluginMessage: message }, '*');
  }, []);

  // Start a scan
  const handleScan = useCallback(() => {
    setIsScanning(true);
    setResults(null);
    postMessage({
      type: 'START_SCAN',
      scope: { type: scope },
      config,
    });
  }, [scope, config, postMessage]);

  // Handle messages from plugin
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const msg = event.data.pluginMessage as PluginToUIMessage;
      if (!msg) return;

      switch (msg.type) {
        case 'SCAN_STARTED':
          setProgress({ processed: 0, total: msg.totalNodes });
          setFixedViolations(new Set()); // Reset fixed violations on new scan
          // Note: Do NOT reset ignoredViolations - they persist across scans
          setFixActions([]); // Reset activity log on new scan
          setFixProgress(null);
          setShowActivityLog(false);
          break;

        case 'SCAN_PROGRESS':
          setProgress({ processed: msg.processed, total: msg.total });
          break;

        case 'SCAN_COMPLETE':
          setResults(msg.results);
          setIsScanning(false);
          setView('results');
          break;

        case 'NODE_SELECTED':
          // Could show feedback if selection failed
          break;

        case 'TOKENS_LOADED':
          setTokenCount(msg.tokenCount);
          break;

        case 'FIX_APPLIED':
          console.log('[UI] FIX_APPLIED received:', msg);
          setIsFixing(false);
          setFixProgress(null);

          // Add to activity log
          const fixAction: FixActionDetail = {
            nodeId: msg.nodeId,
            nodeName: msg.nodeName || 'Unknown',
            property: msg.property,
            actionType: msg.actionType || 'rebind',
            beforeValue: msg.beforeValue || 'unknown',
            afterValue: msg.afterValue || 'unknown',
            status: msg.success ? 'success' : 'failed',
            errorMessage: msg.message,
            timestamp: Date.now(),
          };
          setFixActions(prev => [...prev, fixAction]);

          if (msg.success) {
            // Mark violations as fixed
            setFixedViolations(prev => {
              const next = new Set(prev);
              // Create a unique key for this violation
              const key = msg.nodeId + ':' + msg.property;
              next.add(key);

              // If this was a text style application, mark ALL typography violations
              // for the same node as fixed, since text styles affect all typography properties
              if (msg.actionType === 'apply-style') {
                const typographyProps = ['fontSize', 'lineHeight', 'letterSpacing'];
                for (const prop of typographyProps) {
                  next.add(msg.nodeId + ':' + prop);
                }
              }

              return next;
            });
          } else {
            // Always show error, even if message is undefined
            const errorMsg = msg.message || 'Unknown error occurred';
            console.error('Fix failed:', errorMsg);
            alert('Fix failed: ' + errorMsg);
          }
          break;

        case 'FIX_PROGRESS':
          setFixProgress({ current: msg.current, total: msg.total });
          // Add current action to activity log
          setFixActions(prev => [...prev, msg.currentAction]);
          break;

        case 'BULK_FIX_COMPLETE':
          setIsFixing(false);
          setFixProgress(null);

          // Actions are already added via FIX_PROGRESS, but add any that might be missing
          if (msg.actions && msg.actions.length > 0) {
            // The actions are already in the log from FIX_PROGRESS messages
            // But we can show the activity log automatically
            setShowActivityLog(true);
          }

          if (msg.failed > 0) {
            console.error('Bulk fix errors:', msg.errors);
            alert('Fixed ' + msg.successful + ' issues. ' + msg.failed + ' failed.\n\n' + msg.errors.slice(0, 3).join('\n'));
          }
          // Re-scan to update results
          if (msg.successful > 0) {
            handleScan();
          }
          break;

        case 'BULK_DETACH_COMPLETE':
          setIsFixing(false);
          if (msg.failed > 0) {
            console.error('Bulk detach errors:', msg.errors);
            alert('Detached ' + msg.successful + ' styles. ' + msg.failed + ' failed.\n\n' + msg.errors.slice(0, 3).join('\n'));
          }
          // Re-scan to update results
          if (msg.successful > 0) {
            handleScan();
          }
          break;

        case 'IGNORED_VIOLATIONS_LOADED':
          // Restore ignored violations from storage
          setIgnoredViolations(new Set(msg.ignoredKeys));
          setIgnoredViolationsLoaded(true);
          console.log('[UI] Loaded', msg.ignoredKeys.length, 'ignored violations from storage');
          break;

        case 'ERROR':
          console.error('Plugin error:', msg.message);
          setIsScanning(false);
          setIsFixing(false);
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handleScan]);

  // Load tokens on mount and send to plugin
  useEffect(() => {
    async function loadAndSendTokens() {
      try {
        console.log('[UI] Starting token load...');
        const files = await loadTokenFiles();
        console.log('[UI] Token files loaded, sending to plugin...');
        postMessage({
          type: 'TOKEN_FILES_LOADED',
          files: files.map(f => ({
            path: f.path,
            content: f.content,
          })),
        });
      } catch (error) {
        console.error('[UI] Failed to load tokens:', error);
      }
    }
    loadAndSendTokens();
  }, [postMessage]);

  // Load ignored violations from storage on mount
  useEffect(() => {
    postMessage({ type: 'LOAD_IGNORED_VIOLATIONS' });
  }, [postMessage]);

  // Save ignored violations to storage whenever they change
  useEffect(() => {
    // Only save after initial load from storage completes
    if (!ignoredViolationsLoaded) return;

    postMessage({
      type: 'SAVE_IGNORED_VIOLATIONS',
      ignoredKeys: Array.from(ignoredViolations),
    });
  }, [ignoredViolations, ignoredViolationsLoaded, postMessage]);

  // Select a node in Figma
  const handleSelectNode = useCallback(
    (nodeId: string) => {
      postMessage({ type: 'SELECT_NODE', nodeId });
    },
    [postMessage]
  );

  // Apply a fix to a single violation
  const handleFix = useCallback(
    (violation: LintViolation) => {
      if (!violation.suggestedToken) return;

      setIsFixing(true);
      postMessage({
        type: 'APPLY_FIX',
        nodeId: violation.nodeId,
        property: violation.property,
        tokenPath: violation.suggestedToken,
        ruleId: violation.ruleId,
      });
    },
    [postMessage]
  );

  // Apply fixes to multiple violations
  const handleBulkFix = useCallback(
    (violations: LintViolation[]) => {
      const fixable = violations.filter(v => v.suggestedToken);
      if (fixable.length === 0) return;

      setIsFixing(true);
      postMessage({
        type: 'APPLY_BULK_FIX',
        fixes: fixable.map(v => ({
          nodeId: v.nodeId,
          property: v.property,
          tokenPath: v.suggestedToken!,
          ruleId: v.ruleId,
        })),
      });
    },
    [postMessage]
  );

  // Unbind a variable from a node (for orphaned variables)
  const handleUnbind = useCallback(
    (violation: LintViolation) => {
      setIsFixing(true);
      postMessage({
        type: 'UNBIND_VARIABLE',
        nodeId: violation.nodeId,
        property: violation.property,
      });
    },
    [postMessage]
  );

  // Detach a style from a node (for unknown styles)
  const handleDetach = useCallback(
    (violation: LintViolation) => {
      setIsFixing(true);
      postMessage({
        type: 'DETACH_STYLE',
        nodeId: violation.nodeId,
        property: violation.property,
      });
    },
    [postMessage]
  );

  // Bulk detach styles from multiple nodes
  const handleBulkDetach = useCallback(
    (violations: LintViolation[]) => {
      const detachable = violations.filter(v => v.canDetach);
      if (detachable.length === 0) return;

      setIsFixing(true);
      postMessage({
        type: 'BULK_DETACH_STYLES',
        detaches: detachable.map(v => ({
          nodeId: v.nodeId,
          property: v.property,
        })),
      });
    },
    [postMessage]
  );

  // Apply a text style to a node (for typography violations)
  const handleApplyStyle = useCallback(
    (violation: LintViolation) => {
      if (!violation.suggestedTextStyle) return;

      setIsFixing(true);
      postMessage({
        type: 'APPLY_TEXT_STYLE',
        nodeId: violation.nodeId,
        textStyleId: violation.suggestedTextStyle.id,
        property: violation.property,
      });
    },
    [postMessage]
  );

  // Ignore a violation (for items that can't be fixed)
  const handleIgnore = useCallback(
    (violation: LintViolation) => {
      const key = violation.nodeId + ':' + violation.property;
      setIgnoredViolations(prev => {
        const next = new Set(prev);
        next.add(key);
        return next;
      });

      // Add to activity log
      const ignoreAction: FixActionDetail = {
        nodeId: violation.nodeId,
        nodeName: violation.nodeName,
        property: violation.property,
        actionType: 'ignore',
        beforeValue: String(violation.currentValue),
        afterValue: 'ignored',
        status: 'success',
        timestamp: Date.now(),
      };
      setFixActions(prev => [...prev, ignoreAction]);
    },
    []
  );

  // Auto-fix all path mismatches
  const handleAutoFixPathMismatches = useCallback(() => {
    if (!results) return;

    const pathMismatches = results.violations.filter(
      v => v.isPathMismatch && v.normalizedMatchPath && !fixedViolations.has(v.nodeId + ':' + v.property)
    );

    if (pathMismatches.length === 0) return;

    setIsFixing(true);
    postMessage({
      type: 'AUTO_FIX_PATH_MISMATCHES',
      fixes: pathMismatches.map(v => ({
        nodeId: v.nodeId,
        property: v.property,
        tokenPath: v.normalizedMatchPath!,
      })),
    });
  }, [results, fixedViolations, postMessage]);

  // Clear activity log
  const handleClearActivityLog = useCallback(() => {
    setFixActions([]);
  }, []);

  // Export results
  const handleExport = useCallback(
    (format: 'json' | 'csv') => {
      if (!results) return;

      let content: string;
      let filename: string;
      let mimeType: string;

      if (format === 'json') {
        content = JSON.stringify(results, null, 2);
        filename = 'lint-results.json';
        mimeType = 'application/json';
      } else {
        // CSV export
        const headers = [
          'Rule',
          'Severity',
          'Node Name',
          'Node Type',
          'Layer Path',
          'Property',
          'Current Value',
          'Message',
          'Suggested Token',
        ];
        const rows = results.violations.map(v => [
          v.ruleId,
          v.severity,
          v.nodeName,
          v.nodeType,
          v.layerPath,
          v.property,
          String(v.currentValue),
          v.message,
          v.suggestedToken || '',
        ]);

        content = [headers, ...rows].map(row => row.map(cell => '"' + cell.replace(/"/g, '""') + '"').join(',')).join('\n');
        filename = 'lint-results.csv';
        mimeType = 'text/csv';
      }

      // Create and trigger download
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
    [results]
  );

  // Update config
  const handleConfigChange = useCallback((newConfig: LintConfig) => {
    setConfig(newConfig);
    postMessage({ type: 'UPDATE_CONFIG', config: newConfig });
  }, [postMessage]);

  // Count fixable violations
  const fixableCount = results?.violations.filter(v => v.suggestedToken && !fixedViolations.has(v.nodeId + ':' + v.property)).length || 0;

  return (
    <div className="app">
      <Header
        onScan={handleScan}
        isScanning={isScanning}
        scope={scope}
        onScopeChange={setScope}
        onExport={handleExport}
        hasResults={results !== null}
        view={view}
        onViewChange={setView}
      />

      {isScanning && <ProgressBar processed={progress.processed} total={progress.total} />}

      {view === 'results' && (
        <>
          {results && <Summary results={results} fixedViolations={fixedViolations} ignoredViolations={ignoredViolations} />}

          {results && results.violations.length > 0 && (
            <>
              <FixStatusBar
                violations={results.violations}
                fixedViolations={fixedViolations}
                isFixing={isFixing}
                onFixAll={() => handleBulkFix(results.violations)}
                onAutoFixPathMismatches={handleAutoFixPathMismatches}
                fixProgress={fixProgress}
                showActivityLog={showActivityLog}
                onToggleActivityLog={() => setShowActivityLog(!showActivityLog)}
                activityCount={fixActions.length}
              />
              <ActivityLog
                actions={fixActions}
                isVisible={showActivityLog}
                onClose={() => setShowActivityLog(false)}
                onClear={handleClearActivityLog}
              />
            </>
          )}

          <ResultsList
            results={results}
            groupBy={groupBy}
            onGroupByChange={setGroupBy}
            onSelectNode={handleSelectNode}
            onFix={handleFix}
            onBulkFix={handleBulkFix}
            onUnbind={handleUnbind}
            onDetach={handleDetach}
            onBulkDetach={handleBulkDetach}
            onApplyStyle={handleApplyStyle}
            onIgnore={handleIgnore}
            fixedViolations={fixedViolations}
            ignoredViolations={ignoredViolations}
            isFixing={isFixing}
            fixableCount={fixableCount}
          />
        </>
      )}

      {view === 'config' && <ConfigPanel config={config} onChange={handleConfigChange} />}

      {view === 'sync' && <SyncPanel tokenCount={tokenCount} />}
    </div>
  );
}
