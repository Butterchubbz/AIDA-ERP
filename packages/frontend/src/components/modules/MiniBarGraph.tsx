import React from 'react';

interface HistoryEntry {
  date: string;
  value: number;
}

interface MiniBarGraphProps {
  history: HistoryEntry[];
}

const MiniBarGraph: React.FC<MiniBarGraphProps> = ({ history }) => {
  return (
    <div className="w-full bg-slate-700 rounded-lg p-2">
      <p className="text-sm text-slate-400">Mini Bar Graph Placeholder</p>
      {/* Render a simple representation of history data */}
      {history.length > 0 ? (
        <div className="flex items-end h-16 space-x-1">
          {history.map((entry, index) => (
            <div
              key={index}
              className="w-2 bg-blue-500"
              style={{ height: `${Math.min((entry.value / 100) * 16, 16)}px` }} // Example scaling
              title={`${entry.date}: ${entry.value}`}
            ></div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-slate-500">No history data.</p>
      )}
    </div>
  );
};

export default MiniBarGraph;
