/**
 * ArrayOptimizer - Replaces native array methods with faster for-loop implementations
 *
 * Native JavaScript array methods have overhead from their internal implementation.
 * These optimized versions use simple for-loops which are faster in V8 engine.
 */

/**
 * Optimizes Array.prototype methods by replacing them with faster for-loop implementations
 */
export function optimizeArrayMethods(): void {
  /**
   * Optimized filter implementation using for-loop
   */
  Array.prototype.filter = function <T>(
    this: T[],
    callback: (value: T, index: number, array: T[]) => boolean,
    thisArg?: unknown
  ): T[] {
    const results: T[] = [];
    for (let iterator = 0; iterator < this.length; iterator++) {
      if (callback.call(thisArg, this[iterator]!, iterator, this)) {
        results.push(this[iterator]!);
      }
    }
    return results;
  };

  /**
   * Optimized forEach implementation using for-loop
   */
  Array.prototype.forEach = function <T>(
    this: T[],
    callback: (value: T, index: number, array: T[]) => void,
    thisArg?: unknown
  ): void {
    for (let iterator = 0; iterator < this.length; iterator++) {
      callback.call(thisArg, this[iterator]!, iterator, this);
    }
  };

  /**
   * Optimized map implementation using for-loop
   */
  Array.prototype.map = function <T, U>(
    this: T[],
    callback: (value: T, index: number, array: T[]) => U,
    thisArg?: unknown
  ): U[] {
    const returnVal: U[] = [];
    for (let iterator = 0; iterator < this.length; iterator++) {
      returnVal.push(callback.call(thisArg, this[iterator]!, iterator, this));
    }
    return returnVal;
  };
}
