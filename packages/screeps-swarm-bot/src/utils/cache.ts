const TTL = 50;

export interface CachedValue<T> {
  value: T;
  expires: number;
}

export function isExpired<T>(entry: CachedValue<T> | undefined, time: number): boolean {
  return !entry || entry.expires <= time;
}

export function cacheValue<T>(value: T, time: number, ttl: number = TTL): CachedValue<T> {
  return { value, expires: time + ttl };
}
