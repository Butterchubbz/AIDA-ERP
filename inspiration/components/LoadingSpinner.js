// src/components/LoadingSpinner.js

import React from 'react';

/**
 * A simple loading spinner component.
 * Uses Tailwind CSS for styling the animation.
 */
const LoadingSpinner = () => {
  return (
    <div className="flex justify-center items-center py-8">
      {/* The spinner visual */}
      <div
        className="
                    animate-spin
                    rounded-full
                    h-12
                    w-12
                    border-t-4
                    border-b-4
                    border-blue-500
                    border-solid
                "
        role="status"
        aria-label="Loading"
      >
        {/* Visually hidden text for screen readers */}
        <span className="sr-only">Loading...</span>
      </div>
    </div>
  );
};

export default LoadingSpinner;
