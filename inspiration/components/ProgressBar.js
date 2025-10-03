// src/components/ProgressBar.js
import React from 'react';

/**
 * A simple, reusable progress bar component.
 * @param {{ progress: number }} props - The progress percentage (0-100).
 */
const ProgressBar = ({ progress }) => {
  // Ensure progress is within 0-100 bounds
  const clampedProgress = Math.max(0, Math.min(100, progress));

  return (
    <div className="w-full bg-slate-700 rounded-full h-2.5 my-1">
      <div
        className="bg-blue-500 h-2.5 rounded-full transition-all duration-300 ease-out"
        style={{ width: `${clampedProgress}%` }}
        role="progressbar"
        aria-valuenow={clampedProgress}
        aria-valuemin="0"
        aria-valuemax="100"
      ></div>
    </div>
  );
};

export default ProgressBar;
