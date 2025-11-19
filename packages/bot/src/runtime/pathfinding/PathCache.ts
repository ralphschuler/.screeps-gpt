/**
 * Path caching system with TTL (Time-To-Live) and LRU eviction
 * for CPU optimization by reducing redundant pathfinding operations.
 *
 * Key features:
 * - TTL-based expiration (default 1500 ticks ~100 game time)
 * - LRU eviction when cache exceeds size limit
 * - Cost matrix caching for terrain and structures
 * - Cache metrics tracking (hit rate, CPU savings)
 */

/**
 * Cached path entry with metadata
 */
export interface CachedPath {
  /** The calculated path as room positions */
  path: RoomPosition[];
  /** Tick when the path was cached */
  cachedAt: number;
  /** Number of operations used for pathfinding */
  ops: number;
  /** CPU cost of pathfinding operation */
  cpuCost: number;
  /** Whether pathfinding was incomplete */
  incomplete: boolean;
  /** Last tick this entry was accessed (for LRU) */
  lastAccessed: number;
}

/**
 * Cached cost matrix entry
 */
export interface CachedCostMatrix {
  /** The cost matrix */
  matrix: CostMatrix;
  /** Tick when the matrix was cached */
  cachedAt: number;
  /** Last tick this entry was accessed (for LRU) */
  lastAccessed: number;
}

/**
 * Cache metrics for monitoring and optimization
 */
export interface PathCacheMetrics {
  /** Total cache hits */
  hits: number;
  /** Total cache misses */
  misses: number;
  /** Cache hit rate (hits / (hits + misses)) */
  hitRate: number;
  /** Total CPU saved by cache hits */
  cpuSaved: number;
  /** Current cache size (path entries) */
  pathCacheSize: number;
  /** Current cost matrix cache size */
  costMatrixCacheSize: number;
  /** Number of entries evicted due to LRU */
  lruEvictions: number;
  /** Number of entries evicted due to TTL */
  ttlEvictions: number;
}

/**
 * Configuration for path cache
 */
export interface PathCacheConfig {
  /** TTL for cached paths in ticks (default: 1500) */
  ttl?: number;
  /** Maximum number of cached paths (default: 1000) */
  maxPathEntries?: number;
  /** Maximum number of cached cost matrices (default: 50) */
  maxCostMatrixEntries?: number;
  /** TTL for cost matrices in ticks (default: 3000) */
  costMatrixTtl?: number;
}

/**
 * Path cache system with TTL and LRU eviction
 */
export class PathCache {
  private readonly pathCache: Map<string, CachedPath> = new Map();
  private readonly costMatrixCache: Map<string, CachedCostMatrix> = new Map();

  private readonly ttl: number;
  private readonly maxPathEntries: number;
  private readonly maxCostMatrixEntries: number;
  private readonly costMatrixTtl: number;

  // Metrics
  private hits = 0;
  private misses = 0;
  private cpuSaved = 0;
  private lruEvictions = 0;
  private ttlEvictions = 0;

  public constructor(config: PathCacheConfig = {}) {
    this.ttl = config.ttl ?? 1500;
    this.maxPathEntries = config.maxPathEntries ?? 1000;
    this.maxCostMatrixEntries = config.maxCostMatrixEntries ?? 50;
    this.costMatrixTtl = config.costMatrixTtl ?? 3000;
  }

  /**
   * Generate cache key for a path
   * Format: fromX,fromY-toX,toY-roomName
   */
  public static generatePathKey(from: RoomPosition, to: RoomPosition, options?: { range?: number }): string {
    const range = options?.range ?? 1;
    return `${from.x},${from.y}-${to.x},${to.y}-${from.roomName}-${to.roomName}-r${range}`;
  }

  /**
   * Generate cache key for a cost matrix
   * Format: roomName-type
   */
  public static generateCostMatrixKey(roomName: string, type: "terrain" | "structures"): string {
    return `${roomName}-${type}`;
  }

  /**
   * Get a cached path if available and valid
   */
  public getPath(
    from: RoomPosition,
    to: RoomPosition,
    currentTick: number,
    options?: { range?: number }
  ): CachedPath | null {
    const key = PathCache.generatePathKey(from, to, options);
    const cached = this.pathCache.get(key);

    if (!cached) {
      this.misses++;
      return null;
    }

    // Check TTL
    if (currentTick - cached.cachedAt > this.ttl) {
      this.pathCache.delete(key);
      this.ttlEvictions++;
      this.misses++;
      return null;
    }

    // Update LRU timestamp
    cached.lastAccessed = currentTick;
    this.hits++;
    this.cpuSaved += cached.cpuCost;

    return cached;
  }

