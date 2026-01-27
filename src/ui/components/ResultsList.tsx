/**
 * Results List Component
 */

import { useMemo, useState } from 'preact/hooks';
import type { LintResults, LintViolation, LintRuleId } from '../../shared/types';
import { ResultItem } from './ResultItem';

interface ResultsListProps {
  results: LintResults | null;
  groupBy: 'rule' | 'node';
  onGroupByChange: (groupBy: 'rule' | 'node') => void;
  onSelectNode: (nodeId: string) => void;
  onFix: (violation: LintViolation) => void;
  onBulkFix: (violations: LintViolation[]) => void;
  onUnbind: (violation: LintViolation) => void;
  onDetach: (violation: LintViolation) => void;
  onBulkDetach: (violations: LintViolation[]) => void;
  onApplyStyle: (violation: LintViolation) => void;
  onIgnore: (violation: LintViolation) => void;
  fixedViolations: Set<string>;
  ignoredViolations: Set<string>;
  isFixing: boolean;
  fixableCount: number;
}

// Rule display names
const RULE_NAMES: Record<LintRuleId, string> = {
  'no-hardcoded-colors': 'Hardcoded Colors',
  'no-hardcoded-typography': 'Hardcoded Typography',
  'no-hardcoded-spacing': 'Hardcoded Spacing',
  'no-hardcoded-radii': 'Hardcoded Radii',
  'no-orphaned-variables': 'Orphaned Variables',
  'no-unknown-styles': 'Unknown Styles',
};

interface GroupedViolations {
  [key: string]: LintViolation[];
}

