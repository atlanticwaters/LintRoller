/**
 * Sync Panel Component
 *
 * Provides UI for syncing tokens to Figma variables
 */

import { useState, useEffect, useCallback } from 'preact/hooks';
import type { UIToPluginMessage, PluginToUIMessage } from '../../shared/messages';

interface SyncStatus {
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

interface SyncDiff {
  toCreate: Array<{ path: string; layer: string; value: string | number }>;
  toUpdate: Array<{ path: string; layer: string; oldValue: string | number; newValue: string | number }>;
  toDelete: Array<{ path: string; layer: string; variableId: string }>;
  unchanged: number;
}

interface SyncProgress {
  phase: 'analyzing' | 'creating' | 'updating' | 'deleting' | 'complete';
  current: number;
  total: number;
  message: string;
}

interface SyncResult {
  success: boolean;
  created: number;
  updated: number;
  deleted: number;
  skipped: number;
  errors: string[];
}

interface SyncOptions {
  createNew: boolean;
  updateExisting: boolean;
  deleteOrphans: boolean;
}

interface SyncPanelProps {
  tokenCount: number;
}

export function SyncPanel({ tokenCount }: SyncPanelProps) {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [diff, setDiff] = useState<SyncDiff | null>(null);
  const [progress, setProgress] = useState<SyncProgress | null>(null);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showDiff, setShowDiff] = useState(false);
  const [options, setOptions] = useState<SyncOptions>({
    createNew: true,
    updateExisting: true,
    deleteOrphans: false,
  });

  // Send message to plugin
  const postMessage = useCallback((message: UIToPluginMessage) => {
    parent.postMessage({ pluginMessage: message }, '*');
  }, []);

  // Load status on mount
  useEffect(() => {
    setIsLoading(true);
    postMessage({ type: 'GET_SYNC_STATUS' });
  }, [postMessage]);

  // Handle messages from plugin
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const msg = event.data.pluginMessage as PluginToUIMessage;
      if (!msg) return;

      switch (msg.type) {
        case 'SYNC_STATUS':
          setStatus(msg);
          setIsLoading(false);
          break;

        case 'SYNC_DIFF':
          setDiff(msg);
          setIsLoading(false);
          break;

        case 'SYNC_PROGRESS':
          setProgress(msg);
          break;

        case 'SYNC_COMPLETE':
          setResult(msg);
          setIsSyncing(false);
          setProgress(null);
          // Refresh status after sync
          postMessage({ type: 'GET_SYNC_STATUS' });
          break;

        case 'ERROR':
          setIsLoading(false);
          setIsSyncing(false);
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [postMessage]);

  // Request diff analysis
  const handleAnalyzeDiff = useCallback(() => {
    setIsLoading(true);
    setDiff(null);
    postMessage({ type: 'GET_SYNC_DIFF', options });
    setShowDiff(true);
  }, [options, postMessage]);

  // Start sync
  const handleSync = useCallback(() => {
    setIsSyncing(true);
    setResult(null);
    postMessage({ type: 'START_SYNC', options });
  }, [options, postMessage]);

  // Reset variables
  const handleReset = useCallback(() => {
    setIsSyncing(true);
    setResult(null);
    postMessage({ type: 'RESET_VARIABLES' });
  }, [postMessage]);

  // Refresh status
  const handleRefresh = useCallback(() => {
    setIsLoading(true);
    postMessage({ type: 'GET_SYNC_STATUS' });
  }, [postMessage]);

