/* eslint-disable @typescript-eslint/no-explicit-any */
export * from "./CacheDecorators.js";
export * from "./CacheKeys.js";
export * from "./CacheMethods.js";
export * from "./GetterCache.js";
export * from "./Rehydraters.js";

declare global {
  interface Memory {
    cache: {
      [type: string]: {
        [id: string]: any;
      };
    };
  }
}
