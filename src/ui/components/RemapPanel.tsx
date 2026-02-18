/**
 * Remap Panel Component
 *
 * Scans for broken variable bindings and allows remapping to new variables.
 */

import { useState, useEffect, useCallback } from 'preact/hooks';
import type { RemapScanResult, RemapEntry } from '../../shared/types';
import type { UIToPluginMessage, PluginToUIMessage } from '../../shared/messages';

type Phase = 'idle' | 'scanning' | 'results' | 'applying' | 'complete';

export function RemapPanel() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [scanResult, setScanResult] = useState<RemapScanResult | null>(null);
  const [scanProgress, setScanProgress] = useState({ processed: 0, total: 0 });
  const [applyProgress, setApplyProgress] = useState({ current: 0, total: 0 });
  const [applyResult, setApplyResult] = useState<{ remapped: number; failed: number; errors: string[] } | null>(null);
  const [selections, setSelections] = useState<Map<string, boolean>>(new Map());

  const postMessage = useCallback((message: UIToPluginMessage) => {
    parent.postMessage({ pluginMessage: message }, '*');
  }, []);

  // Handle messages from plugin
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const msg = event.data.pluginMessage as PluginToUIMessage;
      if (!msg) return;

      switch (msg.type) {
        case 'REMAP_SCAN_PROGRESS':
          setScanProgress({ processed: msg.processed, total: msg.total });
          break;

        case 'REMAP_SCAN_COMPLETE':
          setScanResult(msg.result);
          setPhase(msg.result.brokenBindings > 0 ? 'results' : 'results');
          // Auto-select entries with high-confidence suggestions
          const sel = new Map<string, boolean>();
          for (const entry of msg.result.remapEntries) {
            sel.set(entry.oldVariableId, !!(entry.suggestedVariable && entry.suggestedVariable.confidence !== 'low'));
          }
          setSelections(sel);
          break;

        case 'REMAP_PROGRESS':
          setApplyProgress({ current: msg.current, total: msg.total });
          break;

        case 'REMAP_COMPLETE':
          setApplyResult(msg.result);
          setPhase('complete');
          break;

        case 'ERROR':
          setPhase(scanResult ? 'results' : 'idle');
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [scanResult]);

  const handleScan = useCallback(() => {
    setPhase('scanning');
    setScanResult(null);
    setApplyResult(null);
    setScanProgress({ processed: 0, total: 0 });
    postMessage({ type: 'START_REMAP_SCAN', scope: { type: 'full_document' } });
  }, [postMessage]);

  const handleApply = useCallback(() => {
    if (!scanResult) return;

    const remaps: Array<{ oldVariableId: string; newVariableId: string }> = [];
    for (const entry of scanResult.remapEntries) {
      if (selections.get(entry.oldVariableId) && entry.suggestedVariable) {
        remaps.push({
          oldVariableId: entry.oldVariableId,
          newVariableId: entry.suggestedVariable.id,
        });
      }
    }

    if (remaps.length === 0) return;

    setPhase('applying');
    setApplyProgress({ current: 0, total: 0 });
    postMessage({ type: 'APPLY_REMAP', remaps });
  }, [scanResult, selections, postMessage]);

  const toggleEntry = useCallback((oldVarId: string) => {
    setSelections(prev => {
      const next = new Map(prev);
      next.set(oldVarId, !next.get(oldVarId));
      return next;
    });
  }, []);

  const selectedCount = scanResult
    ? scanResult.remapEntries.filter(e => selections.get(e.oldVariableId) && e.suggestedVariable).length
    : 0;

  return (
    <div className="sync-panel" style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-md)' }}>
      {/* Header */}
      <div style={{ marginBottom: 'var(--space-lg)' }}>
        <h2 style={{ margin: 0, fontSize: 'var(--font-size-lg)' }}>Variable Remap</h2>
        <p style={{ margin: 'var(--space-sm) 0 0', color: 'var(--figma-color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
          Fix stale or broken variable bindings after re-import
        </p>
      </div>

      {/* Idle: Show scan button */}
      {phase === 'idle' && (
        <div>
          <div style={{
            padding: 'var(--space-md)',
            backgroundColor: 'var(--figma-color-bg)',
            borderRadius: 'var(--radius-sm)',
            marginBottom: 'var(--space-lg)',
            fontSize: 'var(--font-size-sm)',
            color: 'var(--figma-color-text-secondary)',
          }}>
            When variables are re-imported (library updates, Tokens Studio re-sync), internal IDs change
            and nodes lose their bindings. This tool detects <strong>stale</strong> bindings (old library
            imports with local replacements) and <strong>broken</strong> bindings (deleted variables),
            then rebinds them.
          </div>
          <button
            className="btn btn-primary"
            onClick={handleScan}
            style={{ width: '100%' }}
          >
            Scan for Stale Bindings
          </button>
        </div>
      )}

      {/* Scanning: Show progress */}
      {phase === 'scanning' && (
        <div style={{
          padding: 'var(--space-md)',
          backgroundColor: 'var(--figma-color-bg)',
          borderRadius: 'var(--radius-sm)',
        }}>
          <div style={{ marginBottom: 'var(--space-sm)', fontSize: 'var(--font-size-sm)' }}>
            Scanning nodes for stale and broken bindings...
          </div>
          <div style={{
            height: '4px',
            backgroundColor: 'var(--figma-color-border)',
            borderRadius: '2px',
            overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              width: `${scanProgress.total > 0 ? (scanProgress.processed / scanProgress.total) * 100 : 0}%`,
              backgroundColor: 'var(--figma-color-bg-brand)',
              transition: 'width 0.2s',
            }} />
          </div>
          <div style={{ marginTop: 'var(--space-xs)', fontSize: 'var(--font-size-xs)', color: 'var(--figma-color-text-secondary)' }}>
            {scanProgress.processed} / {scanProgress.total} nodes
          </div>
        </div>
      )}

      {/* Results: Show scan summary and remap list */}
      {phase === 'results' && scanResult && (
        <div>
          {/* Summary */}
          <div style={{ display: 'flex', gap: 'var(--space-sm)', marginBottom: 'var(--space-lg)', flexWrap: 'wrap' }}>
            <div style={{
              flex: 1,
              minWidth: '60px',
              padding: 'var(--space-sm)',
              backgroundColor: 'var(--figma-color-bg)',
              borderRadius: 'var(--radius-sm)',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600 }}>{scanResult.totalBindings}</div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--figma-color-text-secondary)' }}>Total</div>
            </div>
            {scanResult.staleBindings > 0 && (
              <div style={{
                flex: 1,
                minWidth: '60px',
                padding: 'var(--space-sm)',
                backgroundColor: 'var(--figma-color-bg-warning)',
                borderRadius: 'var(--radius-sm)',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600 }}>{scanResult.staleBindings}</div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--figma-color-text-secondary)' }}>Stale</div>
              </div>
            )}
            {scanResult.brokenBindings > 0 && (
              <div style={{
                flex: 1,
                minWidth: '60px',
                padding: 'var(--space-sm)',
                backgroundColor: 'var(--figma-color-bg-danger)',
                borderRadius: 'var(--radius-sm)',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600 }}>{scanResult.brokenBindings}</div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--figma-color-text-secondary)' }}>Broken</div>
              </div>
            )}
            <div style={{
              flex: 1,
              minWidth: '60px',
              padding: 'var(--space-sm)',
              backgroundColor: 'var(--figma-color-bg-success)',
              borderRadius: 'var(--radius-sm)',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600 }}>{scanResult.validBindings}</div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--figma-color-text-secondary)' }}>Valid</div>
            </div>
          </div>

          {scanResult.remapEntries.length === 0 ? (
            <div style={{
              padding: 'var(--space-md)',
              backgroundColor: 'var(--figma-color-bg-success)',
              borderRadius: 'var(--radius-sm)',
              marginBottom: 'var(--space-lg)',
              fontSize: 'var(--font-size-sm)',
            }}>
              No stale or broken bindings found. All variable bindings are healthy.
            </div>
          ) : (
            <>
              {/* Remap list */}
              <div style={{ marginBottom: 'var(--space-md)' }}>
                <div style={{
                  fontSize: 'var(--font-size-xs)',
                  color: 'var(--figma-color-text-secondary)',
                  marginBottom: 'var(--space-sm)',
                }}>
                  {scanResult.remapEntries.length} variable{scanResult.remapEntries.length !== 1 ? 's' : ''} to remap
                  ({scanResult.remapEntries.filter(e => e.kind === 'stale').length} stale,
                  {' '}{scanResult.remapEntries.filter(e => e.kind === 'broken').length} broken)
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
                  {scanResult.remapEntries.map(entry => (
                    <RemapEntryRow
                      key={entry.oldVariableId}
                      entry={entry}
                      selected={!!selections.get(entry.oldVariableId)}
                      onToggle={() => toggleEntry(entry.oldVariableId)}
                    />
                  ))}
                </div>
              </div>

              {/* Apply button */}
              <button
                className="btn btn-primary"
                onClick={handleApply}
                disabled={selectedCount === 0}
                style={{ width: '100%', marginBottom: 'var(--space-sm)' }}
              >
                Remap {selectedCount} Variable{selectedCount !== 1 ? 's' : ''}
              </button>
            </>
          )}

          {/* Re-scan button */}
          <button
            className="btn btn-secondary"
            onClick={handleScan}
            style={{ width: '100%' }}
          >
            Scan Again
          </button>
        </div>
      )}

      {/* Applying: Show progress */}
      {phase === 'applying' && (
        <div style={{
          padding: 'var(--space-md)',
          backgroundColor: 'var(--figma-color-bg)',
          borderRadius: 'var(--radius-sm)',
        }}>
          <div style={{ marginBottom: 'var(--space-sm)', fontSize: 'var(--font-size-sm)' }}>
            Remapping variables...
          </div>
          <div style={{
            height: '4px',
            backgroundColor: 'var(--figma-color-border)',
            borderRadius: '2px',
            overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              width: `${applyProgress.total > 0 ? (applyProgress.current / applyProgress.total) * 100 : 0}%`,
              backgroundColor: 'var(--figma-color-bg-brand)',
              transition: 'width 0.2s',
            }} />
          </div>
          <div style={{ marginTop: 'var(--space-xs)', fontSize: 'var(--font-size-xs)', color: 'var(--figma-color-text-secondary)' }}>
            {applyProgress.current} / {applyProgress.total} nodes
          </div>
        </div>
      )}

      {/* Complete: Show result */}
      {phase === 'complete' && applyResult && (
        <div>
          <div style={{
            padding: 'var(--space-md)',
            backgroundColor: applyResult.failed === 0 ? 'var(--figma-color-bg-success)' : 'var(--figma-color-bg-warning)',
            borderRadius: 'var(--radius-sm)',
            marginBottom: 'var(--space-lg)',
          }}>
            <div style={{ fontWeight: 500, marginBottom: 'var(--space-sm)' }}>
              Remap Complete
            </div>
            <div style={{ fontSize: 'var(--font-size-sm)', display: 'flex', gap: 'var(--space-md)' }}>
              <span>Remapped: {applyResult.remapped}</span>
              <span>Failed: {applyResult.failed}</span>
            </div>
            {applyResult.errors.length > 0 && (
              <details style={{ marginTop: 'var(--space-sm)' }}>
                <summary style={{ cursor: 'pointer', fontSize: 'var(--font-size-sm)' }}>
                  {applyResult.errors.length} errors
                </summary>
                <div style={{ maxHeight: '100px', overflowY: 'auto', marginTop: 'var(--space-xs)', fontSize: 'var(--font-size-xs)' }}>
                  {applyResult.errors.map((err, i) => (
                    <div key={i}>{err}</div>
                  ))}
                </div>
              </details>
            )}
          </div>

          <button
            className="btn btn-secondary"
            onClick={handleScan}
            style={{ width: '100%' }}
          >
            Scan Again
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────

function RemapEntryRow({
  entry,
  selected,
  onToggle,
}: {
  entry: RemapEntry;
  selected: boolean;
  onToggle: () => void;
}) {
  const hasSuggestion = !!entry.suggestedVariable;
  const confidenceColor = entry.suggestedVariable?.confidence === 'high'
    ? 'var(--figma-color-text-success)'
    : entry.suggestedVariable?.confidence === 'medium'
    ? 'var(--figma-color-text-warning)'
    : 'var(--figma-color-text-danger)';
  const kindColor = entry.kind === 'stale' ? '#b57d14' : '#c4463a';
  const kindLabel = entry.kind === 'stale' ? 'STALE' : 'BROKEN';

  // For stale entries, show the old variable name; for broken, show truncated ID
  const oldLabel = entry.oldVariableName || (
    entry.oldVariableId.length > 20
      ? entry.oldVariableId.slice(0, 8) + '...' + entry.oldVariableId.slice(-8)
      : entry.oldVariableId
  );

  return (
    <div
      style={{
        padding: 'var(--space-sm)',
        backgroundColor: 'var(--figma-color-bg)',
        borderRadius: 'var(--radius-sm)',
        opacity: hasSuggestion ? 1 : 0.6,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          disabled={!hasSuggestion}
          style={{ flexShrink: 0 }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Old binding: kind badge + name/id + usage count */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', minWidth: 0 }}>
              <span style={{
                fontSize: '9px',
                padding: '1px 4px',
                borderRadius: '3px',
                backgroundColor: kindColor,
                color: 'white',
                fontWeight: 600,
                flexShrink: 0,
              }}>
                {kindLabel}
              </span>
              {entry.currentValue && entry.propertyHint && (entry.propertyHint.startsWith('fills[') || entry.propertyHint.startsWith('strokes[')) && (
                <div style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '2px',
                  backgroundColor: entry.currentValue,
                  border: '1px solid var(--figma-color-border)',
                  flexShrink: 0,
                }} />
              )}
              <span style={{
                fontSize: 'var(--font-size-xs)',
                color: 'var(--figma-color-text-secondary)',
                fontFamily: entry.oldVariableName ? 'inherit' : 'monospace',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {oldLabel}
              </span>
            </div>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--figma-color-text-secondary)', flexShrink: 0, marginLeft: 'var(--space-xs)' }}>
              {entry.usageCount} node{entry.usageCount !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Suggestion: arrow + new variable name + confidence badge */}
          {hasSuggestion ? (
            <div style={{ marginTop: 'var(--space-xs)', display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--figma-color-text-secondary)' }}>{'→'}</span>
              <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500 }}>
                {entry.suggestedVariable!.name}
              </span>
              <span style={{
                fontSize: '9px',
                padding: '1px 4px',
                borderRadius: '3px',
                backgroundColor: confidenceColor,
                color: 'white',
                fontWeight: 600,
                textTransform: 'uppercase',
                flexShrink: 0,
              }}>
                {entry.suggestedVariable!.confidence}
              </span>
            </div>
          ) : (
            <div style={{ marginTop: 'var(--space-xs)', fontSize: 'var(--font-size-xs)', color: 'var(--figma-color-text-danger)' }}>
              No matching variable found
            </div>
          )}

          {/* Collection + match method hint */}
          {hasSuggestion && (
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--figma-color-text-secondary)', marginTop: '2px' }}>
              {entry.suggestedVariable!.collection}
              {' \u00B7 '}
              {entry.suggestedVariable!.matchMethod === 'name' ? 'matched by name' : 'matched by value'}
              {entry.currentValue ? ' \u00B7 ' + entry.currentValue : ''}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
