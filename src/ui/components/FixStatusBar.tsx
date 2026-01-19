/**
 * Fix Status Bar Component
 *
 * Shows the status of auto-fix operations with counters for fixable,
 * fixed, and unfixable items.
 */

import type { LintViolation } from '../../shared/types';

interface FixStatusBarProps {
  violations: LintViolation[];
  fixedViolations: Set<string>;
  isFixing: boolean;
  onFixAll: () => void;
}

export function FixStatusBar({ violations, fixedViolations, isFixing, onFixAll }: FixStatusBarProps) {
  // Calculate counts
  const total = violations.length;

  // Fixable = has a suggested token
  const fixable = violations.filter(v => v.suggestedToken);

  // Already fixed in this session
  const fixed = fixable.filter(v => fixedViolations.has(v.nodeId + ':' + v.property));

  // Remaining fixable (has suggestion but not yet fixed)
  const remaining = fixable.filter(v => !fixedViolations.has(v.nodeId + ':' + v.property));

  // Unfixable = no suggested token
  const unfixable = violations.filter(v => !v.suggestedToken);

  // Calculate percentages for the progress bar
  const fixedPercent = total > 0 ? (fixed.length / total) * 100 : 0;
  const remainingPercent = total > 0 ? (remaining.length / total) * 100 : 0;
  const unfixablePercent = total > 0 ? (unfixable.length / total) * 100 : 0;

  if (total === 0) {
    return null;
  }

  return (
    <div className="fix-status-bar">
      <div className="fix-status-header">
        <span className="fix-status-title">Fix Status</span>
        {remaining.length > 0 && (
          <button
            className="btn btn-fix-all-compact"
            onClick={onFixAll}
            disabled={isFixing}
          >
            {isFixing ? 'Fixing...' : 'Fix ' + remaining.length + ' Issues'}
          </button>
        )}
      </div>

      <div className="fix-progress-bar">
        <div
          className="fix-progress-segment fixed"
          style={{ width: fixedPercent + '%' }}
          title={fixed.length + ' fixed'}
        />
        <div
          className="fix-progress-segment fixable"
          style={{ width: remainingPercent + '%' }}
          title={remaining.length + ' can be fixed'}
        />
        <div
          className="fix-progress-segment unfixable"
          style={{ width: unfixablePercent + '%' }}
          title={unfixable.length + ' cannot be auto-fixed'}
        />
      </div>

      <div className="fix-status-legend">
        <div className="fix-legend-item">
          <span className="fix-legend-dot fixed" />
          <span className="fix-legend-count">{fixed.length}</span>
          <span className="fix-legend-label">Fixed</span>
        </div>
        <div className="fix-legend-item">
          <span className="fix-legend-dot fixable" />
          <span className="fix-legend-count">{remaining.length}</span>
          <span className="fix-legend-label">Fixable</span>
        </div>
        <div className="fix-legend-item">
          <span className="fix-legend-dot unfixable" />
          <span className="fix-legend-count">{unfixable.length}</span>
          <span className="fix-legend-label">Manual</span>
        </div>
      </div>
    </div>
  );
}
