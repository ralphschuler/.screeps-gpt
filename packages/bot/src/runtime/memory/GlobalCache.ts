import { profile } from "@ralphschuler/screeps-profiler";

/**
 * Cache entry with optional TTL (time-to-live in ticks)
 */
interface CacheEntry<T> {
  value: T;
  createdAt: number;
  ttl?: number;
}

/**
 * Configuration for GlobalCache
 */
export interface GlobalCacheConfig {
  /**
   * Default TTL for cache entries in ticks
   * @default 100
   */
  defaultTtl?: number;

  /**
   * Maximum number of entries to store
   * @default 1000
   */
  maxEntries?: number;
}

/**
 * Global heap cache for volatile data that should not be persisted to Memory.
 *
 * Use cases (from wiki.screepspl.us/Memory/):
 * - Frequently recalculated, non-persistent data
 * - Expensive calculations that can be cached across ticks
 * - Data that doesn't need to survive code reloads
 *
 * Unlike Memory, GlobalCache:
 * - Does NOT serialize to JSON (no CPU overhead)
 * - Can store complex objects, functions, and references
 * - Is lost on code reload/respawn
 * - Has no size limit beyond heap memory
 *
 * @example
 * // Cache expensive pathfinding results
 * const pathCacheKey = `path:${from.x},${from.y}->${to.x},${to.y}`;
 * let path = globalCache.get<RoomPosition[]>(pathCacheKey);
 * if (!path) {
 *   path = findPath(from, to);
 *   globalCache.set(pathCacheKey, path, 50); // Cache for 50 ticks
 * }
 *
 * @see https://wiki.screepspl.us/Caching/
 */
@profile
export class GlobalCache {
  private readonly cache = new Map<string, CacheEntry<unknown>>();
  private readonly config: Required<GlobalCacheConfig>;
  private lastCleanupTick = 0;

  public constructor(config: GlobalCacheConfig = {}) {
    this.config = {
      defaultTtl: config.defaultTtl ?? 100,
      maxEntries: config.maxEntries ?? 1000
    };
  }

  /**
   * Get a cached value by key
   * @param key Cache key
   * @returns Cached value or undefined if not found/expired
   */
  public get<T>(key: string): T | undefined {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    if (!entry) {
      return undefined;
    }

    // Check TTL expiration
    const currentTick = typeof Game !== "undefined" ? Game.time : 0;
    if (entry.ttl !== undefined && currentTick - entry.createdAt > entry.ttl) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.value;
  }

  /**
   * Set a cached value with optional TTL
   * @param key Cache key
   * @param value Value to cache
   * @param ttl Time-to-live in ticks (optional, uses default if not provided)
   */
  public set<T>(key: string, value: T, ttl?: number): void {
    const currentTick = typeof Game !== "undefined" ? Game.time : 0;

    // Enforce max entries limit
    if (this.cache.size >= this.config.maxEntries && !this.cache.has(key)) {
      this.evictOldest();
    }

    this.cache.set(key, {
      value,
      createdAt: currentTick,
      ttl: ttl ?? this.config.defaultTtl
    });
  }

  /**
   * Check if a key exists and is not expired
   * @param key Cache key
   * @returns true if key exists and is valid
   */
  public has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  /**
   * Delete a cached entry
   * @param key Cache key
   * @returns true if the key was deleted
   */
  public delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all cached entries
   */
  public clear(): void {
    this.cache.clear();
  }

  /**
   * Get the number of cached entries
   */
  public get size(): number {
    return this.cache.size;
  }

  /**
   * Cleanup expired entries to free heap memory.
   * Should be called periodically (e.g., every N ticks).
   * @param currentTick Current game tick
   * @returns Number of entries cleaned up
   */
  public cleanup(currentTick: number): number {
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.ttl !== undefined && currentTick - entry.createdAt > entry.ttl) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    this.lastCleanupTick = currentTick;
    return cleaned;
  }

  /**
   * Get or compute a value, caching it for future use.
   * This is a convenience method for the common pattern of:
   * 1. Check cache
   * 2. If miss, compute value
   * 3. Store in cache
   * 4. Return value
   *
   * @param key Cache key
   * @param compute Function to compute value if not cached
   * @param ttl Optional TTL for the cached value
   * @returns Cached or computed value
   */
  public getOrCompute<T>(key: string, compute: () => T, ttl?: number): T {
    const cached = this.get<T>(key);
    if (cached !== undefined) {
      return cached;
    }

    const value = compute();
    this.set(key, value, ttl);
    return value;
  }

  /**
   * Evict the oldest entry when cache is full
   */
  private evictOldest(): void {
    // Map maintains insertion order, so first key is oldest
    const firstKey = this.cache.keys().next().value;
    if (firstKey) {
      this.cache.delete(firstKey);
    }
  }

  /**
   * Get cache statistics for monitoring
   */
  public getStats(): {
    size: number;
    maxEntries: number;
    lastCleanupTick: number;
  } {
    return {
      size: this.cache.size,
      maxEntries: this.config.maxEntries,
      lastCleanupTick: this.lastCleanupTick
    };
  }
}

/**
 * Global singleton cache instance.
 * This persists across ticks but is lost on code reload.
 */
export const globalCache = new GlobalCache();