export function ResultsList({
  results,
  groupBy,
  onGroupByChange,
  onSelectNode,
  onFix,
  onBulkFix,
  onUnbind,
  onDetach,
  onBulkDetach,
  onApplyStyle,
  onIgnore,
  fixedViolations,
  ignoredViolations,
  isFixing,
  fixableCount
}: ResultsListProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Group violations
  const groups = useMemo<GroupedViolations>(() => {
    if (!results) return {};

    const grouped: GroupedViolations = {};

    for (const violation of results.violations) {
      const key = groupBy === 'rule' ? violation.ruleId : violation.nodeId;
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(violation);
    }

    return grouped;
  }, [results, groupBy]);

  // Toggle group expansion
  const toggleGroup = (key: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedGroups(newExpanded);
  };

  // Expand all groups by default when results change
  useMemo(() => {
    if (results) {
      setExpandedGroups(new Set(Object.keys(groups)));
    }
  }, [results]);

  // Check if a violation is fixed
  const isFixed = (violation: LintViolation) => {
    return fixedViolations.has(violation.nodeId + ':' + violation.property);
  };

  // Check if a violation is ignored
  const isIgnored = (violation: LintViolation) => {
    return ignoredViolations.has(violation.nodeId + ':' + violation.property);
  };

  // Check if a violation is dismissed (fixed or ignored)
  const isDismissed = (violation: LintViolation) => {
    return isFixed(violation) || isIgnored(violation);
  };

  // Get remaining (not dismissed) violations for a group
  const getRemainingViolations = (violations: LintViolation[]) => {
    return violations.filter(v => !isDismissed(v));
  };

  // Get fixable violations for a group (only from remaining)
  const getFixableViolations = (violations: LintViolation[]) => {
    return violations.filter(v => v.suggestedToken && !isDismissed(v));
  };

  // Get detachable violations for a group (only from remaining)
  const getDetachableViolations = (violations: LintViolation[]) => {
    return violations.filter(v => v.canDetach && !isDismissed(v));
  };

  if (!results) {
    return (
      <div className="results-container">
        <div className="results-empty">
          <div className="results-empty-icon">?</div>
          <p>No results yet</p>
          <p>Click "Scan" to lint your design tokens</p>
        </div>
      </div>
    );
  }

  if (results.violations.length === 0) {
    return (
      <div className="results-container">
        <div className="results-empty results-success">
          <div className="results-success-icon">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="24" cy="24" r="22" stroke="currentColor" strokeWidth="3" />
              <path d="M14 24L21 31L34 18" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <p className="results-success-title">No issues found!</p>
          <p className="results-success-subtitle">All checked nodes use proper design tokens</p>
        </div>
      </div>
    );
  }

  // Calculate total remaining violations
  const totalRemaining = results.violations.filter(v => !isDismissed(v)).length;
  const totalDismissed = fixedViolations.size + ignoredViolations.size;

  // Show "all resolved" state if all violations are dismissed
  if (totalRemaining === 0 && totalDismissed > 0) {
    return (
      <div className="results-container">
        <div className="results-empty results-success">
          <div className="results-success-icon">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="24" cy="24" r="22" stroke="currentColor" strokeWidth="3" />
              <path d="M14 24L21 31L34 18" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <p className="results-success-title">All issues resolved!</p>
          <p className="results-success-subtitle">{totalDismissed} issue{totalDismissed !== 1 ? 's' : ''} fixed or ignored</p>
        </div>
      </div>
    );
  }

  // Filter to only groups with remaining violations
  const groupKeys = Object.keys(groups).filter(key => {
    const remaining = getRemainingViolations(groups[key]);
    return remaining.length > 0;
  });

  return (
    <div className="results-container">
      <div className="results-toolbar">
        <div className="tabs">
          <button
            className={'tab ' + (groupBy === 'rule' ? 'active' : '')}
            onClick={() => onGroupByChange('rule')}
          >
            By Rule
          </button>
          <button
            className={'tab ' + (groupBy === 'node' ? 'active' : '')}
            onClick={() => onGroupByChange('node')}
          >
            By Node
          </button>
        </div>

        {fixableCount > 0 && (
          <button
            className="btn btn-fix-all"
            onClick={() => onBulkFix(results.violations)}
            disabled={isFixing}
          >
            {isFixing ? 'Fixing...' : 'Fix All (' + fixableCount + ')'}
          </button>
        )}
      </div>

      <div style={{ padding: 'var(--space-sm)' }}>
        {groupKeys.map(key => {
          const allViolations = groups[key];
          const remainingViolations = getRemainingViolations(allViolations);
          const isExpanded = expandedGroups.has(key);
          const groupName =
            groupBy === 'rule' ? RULE_NAMES[key as LintRuleId] || key : allViolations[0]?.nodeName || key;
          const fixableInGroup = getFixableViolations(allViolations);
          const detachableInGroup = getDetachableViolations(allViolations);
          const isUnknownStylesGroup = key === 'no-unknown-styles';

          return (
            <div key={key} className="results-group">
              <div className="results-group-header" onClick={() => toggleGroup(key)}>
                <span className="results-group-title">
                  <span className={'results-group-caret' + (isExpanded ? ' expanded' : '')}>&#9654;</span>
                  {groupName}
                </span>
                <div className="results-group-actions">
                  {fixableInGroup.length > 0 && (
                    <button
                      className="btn btn-fix-group"
                      onClick={e => {
                        e.stopPropagation();
                        onBulkFix(fixableInGroup);
                      }}
                      disabled={isFixing}
                      title={'Fix ' + fixableInGroup.length + ' issues in this group'}
                    >
                      Fix ({fixableInGroup.length})
                    </button>
                  )}
                  {isUnknownStylesGroup && detachableInGroup.length > 0 && (
                    <button
                      className="btn btn-detach-group"
                      onClick={e => {
                        e.stopPropagation();
                        onBulkDetach(detachableInGroup);
                      }}
                      disabled={isFixing}
                      title={'Detach ' + detachableInGroup.length + ' styles in this group'}
                    >
                      Detach All ({detachableInGroup.length})
                    </button>
                  )}
                  <span className="results-group-count">{remainingViolations.length}</span>
                </div>
              </div>

              {isExpanded && (
                <div className="results-group-items">
                  {remainingViolations.map(violation => (
                    <ResultItem
                      key={violation.id}
                      violation={violation}
                      showNodeInfo={groupBy === 'rule'}
                      showRuleInfo={groupBy === 'node'}
                      onSelect={() => onSelectNode(violation.nodeId)}
                      onFix={() => onFix(violation)}
                      onUnbind={() => onUnbind(violation)}
                      onDetach={() => onDetach(violation)}
                      onApplyStyle={() => onApplyStyle(violation)}
                      onIgnore={() => onIgnore(violation)}
                      isFixed={isFixed(violation)}
                      isIgnored={isIgnored(violation)}
                      isFixing={isFixing}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
