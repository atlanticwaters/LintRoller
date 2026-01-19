/**
 * Header Component
 */

import { useState } from 'preact/hooks';
import type { ScanScope } from '../../shared/types';

interface HeaderProps {
  onScan: () => void;
  isScanning: boolean;
  scope: ScanScope['type'];
  onScopeChange: (scope: ScanScope['type']) => void;
  onExport: (format: 'json' | 'csv') => void;
  hasResults: boolean;
  view: 'results' | 'config';
  onViewChange: (view: 'results' | 'config') => void;
}

export function Header({
  onScan,
  isScanning,
  scope,
  onScopeChange,
  onExport,
  hasResults,
  view,
  onViewChange,
}: HeaderProps) {
  const [showExportMenu, setShowExportMenu] = useState(false);

  return (
    <header className="header">
      <h1>Design Token Linter</h1>

      <div className="header-controls">
        <select
          className="select"
          value={scope}
          onChange={e => onScopeChange((e.target as HTMLSelectElement).value as ScanScope['type'])}
          disabled={isScanning}
        >
          <option value="selection">Selection</option>
          <option value="current_page">Current Page</option>
          <option value="full_document">Full Document</option>
        </select>

        <button className="btn btn-primary" onClick={onScan} disabled={isScanning}>
          {isScanning ? 'Scanning...' : 'Scan'}
        </button>

        <div className="export-menu">
          <button
            className="btn btn-secondary"
            onClick={() => setShowExportMenu(!showExportMenu)}
            disabled={!hasResults}
          >
            Export
          </button>

          {showExportMenu && (
            <div className="export-dropdown">
              <button
                onClick={() => {
                  onExport('json');
                  setShowExportMenu(false);
                }}
              >
                Export JSON
              </button>
              <button
                onClick={() => {
                  onExport('csv');
                  setShowExportMenu(false);
                }}
              >
                Export CSV
              </button>
            </div>
          )}
        </div>

        <button
          className="btn btn-icon"
          onClick={() => onViewChange(view === 'results' ? 'config' : 'results')}
          title={view === 'results' ? 'Settings' : 'Results'}
        >
          {view === 'results' ? '\u2699' : '\u2190'}
        </button>
      </div>
    </header>
  );
}
