// src/components/MiniBarGraph.js

import React from 'react';

const MiniBarGraph = ({ history }) => {
  if (!history || history.length === 0) {
    return <p className="text-slate-400">No history available.</p>;
  }

  const recentHistory = history.slice(0, 5).reverse();
  const maxLevel = Math.max(...recentHistory.map(h => h.newValue));

  return (
    <div className="flex items-end h-32 space-x-2 p-4 bg-slate-800 rounded-lg">
      {recentHistory.map((record, index) => {
        const barHeight = (record.newValue / maxLevel) * 100;
        return (
          <div key={index} className="flex-1 flex flex-col items-center">
            <div
              className="w-8 bg-blue-500 rounded-t-sm relative group"
              style={{ height: `${barHeight}%` }}
            >
              <div className="absolute bottom-full mb-2 w-max px-2 py-1 bg-gray-900 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity">
                {record.newValue} units on {record.timestamp}
              </div>
            </div>
            <span className="text-xs text-slate-400 mt-1">
              {new Date(record.timestamp).toLocaleDateString()}
            </span>
          </div>
        );
      })}
    </div>
  );
};

export default MiniBarGraph;