  return (
    <div className="sync-panel" style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-md)' }}>
      {/* Header */}
      <div style={{ marginBottom: 'var(--space-lg)' }}>
        <h2 style={{ margin: 0, fontSize: 'var(--font-size-lg)' }}>Variable Sync</h2>
        <p style={{ margin: 'var(--space-sm) 0 0', color: 'var(--figma-color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
          Sync design tokens to Figma variables
        </p>
      </div>

      {/* Status Section */}
      <div className="config-section" style={{ marginBottom: 'var(--space-lg)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-sm)' }}>
          <h3 style={{ margin: 0 }}>Current Status</h3>
          <button
            className="btn btn-secondary"
            onClick={handleRefresh}
            disabled={isLoading}
            style={{ padding: 'var(--space-xs) var(--space-sm)', fontSize: 'var(--font-size-xs)' }}
          >
            Refresh
          </button>
        </div>

        {isLoading && !status ? (
          <div style={{ color: 'var(--figma-color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
            Loading...
          </div>
        ) : status ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
            {/* Stats Row */}
            <div style={{ display: 'flex', gap: 'var(--space-md)' }}>
              <div style={{
                flex: 1,
                padding: 'var(--space-sm)',
                backgroundColor: 'var(--figma-color-bg)',
                borderRadius: 'var(--radius-sm)',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600 }}>{tokenCount}</div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--figma-color-text-secondary)' }}>Tokens</div>
              </div>
              <div style={{
                flex: 1,
                padding: 'var(--space-sm)',
                backgroundColor: 'var(--figma-color-bg)',
                borderRadius: 'var(--radius-sm)',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600 }}>{status.totalVariables}</div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--figma-color-text-secondary)' }}>Variables</div>
              </div>
              <div style={{
                flex: 1,
                padding: 'var(--space-sm)',
                backgroundColor: status.syncedPercentage >= 100 ? 'var(--figma-color-bg-success)' : 'var(--figma-color-bg-warning)',
                borderRadius: 'var(--radius-sm)',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600 }}>{status.syncedPercentage}%</div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--figma-color-text-secondary)' }}>Synced</div>
              </div>
            </div>

            {/* Collections */}
            {status.collections.length > 0 && (
              <div style={{ marginTop: 'var(--space-sm)' }}>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--figma-color-text-secondary)', marginBottom: 'var(--space-xs)' }}>
                  Collections
                </div>
                {status.collections.map(col => (
                  <div
                    key={col.name}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: 'var(--space-xs) var(--space-sm)',
                      backgroundColor: 'var(--figma-color-bg)',
                      borderRadius: 'var(--radius-sm)',
                      marginBottom: 'var(--space-xs)',
                      fontSize: 'var(--font-size-sm)',
                    }}
                  >
                    <span>{col.name}</span>
                    <span style={{ color: 'var(--figma-color-text-secondary)' }}>
                      {col.variableCount} vars, {col.modeCount} modes
                    </span>
                  </div>
                ))}
              </div>
            )}

            {status.collections.length === 0 && (
              <div style={{
                padding: 'var(--space-md)',
                backgroundColor: 'var(--figma-color-bg-warning)',
                borderRadius: 'var(--radius-sm)',
                fontSize: 'var(--font-size-sm)',
              }}>
                No variable collections found. Click "Sync Now" to create them.
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* Sync Options */}
      <div className="config-section" style={{ marginBottom: 'var(--space-lg)' }}>
        <h3>Sync Options</h3>

        <div className="config-row" style={{ marginBottom: 'var(--space-sm)' }}>
          <div>
            <div style={{ fontWeight: 500, fontSize: 'var(--font-size-sm)' }}>Create new variables</div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--figma-color-text-secondary)' }}>
              Add variables for new tokens
            </div>
          </div>
          <label className="toggle">
            <input
              type="checkbox"
              checked={options.createNew}
              onChange={() => setOptions(prev => ({ ...prev, createNew: !prev.createNew }))}
            />
            <span className="slider" />
          </label>
        </div>

        <div className="config-row" style={{ marginBottom: 'var(--space-sm)' }}>
          <div>
            <div style={{ fontWeight: 500, fontSize: 'var(--font-size-sm)' }}>Update existing variables</div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--figma-color-text-secondary)' }}>
              Update values when tokens change
            </div>
          </div>
          <label className="toggle">
            <input
              type="checkbox"
              checked={options.updateExisting}
              onChange={() => setOptions(prev => ({ ...prev, updateExisting: !prev.updateExisting }))}
            />
            <span className="slider" />
          </label>
        </div>

        <div className="config-row">
          <div>
            <div style={{ fontWeight: 500, fontSize: 'var(--font-size-sm)' }}>Delete orphaned variables</div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--figma-color-text-secondary)' }}>
              Remove variables not in token source
            </div>
          </div>
          <label className="toggle">
            <input
              type="checkbox"
              checked={options.deleteOrphans}
              onChange={() => setOptions(prev => ({ ...prev, deleteOrphans: !prev.deleteOrphans }))}
            />
            <span className="slider" />
          </label>
        </div>
      </div>

      {/* Diff Preview */}
      {showDiff && (
        <div className="config-section" style={{ marginBottom: 'var(--space-lg)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-sm)' }}>
            <h3 style={{ margin: 0 }}>Preview Changes</h3>
            <button
              className="btn btn-secondary"
              onClick={() => setShowDiff(false)}
              style={{ padding: 'var(--space-xs) var(--space-sm)', fontSize: 'var(--font-size-xs)' }}
            >
              Hide
            </button>
          </div>

          {isLoading ? (
            <div style={{ color: 'var(--figma-color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
              Analyzing...
            </div>
          ) : diff ? (
            <div style={{ fontSize: 'var(--font-size-sm)' }}>
              <div style={{ display: 'flex', gap: 'var(--space-md)', marginBottom: 'var(--space-sm)' }}>
                <span style={{ color: 'var(--figma-color-text-success)' }}>+{diff.toCreate.length} create</span>
                <span style={{ color: 'var(--figma-color-text-warning)' }}>~{diff.toUpdate.length} update</span>
                <span style={{ color: 'var(--figma-color-text-danger)' }}>-{diff.toDelete.length} delete</span>
                <span style={{ color: 'var(--figma-color-text-secondary)' }}>{diff.unchanged} unchanged</span>
              </div>

              {diff.toCreate.length > 0 && (
                <details style={{ marginBottom: 'var(--space-sm)' }}>
                  <summary style={{ cursor: 'pointer', color: 'var(--figma-color-text-success)' }}>
                    To Create ({diff.toCreate.length})
                  </summary>
                  <div style={{ maxHeight: '100px', overflowY: 'auto', marginTop: 'var(--space-xs)' }}>
                    {diff.toCreate.slice(0, 20).map((item, i) => (
                      <div key={i} style={{ fontSize: 'var(--font-size-xs)', color: 'var(--figma-color-text-secondary)' }}>
                        {item.path}
                      </div>
                    ))}
                    {diff.toCreate.length > 20 && (
                      <div style={{ fontSize: 'var(--font-size-xs)', fontStyle: 'italic' }}>
                        ...and {diff.toCreate.length - 20} more
                      </div>
                    )}
                  </div>
                </details>
              )}

              {diff.toUpdate.length > 0 && (
                <details style={{ marginBottom: 'var(--space-sm)' }}>
                  <summary style={{ cursor: 'pointer', color: 'var(--figma-color-text-warning)' }}>
                    To Update ({diff.toUpdate.length})
                  </summary>
                  <div style={{ maxHeight: '100px', overflowY: 'auto', marginTop: 'var(--space-xs)' }}>
                    {diff.toUpdate.slice(0, 20).map((item, i) => (
                      <div key={i} style={{ fontSize: 'var(--font-size-xs)', color: 'var(--figma-color-text-secondary)' }}>
                        {item.path}
                      </div>
                    ))}
                  </div>
                </details>
              )}

              {diff.toDelete.length > 0 && (
                <details>
                  <summary style={{ cursor: 'pointer', color: 'var(--figma-color-text-danger)' }}>
                    To Delete ({diff.toDelete.length})
                  </summary>
                  <div style={{ maxHeight: '100px', overflowY: 'auto', marginTop: 'var(--space-xs)' }}>
                    {diff.toDelete.slice(0, 20).map((item, i) => (
                      <div key={i} style={{ fontSize: 'var(--font-size-xs)', color: 'var(--figma-color-text-secondary)' }}>
                        {item.path}
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          ) : null}
        </div>
      )}

      {/* Progress */}
      {progress && (
        <div style={{
          padding: 'var(--space-md)',
          backgroundColor: 'var(--figma-color-bg)',
          borderRadius: 'var(--radius-sm)',
          marginBottom: 'var(--space-lg)',
        }}>
          <div style={{ marginBottom: 'var(--space-sm)', fontSize: 'var(--font-size-sm)' }}>
            {progress.message}
          </div>
          <div style={{
            height: '4px',
            backgroundColor: 'var(--figma-color-border)',
            borderRadius: '2px',
            overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%`,
              backgroundColor: 'var(--figma-color-bg-brand)',
              transition: 'width 0.2s',
            }} />
          </div>
          <div style={{ marginTop: 'var(--space-xs)', fontSize: 'var(--font-size-xs)', color: 'var(--figma-color-text-secondary)' }}>
            {progress.current} / {progress.total}
          </div>
        </div>
      )}

      {/* Result */}
      {result && (
        <div style={{
          padding: 'var(--space-md)',
          backgroundColor: result.success ? 'var(--figma-color-bg-success)' : 'var(--figma-color-bg-danger)',
          borderRadius: 'var(--radius-sm)',
          marginBottom: 'var(--space-lg)',
        }}>
          <div style={{ fontWeight: 500, marginBottom: 'var(--space-sm)' }}>
            {result.success ? 'Sync Complete' : 'Sync Failed'}
          </div>
          <div style={{ fontSize: 'var(--font-size-sm)', display: 'flex', gap: 'var(--space-md)' }}>
            <span>Created: {result.created}</span>
            <span>Updated: {result.updated}</span>
            <span>Deleted: {result.deleted}</span>
            <span>Skipped: {result.skipped}</span>
          </div>
          {result.errors.length > 0 && (
            <details style={{ marginTop: 'var(--space-sm)' }}>
              <summary style={{ cursor: 'pointer', fontSize: 'var(--font-size-sm)' }}>
                {result.errors.length} errors
              </summary>
              <div style={{ maxHeight: '100px', overflowY: 'auto', marginTop: 'var(--space-xs)', fontSize: 'var(--font-size-xs)' }}>
                {result.errors.map((err, i) => (
                  <div key={i}>{err}</div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
        <button
          className="btn btn-secondary"
          onClick={handleAnalyzeDiff}
          disabled={isLoading || isSyncing}
          style={{ flex: 1 }}
        >
          Preview Changes
        </button>
        <button
          className="btn btn-primary"
          onClick={handleSync}
          disabled={isLoading || isSyncing}
          style={{ flex: 1 }}
        >
          {isSyncing ? 'Syncing...' : 'Sync Now'}
        </button>
      </div>

      <div style={{ marginTop: 'var(--space-sm)' }}>
        <button
          className="btn btn-secondary"
          onClick={handleReset}
          disabled={isLoading || isSyncing}
          style={{ width: '100%' }}
        >
          Reset Variables to Token Values
        </button>
      </div>

      {/* Help Text */}
      <div style={{
        marginTop: 'var(--space-lg)',
        padding: 'var(--space-md)',
        backgroundColor: 'var(--figma-color-bg)',
        borderRadius: 'var(--radius-sm)',
        fontSize: 'var(--font-size-xs)',
        color: 'var(--figma-color-text-secondary)',
      }}>
        <div style={{ fontWeight: 500, marginBottom: 'var(--space-xs)' }}>Workflow</div>
        <ol style={{ margin: 0, paddingLeft: 'var(--space-md)' }}>
          <li>Sync tokens to create/update Figma variables</li>
          <li>Use "Lint" tab to find hardcoded values in designs</li>
          <li>Fix violations to bind to the synced variables</li>
          <li>Reset variables when token values change</li>
        </ol>
      </div>
    </div>
  );
}
