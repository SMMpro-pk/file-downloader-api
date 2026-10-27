/**
 * Formats bytes into a human-readable string.
 * Returns null if size is null, undefined, or invalid (per requirement: do not fabricate 0 for unknown sizes).
 * @param {number|string|null|undefined} bytes
 * @returns {string|null}
 */
export function formatBytes(bytes) {
  if (bytes === null || bytes === undefined || bytes === '') {
    return null;
  }

  const num = typeof bytes === 'number' ? bytes : Number(bytes);
  if (isNaN(num) || num < 0) {
    return null;
  }

  if (num === 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(num) / Math.log(1024));
  const unitIndex = Math.min(i, units.length - 1);
  const value = num / Math.pow(1024, unitIndex);

  // Use 1 decimal place for values >= 10, or 2 decimal places for smaller
  const formatted = value >= 10 ? value.toFixed(1) : value.toFixed(2);
  // Remove trailing .0 or .00
  const cleanFormatted = formatted.replace(/\.?0+$/, (match, offset) => {
    // Keep .0 if exactly .0? Or cleaner without trailing zeros
    return '';
  });

  return `${cleanFormatted} ${units[unitIndex]}`;
}

export default formatBytes;
