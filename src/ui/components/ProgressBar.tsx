/**
 * Progress Bar Component
 */

interface ProgressBarProps {
  processed: number;
  total: number;
}

export function ProgressBar({ processed, total }: ProgressBarProps) {
  const percentage = total > 0 ? Math.round((processed / total) * 100) : 0;

  return (
    <div className="progress-container">
      <div className="progress-bar">
        <div className="fill" style={{ width: `${percentage}%` }} />
      </div>
      <div className="progress-text">
        Scanning... {processed} / {total} nodes ({percentage}%)
      </div>
    </div>
  );
}
