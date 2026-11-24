export type SortableArrowValue = number | 'X' | 'M';

/**
 * Returns numeric weight for descending archery arrow sorting:
 * 'X' > numeric descending (10, 9, 8, ... 1) > 'M' / 0 (0) > -1 / empty (-Infinity)
 */
export function getArrowSortWeight(val: SortableArrowValue | null | undefined | string): number {
  if (val === -1 || val === null || val === undefined || val === '') {
    return -1;
  }
  if (typeof val === 'string') {
    const upper = val.trim().toUpperCase();
    if (upper === 'X') return 1000;
    if (upper === 'M') return 0;
    const parsed = Number(upper);
    return Number.isFinite(parsed) ? parsed : -1;
  }
  if (typeof val === 'number') {
    return Number.isFinite(val) ? val : -1;
  }
  return -1;
}

/**
 * Sorts an array of arrow values from highest to lowest ('X' -> 10 -> 9 -> ... -> 1 -> 0/'M'),
 * while keeping unfilled (-1) slots at the end.
 */
export function sortArrowsDescending<T extends SortableArrowValue>(arrows: readonly T[]): T[] {
  return [...arrows].sort((a, b) => getArrowSortWeight(b) - getArrowSortWeight(a));
}
