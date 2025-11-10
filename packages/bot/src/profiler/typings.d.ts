// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface Memory {
  profiler: ProfilerMemory;
}

interface ProfilerMemory {
  data: { [name: string]: ProfilerData };
  start?: number;
  total: number;
}

interface ProfilerData {
  calls: number;
  time: number;
}

interface Profiler {
  clear(): string;
  output(): string;
  start(): string;
  status(): string;
  stop(): string;
  toString(): string;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
declare const __PROFILER_ENABLED__: boolean;

declare global {
  namespace NodeJS {
    interface Global {
      Profiler?: Profiler;
    }
  }

  interface Window {
    Profiler?: Profiler;
  }

  let Profiler: Profiler | undefined;
}

export {};
