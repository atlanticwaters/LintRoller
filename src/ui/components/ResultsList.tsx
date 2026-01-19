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
  fixedViolations: Set<string>;
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
  fixedViolations,
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

  // Get fixable violations for a group
  const getFixableViolations = (violations: LintViolation[]) => {
    return violations.filter(v => v.suggestedToken && !isFixed(v));
  };

  // Get detachable violations for a group
  const getDetachableViolations = (violations: LintViolation[]) => {
    return violations.filter(v => v.canDetach && !isFixed(v));
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
        <div className="results-empty">
          <div className="results-empty-icon">v</div>
          <p>No issues found!</p>
          <p>All checked nodes use proper design tokens</p>
        </div>
      </div>
    );
  }

  const groupKeys = Object.keys(groups);

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
          const violations = groups[key];
          const isExpanded = expandedGroups.has(key);
          const groupName =
            groupBy === 'rule' ? RULE_NAMES[key as LintRuleId] || key : violations[0]?.nodeName || key;
          const fixableInGroup = getFixableViolations(violations);
          const detachableInGroup = getDetachableViolations(violations);
          const isUnknownStylesGroup = key === 'no-unknown-styles';

          return (
            <div key={key} className="results-group">
              <div className="results-group-header" onClick={() => toggleGroup(key)}>
                <span>
                  {isExpanded ? '>' : '>'} {groupName}
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
                  <span className="results-group-count">{violations.length}</span>
                </div>
              </div>

              {isExpanded && (
                <div className="results-group-items">
                  {violations.map(violation => (
                    <ResultItem
                      key={violation.id}
                      violation={violation}
                      showNodeInfo={groupBy === 'rule'}
                      showRuleInfo={groupBy === 'node'}
                      onSelect={() => onSelectNode(violation.nodeId)}
                      onFix={() => onFix(violation)}
                      onUnbind={() => onUnbind(violation)}
                      onDetach={() => onDetach(violation)}
                      isFixed={isFixed(violation)}
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
