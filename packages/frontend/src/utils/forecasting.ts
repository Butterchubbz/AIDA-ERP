/**
 * Calculates the slope and intercept for a simple linear regression.
 * @param {number[]} y - An array of dependent variables (e.g., sales).
 * @param {number[]} x - An array of independent variables (e.g., time periods).
 * @returns {{slope: number, intercept: number}} - The slope and intercept of the regression line.
 */
export const simpleLinearRegression = (
  y: number[],
  x: number[]
): { slope: number; intercept: number } => {
  const n = y.length;
  if (n < 2) return { slope: 0, intercept: y[0] || 0 };

  let sum_x = 0;
  let sum_y = 0;
  let sum_xy = 0;
  let sum_xx = 0;

  for (let i = 0; i < n; i++) {
    sum_x += x[i];
    sum_y += y[i];
    sum_xy += x[i] * y[i];
    sum_xx += x[i] * x[i];
  }

  const denominator = n * sum_xx - sum_x * sum_x;
  if (denominator === 0) return { slope: 0, intercept: sum_y / n };

  const slope = (n * sum_xy - sum_x * sum_y) / denominator;
  const intercept = (sum_y - slope * sum_x) / n;

  return { slope, intercept };
};
