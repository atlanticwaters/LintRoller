/**
 * Result Item Component
 */

import { useState } from 'preact/hooks';
import type { LintViolation, MatchConfidence } from '../../shared/types';

interface ResultItemProps {
  violation: LintViolation;
  showNodeInfo: boolean;
  showRuleInfo: boolean;
  onSelect: () => void;
  onFix: () => void;
  onUnbind: () => void;
  onDetach: () => void;
  onApplyStyle: () => void;
  onIgnore: () => void;
  isFixed: boolean;
  isIgnored: boolean;
  isFixing: boolean;
}

/**
 * Get CSS class for confidence level
 */
function getConfidenceClass(confidence?: MatchConfidence): string {
  switch (confidence) {
    case 'exact':
      return 'confidence-exact';
    case 'close':
      return 'confidence-close';
    case 'approximate':
      return 'confidence-approximate';
    default:
      return '';
  }
}

/**
 * Get label for confidence level
 */
function getConfidenceLabel(confidence?: MatchConfidence): string {
  switch (confidence) {
    case 'exact':
      return 'Exact match';
    case 'close':
      return 'Close match';
    case 'approximate':
      return 'Approximate';
    default:
      return '';
  }
}

export function ResultItem({ violation, showNodeInfo, showRuleInfo, onSelect, onFix, onUnbind, onDetach, onApplyStyle, onIgnore, isFixed, isIgnored, isFixing }: ResultItemProps) {
  const [showAlternatives, setShowAlternatives] = useState(false);
  const hasAlternatives = violation.alternativeTokens && violation.alternativeTokens.length > 0;
  const isDismissed = isFixed || isIgnored;
  const canFix = violation.suggestedToken && !isDismissed;
  const canUnbind = violation.canUnbind && !isDismissed;
  const canDetach = violation.canDetach && !isDismissed;
  const canApplyStyle = violation.canApplyTextStyle && violation.suggestedTextStyle && !isDismissed;
  const canIgnore = violation.canIgnore && !isDismissed;

  return (
    <div className={'result-item ' + violation.severity + (isFixed ? ' fixed' : '') + (isIgnored ? ' ignored' : '')} onClick={onSelect}>
      <div className="severity-indicator" />

      <div className="content">
        {showNodeInfo && (
          <div className="node-info">
            <span className="node-name">{violation.nodeName}</span>
            <span className="node-type">{violation.nodeType}</span>
          </div>
        )}

        <div className="message">
          {isFixed && <span className="fixed-badge">Fixed</span>}
          {isIgnored && <span className="ignored-badge">Ignored</span>}
          {violation.isPathMismatch && !isDismissed && (
            <span className="path-mismatch-badge" title="Auto-fixable: Only path syntax differs (/ vs .)">
              Path Mismatch
            </span>
          )}
          {violation.message}
        </div>

        {violation.suggestedToken && !isDismissed && (
          <div className={'suggestion ' + getConfidenceClass(violation.suggestionConfidence)}>
            <span className="suggestion-label">
              {violation.suggestionConfidence && (
                <span className={'confidence-badge ' + getConfidenceClass(violation.suggestionConfidence)}>
                  {getConfidenceLabel(violation.suggestionConfidence)}
                </span>
              )}
              Use: <code>{violation.suggestedToken}</code>
            </span>
            {hasAlternatives && (
              <button
                className="alternatives-toggle"
                onClick={e => {
                  e.stopPropagation();
                  setShowAlternatives(!showAlternatives);
                }}
              >
                {showAlternatives ? 'Hide' : 'Show'} {violation.alternativeTokens!.length} more
              </button>
            )}
          </div>
        )}

        {showAlternatives && hasAlternatives && !isDismissed && (
          <div className="alternatives-list">
            {violation.alternativeTokens!.map((alt, idx) => (
              <div key={idx} className="alternative-item">
                <code>{alt.path}</code>
                <span className="alternative-distance">
                  {typeof alt.value === 'string' ? alt.value : alt.value + 'px'} - {alt.description}
                </span>
              </div>
            ))}
          </div>
        )}

        {violation.suggestedTextStyle && !isDismissed && (
          <div className={'suggestion ' + (violation.suggestedTextStyle.matchQuality === 'exact' ? 'confidence-exact' : 'confidence-close')}>
            <span className="suggestion-label">
              <span className={'confidence-badge ' + (violation.suggestedTextStyle.matchQuality === 'exact' ? 'confidence-exact' : 'confidence-close')}>
                {violation.suggestedTextStyle.matchQuality === 'exact' ? 'Exact match' : 'Partial match'}
              </span>
              Apply style: <code>{violation.suggestedTextStyle.name}</code>
            </span>
          </div>
        )}
      </div>

      <div className="result-item-actions">
        {canFix && (
          <button
            className="btn btn-fix"
            onClick={e => {
              e.stopPropagation();
              onFix();
            }}
            disabled={isFixing}
            title={canUnbind ? "Rebind to suggested token" : "Apply suggested fix"}
          >
            {canUnbind ? 'Rebind' : 'Fix'}
          </button>
        )}
        {canUnbind && (
          <button
            className="btn btn-unbind"
            onClick={e => {
              e.stopPropagation();
              onUnbind();
            }}
            disabled={isFixing}
            title="Remove variable binding (keeps current value)"
          >
            Unbind
          </button>
        )}
        {canDetach && (
          <button
            className="btn btn-detach"
            onClick={e => {
              e.stopPropagation();
              onDetach();
            }}
            disabled={isFixing}
            title="Detach style (keeps current appearance)"
          >
            Detach
          </button>
        )}
        {canApplyStyle && (
          <button
            className="btn btn-apply-style"
            onClick={e => {
              e.stopPropagation();
              onApplyStyle();
            }}
            disabled={isFixing}
            title={'Apply text style: ' + violation.suggestedTextStyle!.name}
          >
            Apply Style
          </button>
        )}
        {canIgnore && (
          <button
            className="btn btn-ignore"
            onClick={e => {
              e.stopPropagation();
              onIgnore();
            }}
            disabled={isFixing}
            title="Ignore this issue (no matching style within tolerance)"
          >
            Ignore
          </button>
        )}
        <button className="btn btn-icon select-btn" onClick={e => { e.stopPropagation(); onSelect(); }} title="Select in Figma">
          {'→'}
        </button>
      </div>
    </div>
  );
}
