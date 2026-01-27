/**
 * Summary Component
 */

import { useMemo } from 'preact/hooks';
import type { LintResults, Severity } from '../../shared/types';

interface SummaryProps {
  results: LintResults;
  fixedViolations: Set<string>;
  ignoredViolations: Set<string>;
}

export function Summary({ results, fixedViolations, ignoredViolations }: SummaryProps) {
  const { metadata } = results;

  // Compute remaining violations (excluding fixed and ignored)
  const remainingCounts = useMemo(() => {
    let total = 0;
    const bySeverity: Record<Severity, number> = { error: 0, warning: 0, info: 0 };

    for (const violation of results.violations) {
      const key = violation.nodeId + ':' + violation.property;
      if (!fixedViolations.has(key) && !ignoredViolations.has(key)) {
        total++;
        bySeverity[violation.severity]++;
      }
    }

    return { total, bySeverity };
  }, [results.violations, fixedViolations, ignoredViolations]);

  const dismissedCount = fixedViolations.size + ignoredViolations.size;

  return (
    <div className="summary">
      <div className="stat-cards">
        <div className={`stat-card ${remainingCounts.total > 0 ? 'warning' : 'success'}`}>
          <div className="value">{remainingCounts.total}</div>
          <div className="label">
            {dismissedCount > 0 ? `Remaining (${dismissedCount} resolved)` : 'Total Issues'}
          </div>
        </div>

        <div className={`stat-card ${remainingCounts.bySeverity.error > 0 ? 'error' : ''}`}>
          <div className="value">{remainingCounts.bySeverity.error}</div>
          <div className="label">Errors</div>
        </div>

        <div className={`stat-card ${remainingCounts.bySeverity.warning > 0 ? 'warning' : ''}`}>
          <div className="value">{remainingCounts.bySeverity.warning}</div>
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
