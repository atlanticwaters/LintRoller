/**
 * Activity Log Component
 *
 * Displays a list of fix actions with before/after values and status indicators.
 * Provides visibility into what changes are being made during fix operations.
 */

import type { FixActionDetail } from '../../shared/messages';

interface ActivityLogProps {
  actions: FixActionDetail[];
  isVisible: boolean;
  onClose: () => void;
  onClear: () => void;
}

/**
 * Format a timestamp for display
 */
function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/**
 * Get status icon for an action
 */
function getStatusIcon(status: 'success' | 'failed'): string {
  return status === 'success' ? '\u2713' : '\u2717';
}

/**
 * Get action type label
 */
function getActionTypeLabel(actionType: 'rebind' | 'unbind' | 'detach'): string {
  switch (actionType) {
    case 'rebind':
      return 'Rebound';
    case 'unbind':
      return 'Unbound';
    case 'detach':
      return 'Detached';
    default:
      return 'Fixed';
  }
}

export function ActivityLog({ actions, isVisible, onClose, onClear }: ActivityLogProps) {
  if (!isVisible) {
    return null;
  }

  const successCount = actions.filter(a => a.status === 'success').length;
  const failedCount = actions.filter(a => a.status === 'failed').length;

  return (
    <div className="activity-log">
      <div className="activity-log-header">
        <div className="activity-log-title">
          <span className="activity-log-title-text">Activity Log</span>
          <span className="activity-log-counts">
            <span className="activity-count success">{successCount} success</span>
            {failedCount > 0 && (
              <span className="activity-count failed">{failedCount} failed</span>
            )}
          </span>
        </div>
        <div className="activity-log-actions">
          {actions.length > 0 && (
            <button
              className="btn btn-text"
              onClick={onClear}
              title="Clear activity log"
            >
              Clear
            </button>
          )}
          <button
            className="btn btn-icon"
            onClick={onClose}
            title="Close activity log"
          >
            {'\u00D7'}
          </button>
        </div>
      </div>

      <div className="activity-log-content">
        {actions.length === 0 ? (
          <div className="activity-log-empty">
            No fix actions yet. Click "Fix" on a violation to see activity here.
          </div>
        ) : (
          <div className="activity-log-list">
            {[...actions].reverse().map((action, idx) => (
              <div
                key={actions.length - 1 - idx}
                className={'activity-log-item ' + action.status}
              >
                <div className="activity-item-status">
                  <span className={'status-icon ' + action.status}>
                    {getStatusIcon(action.status)}
                  </span>
                </div>
                <div className="activity-item-content">
                  <div className="activity-item-header">
                    <span className="activity-node-name" title={action.nodeName}>
                      {action.nodeName}
                    </span>
                    <span className="activity-property">.{action.property}</span>
                    <span className="activity-action-type">
                      {getActionTypeLabel(action.actionType)}
                    </span>
                  </div>
                  <div className="activity-item-change">
                    <span className="activity-before" title={action.beforeValue}>
                      {action.beforeValue}
                    </span>
                    <span className="activity-arrow">{'\u2192'}</span>
                    <span className="activity-after" title={action.afterValue}>
                      {action.afterValue}
                    </span>
                  </div>
                  {action.status === 'failed' && action.errorMessage && (
                    <div className="activity-error">
                      {action.errorMessage}
                    </div>
                  )}
                </div>
                <div className="activity-item-time">
                  {formatTimestamp(action.timestamp)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
