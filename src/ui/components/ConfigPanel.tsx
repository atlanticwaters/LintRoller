/**
 * Config Panel Component
 */

import type { LintConfig, LintRuleId, Severity } from '../../shared/types';

interface ConfigPanelProps {
  config: LintConfig;
  onChange: (config: LintConfig) => void;
}

// Rule display metadata
const RULES: Array<{ id: LintRuleId; name: string; description: string }> = [
  {
    id: 'no-hardcoded-colors',
    name: 'No Hardcoded Colors',
    description: 'Flags fills and strokes using literal colors',
  },
  {
    id: 'no-hardcoded-typography',
    name: 'No Hardcoded Typography',
    description: 'Flags unbound font properties on text nodes',
  },
  {
    id: 'no-hardcoded-spacing',
    name: 'No Hardcoded Spacing',
    description: 'Flags auto-layout frames with hardcoded gaps/padding',
  },
  {
    id: 'no-hardcoded-radii',
    name: 'No Hardcoded Radii',
    description: 'Flags nodes with hardcoded corner radius',
  },
  {
    id: 'no-orphaned-variables',
    name: 'No Orphaned Variables',
    description: 'Flags bindings to non-existent tokens',
  },
  {
    id: 'no-unknown-styles',
    name: 'No Unknown Styles',
    description: 'Flags styles not in the token set',
  },
];

export function ConfigPanel({ config, onChange }: ConfigPanelProps) {
  const toggleRule = (ruleId: LintRuleId) => {
    onChange({
      ...config,
      rules: {
        ...config.rules,
        [ruleId]: {
          ...config.rules[ruleId],
          enabled: !config.rules[ruleId].enabled,
        },
      },
    });
  };

  const setSeverity = (ruleId: LintRuleId, severity: Severity) => {
    onChange({
      ...config,
      rules: {
        ...config.rules,
        [ruleId]: {
          ...config.rules[ruleId],
          severity,
        },
      },
    });
  };

  const toggleOption = (option: 'skipHiddenLayers' | 'skipLockedLayers') => {
    onChange({
      ...config,
      [option]: !config[option],
    });
  };

  return (
    <div className="config-panel" style={{ flex: 1, overflowY: 'auto' }}>
      <div className="config-section">
        <h3>Rules</h3>
        {RULES.map(rule => (
          <div key={rule.id} style={{ marginBottom: 'var(--space-md)', padding: 'var(--space-sm)', backgroundColor: 'var(--figma-color-bg)', borderRadius: 'var(--radius-sm)' }}>
            <div className="config-row">
              <div>
                <div style={{ fontWeight: 500, fontSize: 'var(--font-size-sm)' }}>{rule.name}</div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--figma-color-text-secondary)' }}>
                  {rule.description}
                </div>
              </div>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={config.rules[rule.id].enabled}
                  onChange={() => toggleRule(rule.id)}
                />
                <span className="slider" />
              </label>
            </div>

            {config.rules[rule.id].enabled && (
              <div className="config-row" style={{ marginTop: 'var(--space-sm)' }}>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--figma-color-text-secondary)' }}>
                  Severity
                </span>
                <select
                  className="select"
                  value={config.rules[rule.id].severity}
                  onChange={e => setSeverity(rule.id, (e.target as HTMLSelectElement).value as Severity)}
                >
                  <option value="error">Error</option>
                  <option value="warning">Warning</option>
                  <option value="info">Info</option>
                </select>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="config-section">
        <h3>Scan Options</h3>

        <div className="config-row">
          <label>Skip hidden layers</label>
          <label className="toggle">
            <input
              type="checkbox"
              checked={config.skipHiddenLayers}
              onChange={() => toggleOption('skipHiddenLayers')}
            />
            <span className="slider" />
          </label>
        </div>

        <div className="config-row">
          <label>Skip locked layers</label>
          <label className="toggle">
            <input
              type="checkbox"
              checked={config.skipLockedLayers}
              onChange={() => toggleOption('skipLockedLayers')}
            />
            <span className="slider" />
          </label>
        </div>
      </div>
    </div>
  );
}
