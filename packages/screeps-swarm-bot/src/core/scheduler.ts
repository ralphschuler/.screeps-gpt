export interface SchedulerTicks {
  medium: number;
  low: number;
}

const DEFAULT_INTERVALS: SchedulerTicks = { medium: 5, low: 20 };

export function shouldRunMedium(currentTick: number, intervals: SchedulerTicks = DEFAULT_INTERVALS): boolean {
  return currentTick % intervals.medium === 0;
}

export function shouldRunLow(currentTick: number, intervals: SchedulerTicks = DEFAULT_INTERVALS): boolean {
  return currentTick % intervals.low === 0;
}
