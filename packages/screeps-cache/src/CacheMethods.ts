/* eslint-disable @typescript-eslint/no-explicit-any */
export interface CacheMethod {
  get: (key: any, propertyKey: string) => unknown;
  set: (key: any, propertyKey: string, newValue: any) => void;
}

// Access Memory from global context (works in both Node.js and Screeps)
const getMemory = (): any => {
  if (typeof global !== 'undefined' && (global as any).Memory) {
    return (global as any).Memory;
  }
  if (typeof globalThis !== 'undefined' && (globalThis as any).Memory) {
    return (globalThis as any).Memory;
  }
  return undefined;
};

export const MemoryCache = {
  get: (key: string, propertyKey: string): unknown => getMemory()?.cache?.[key]?.[propertyKey],
  set: (key: string, propertyKey: string, newValue: unknown): void => {
    const memory = getMemory();
    if (!memory) return;
    memory.cache ??= {};
    memory.cache[key] ??= {};
    memory.cache[key][propertyKey] = newValue;
  }
};

const cache = new WeakMap<Record<string, unknown>, Record<string, unknown>>();
export const HeapCache = {
  get: (key: Record<string, unknown>, propertyKey: string): unknown => {
    return (cache.get(key) ?? {})[propertyKey];
  },
  set: (key: Record<string, unknown>, propertyKey: string, newValue: unknown): void => {
    cache.set(key, {
      ...(cache.get(key) ?? {}),
      [propertyKey]: newValue
    });
  }
};
