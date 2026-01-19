/**
 * Summary Component
 */

import type { LintResults } from '../../shared/types';

interface SummaryProps {
  results: LintResults;
}

export function Summary({ results }: SummaryProps) {
  const { summary, metadata } = results;

  return (
    <div className="summary">
      <div className="stat-cards">
        <div className={`stat-card ${summary.total > 0 ? 'warning' : 'success'}`}>
          <div className="value">{summary.total}</div>
          <div className="label">Total Issues</div>
        </div>

        <div className={`stat-card ${summary.bySeverity.error > 0 ? 'error' : ''}`}>
          <div className="value">{summary.bySeverity.error}</div>
          <div className="label">Errors</div>
        </div>

        <div className={`stat-card ${summary.bySeverity.warning > 0 ? 'warning' : ''}`}>
          <div className="value">{summary.bySeverity.warning}</div>
          <div className="label">Warnings</div>
        </div>

        <div className="stat-card">
          <div className="value">{metadata.scannedNodes}</div>
          <div className="label">Nodes Scanned</div>
        </div>
      </div>
    </div>
  );
}
