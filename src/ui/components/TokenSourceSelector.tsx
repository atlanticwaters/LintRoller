import type { TokenSource } from '../../shared/types';

interface TokenSourceSelectorProps {
  source: TokenSource;
  onSourceChange: (source: TokenSource) => void;
  isLoading: boolean;
  tokenCount: number;
}

export function TokenSourceSelector({
  source,
  onSourceChange,
  isLoading,
  tokenCount,
}: TokenSourceSelectorProps) {
  return (
    <div className="token-source-selector">
      <div className="token-source-row">
        <label className="token-source-label">Tokens</label>
        <select
          className="select"
          value={source}
          onChange={e => onSourceChange((e.target as HTMLSelectElement).value as TokenSource)}
          disabled={isLoading}
        >
          <option value="local">Local (Bundled)</option>
          <option value="github">GitHub (Remote)</option>
        </select>
      </div>
      <span className="token-source-info">
        {isLoading ? 'Loading tokens\u2026' : `${tokenCount} tokens loaded`}
      </span>
    </div>
  );
}
