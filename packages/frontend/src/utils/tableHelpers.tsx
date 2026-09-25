import type { JSX } from 'react';

/**
 * Returns a sort indicator icon based on the current sort column and direction.
 * @param {string} currentSortColumn - The column currently being sorted.
 * @param {string} columnKey - The key of the column for this indicator.
 * @param {string} currentSortDirection - The current sort direction ('asc' or 'desc').
 * @returns {JSX.Element} - A FontAwesome icon element.
 */
export const getSortIndicator = (
  currentSortColumn: string,
  columnKey: string,
  currentSortDirection: 'asc' | 'desc'
): JSX.Element => {
  if (currentSortColumn === columnKey) {
    return currentSortDirection === 'asc' ? (
      <i className="fas fa-sort-up ml-1"></i>
    ) : (
      <i className="fas fa-sort-down ml-1"></i>
    );
  }
  return (
    <i className="fas fa-sort ml-1 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity"></i>
  );
};

/**
 * A natural sort comparator for strings containing numbers, with special handling for storage units (GB, TB).
 * @param {*} a - The first value to compare.
 * @param {*} b - The second value to compare.
 * @param {string} direction - The sort direction ('asc' or 'desc').
 * @returns {number} - -1, 0, or 1.
 */
export const naturalSort = (
  a: string | number | undefined,
  b: string | number | undefined,
  direction: 'asc' | 'desc'
): number => {
  function extractStorageSize(str: string): number | null {
    const match = String(str).match(/(\d+(?:\.\d+)?)\s*(KB|MB|GB|TB|PB)/i);
    if (!match) return null;
    const value = parseFloat(match[1]);
    const unit = match[2].toUpperCase();
    const multipliers: Record<string, number> = {
      KB: 1024,
      MB: 1024 * 1024,
      GB: 1024 * 1024 * 1024,
      TB: 1024 * 1024 * 1024 * 1024,
      PB: 1024 * 1024 * 1024 * 1024 * 1024,
    };
    return value * (multipliers[unit] ?? 1);
  }

  const sizeA = extractStorageSize(String(a));
  const sizeB = extractStorageSize(String(b));
  if (sizeA !== null && sizeB !== null) {
    return direction === 'asc' ? sizeA - sizeB : sizeB - sizeA;
  }

  const aStr = String(a ?? '');
  const bStr = String(b ?? '');
  const dir = direction === 'asc' ? 1 : -1;

  // Regex to tokenize the string into parts of consecutive non-digits (and non-space) or consecutive digits.
  const re = /(\D+)|(\d+)/g; // Changed regex to correctly capture non-digits and digits
  const aTokens = aStr.match(re) || [];
  const bTokens = bStr.match(re) || [];

  const len = Math.min(aTokens.length, bTokens.length);

  for (let i = 0; i < len; i++) {
    const aPart = aTokens[i];
    const bPart = bTokens[i];

    const aIsNum = !isNaN(parseFloat(aPart)) && isFinite(Number(aPart)); // More robust number check
    const bIsNum = !isNaN(parseFloat(bPart)) && isFinite(Number(bPart));

    if (aIsNum && bIsNum) {
      let aNum = parseFloat(aPart);
      let bNum = parseFloat(bPart);

      // Check for storage units (TB, GB, MB) in the next token and adjust the number
      const nextAToken = (aTokens[i + 1] || '').toUpperCase();
      const nextBToken = (bTokens[i + 1] || '').toUpperCase();

      if (nextAToken === 'TB') aNum *= 1000;
      else if (nextAToken === 'MB') aNum /= 1000;

      if (nextBToken === 'TB') bNum *= 1000;
      else if (nextBToken === 'MB') bNum /= 1000;

      if (aNum !== bNum) {
        return (aNum - bNum) * dir;
      }
    } else {
      // If one is a number and the other is not, numbers come first.
      if (aIsNum !== bIsNum) {
        return (aIsNum ? -1 : 1) * dir;
      }
      // Otherwise, compare as strings
      const comparison = aPart.toLowerCase().localeCompare(bPart.toLowerCase());
      if (comparison !== 0) return comparison * dir;
    }
  }

  // If one string is a prefix of the other, the shorter one comes first.
  return (aTokens.length - bTokens.length) * dir;
};