  /**
   * Cache a path
   */
  public setPath(
    from: RoomPosition,
    to: RoomPosition,
    path: RoomPosition[],
    currentTick: number,
    metadata: {
      ops: number;
      cpuCost: number;
      incomplete: boolean;
      range?: number;
    }
  ): void {
    // Evict old entries if cache is full
    if (this.pathCache.size >= this.maxPathEntries) {
      this.evictLRUPath(currentTick);
    }

    const key = PathCache.generatePathKey(from, to, { range: metadata.range });
    this.pathCache.set(key, {
      path,
      cachedAt: currentTick,
      ops: metadata.ops,
      cpuCost: metadata.cpuCost,
      incomplete: metadata.incomplete,
      lastAccessed: currentTick
    });
  }

  /**
   * Get a cached cost matrix if available and valid
   */
  public getCostMatrix(roomName: string, type: "terrain" | "structures", currentTick: number): CostMatrix | null {
    const key = PathCache.generateCostMatrixKey(roomName, type);
    const cached = this.costMatrixCache.get(key);

    if (!cached) {
      return null;
    }

    // Check TTL
    if (currentTick - cached.cachedAt > this.costMatrixTtl) {
      this.costMatrixCache.delete(key);
      this.ttlEvictions++;
      return null;
    }

    // Update LRU timestamp
    cached.lastAccessed = currentTick;

    return cached.matrix;
  }

  /**
   * Cache a cost matrix
   */
  public setCostMatrix(
    roomName: string,
    type: "terrain" | "structures",
    matrix: CostMatrix,
    currentTick: number
  ): void {
    // Evict old entries if cache is full
    if (this.costMatrixCache.size >= this.maxCostMatrixEntries) {
      this.evictLRUCostMatrix(currentTick);
    }

    const key = PathCache.generateCostMatrixKey(roomName, type);
    this.costMatrixCache.set(key, {
      matrix,
      cachedAt: currentTick,
      lastAccessed: currentTick
    });
  }

  /**
   * Invalidate all paths in a specific room
   */
  public invalidateRoom(roomName: string): void {
    for (const [key] of this.pathCache) {
      if (key.includes(roomName)) {
        this.pathCache.delete(key);
      }
    }

    // Also invalidate cost matrices for the room
    const terrainKey = PathCache.generateCostMatrixKey(roomName, "terrain");
    const structuresKey = PathCache.generateCostMatrixKey(roomName, "structures");
    this.costMatrixCache.delete(terrainKey);
    this.costMatrixCache.delete(structuresKey);
  }

  /**
   * Invalidate structure-based cost matrices for a room
   * (terrain cost matrices remain valid)
   */
  public invalidateStructures(roomName: string): void {
    const structuresKey = PathCache.generateCostMatrixKey(roomName, "structures");
    this.costMatrixCache.delete(structuresKey);

    // Invalidate paths in this room (structures affect pathing)
    for (const [key] of this.pathCache) {
      if (key.includes(roomName)) {
        this.pathCache.delete(key);
      }
    }
  }

  /**
   * Clear all cached entries
   */
  public clear(): void {
    this.pathCache.clear();
    this.costMatrixCache.clear();
  }

  /**
   * Get current cache metrics
   */
  public getMetrics(): PathCacheMetrics {
    const total = this.hits + this.misses;
    const hitRate = total > 0 ? this.hits / total : 0;

    return {
      hits: this.hits,
      misses: this.misses,
      hitRate,
      cpuSaved: this.cpuSaved,
      pathCacheSize: this.pathCache.size,
      costMatrixCacheSize: this.costMatrixCache.size,
      lruEvictions: this.lruEvictions,
      ttlEvictions: this.ttlEvictions
    };
  }

  /**
   * Reset metrics (useful for per-tick or periodic reporting)
   */
  public resetMetrics(): void {
    this.hits = 0;
    this.misses = 0;
    this.cpuSaved = 0;
    this.lruEvictions = 0;
    this.ttlEvictions = 0;
  }

  /**
   * Evict the least recently used path entry
   */
  private evictLRUPath(currentTick: number): void {
    let oldestKey: string | null = null;
    let oldestAccess = currentTick;

    for (const [key, entry] of this.pathCache) {
      if (entry.lastAccessed < oldestAccess) {
        oldestAccess = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.pathCache.delete(oldestKey);
      this.lruEvictions++;
    }
  }

  /**
   * Evict the least recently used cost matrix entry
   */
  private evictLRUCostMatrix(currentTick: number): void {
    let oldestKey: string | null = null;
    let oldestAccess = currentTick;

    for (const [key, entry] of this.costMatrixCache) {
      if (entry.lastAccessed < oldestAccess) {
        oldestAccess = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.costMatrixCache.delete(oldestKey);
      this.lruEvictions++;
    }
  }
}
