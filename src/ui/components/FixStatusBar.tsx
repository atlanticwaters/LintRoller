/**
 * Fix Status Bar Component
 *
 * Shows the status of auto-fix operations with counters for fixable,
 * fixed, and unfixable items. Includes progress indicator and activity log toggle.
 */

import type { LintViolation } from '../../shared/types';

interface FixStatusBarProps {
  violations: LintViolation[];
  fixedViolations: Set<string>;
  isFixing: boolean;
  onFixAll: () => void;
  onAutoFixPathMismatches: () => void;
  fixProgress: { current: number; total: number } | null;
  showActivityLog: boolean;
  onToggleActivityLog: () => void;
  activityCount: number;
}

export function FixStatusBar({
  violations,
  fixedViolations,
  isFixing,
  onFixAll,
  onAutoFixPathMismatches,
  fixProgress,
  showActivityLog,
  onToggleActivityLog,
  activityCount,
}: FixStatusBarProps) {
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

  // Path mismatches (auto-fixable)
  const pathMismatches = violations.filter(
    v => v.isPathMismatch && !fixedViolations.has(v.nodeId + ':' + v.property)
  );

  // Calculate percentages for the progress bar
  const fixedPercent = total > 0 ? (fixed.length / total) * 100 : 0;
  const pathMismatchPercent = total > 0 ? (pathMismatches.length / total) * 100 : 0;
  const remainingPercent = total > 0 ? ((remaining.length - pathMismatches.length) / total) * 100 : 0;
  const unfixablePercent = total > 0 ? (unfixable.length / total) * 100 : 0;

  if (total === 0) {
    return null;
  }

  return (
    <div className="fix-status-bar">
      <div className="fix-status-header">
        <span className="fix-status-title">Fix Status</span>
        <div className="fix-status-actions">
          {pathMismatches.length > 0 && (
            <button
              className="btn btn-auto-fix"
              onClick={onAutoFixPathMismatches}
              disabled={isFixing}
              title="Auto-fix all path notation mismatches (/ vs . syntax)"
            >
              Auto-fix {pathMismatches.length} Path {pathMismatches.length === 1 ? 'Mismatch' : 'Mismatches'}
            </button>
          )}
          {remaining.length > 0 && (
            <button
              className="btn btn-fix-all-compact"
              onClick={onFixAll}
              disabled={isFixing}
            >
              {isFixing ? 'Fixing...' : 'Fix ' + remaining.length + ' Issues'}
            </button>
          )}
          <button
            className={'btn btn-activity-toggle' + (showActivityLog ? ' active' : '')}
            onClick={onToggleActivityLog}
            title={showActivityLog ? 'Hide activity log' : 'Show activity log'}
          >
            Activity{activityCount > 0 ? ' (' + activityCount + ')' : ''}
          </button>
        </div>
      </div>

      {/* Progress indicator during bulk fix */}
      {isFixing && fixProgress && (
        <div className="fix-progress-indicator">
          <div className="fix-progress-text">
            Fixing {fixProgress.current} of {fixProgress.total}...
          </div>
          <div className="fix-progress-bar-active">
            <div
              className="fix-progress-bar-fill"
              style={{ width: (fixProgress.current / fixProgress.total) * 100 + '%' }}
            />
          </div>
        </div>
      )}

      <div className="fix-progress-bar">
        <div
          className="fix-progress-segment fixed"
          style={{ width: fixedPercent + '%' }}
          title={fixed.length + ' fixed'}
        />
        <div
          className="fix-progress-segment path-mismatch"
          style={{ width: pathMismatchPercent + '%' }}
          title={pathMismatches.length + ' path mismatches (auto-fixable)'}
        />
        <div
          className="fix-progress-segment fixable"
          style={{ width: remainingPercent + '%' }}
          title={(remaining.length - pathMismatches.length) + ' can be fixed'}
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
        {pathMismatches.length > 0 && (
          <div className="fix-legend-item">
            <span className="fix-legend-dot path-mismatch" />
            <span className="fix-legend-count">{pathMismatches.length}</span>
            <span className="fix-legend-label">Path Mismatch</span>
          </div>
        )}
        <div className="fix-legend-item">
          <span className="fix-legend-dot fixable" />
          <span className="fix-legend-count">{remaining.length - pathMismatches.length}</span>
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
