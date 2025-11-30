/**
 * Weighted roulette selection used for spawn and target decisions.
 */
export function weightedSelect<T>(entries: Array<{ weight: number; value: T }>, rng = Math.random): T | null {
  const total = entries.reduce((sum, entry) => sum + Math.max(0, entry.weight), 0);
  if (total <= 0) return null;

  let roll = rng() * total;
  for (const entry of entries) {
    roll -= Math.max(0, entry.weight);
    if (roll <= 0) {
      return entry.value;
    }
  }
  return entries[entries.length - 1]?.value ?? null;
}
