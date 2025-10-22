/**
 * Polyfill for structuredClone in Node.js < 17
 * Required for @typescript-eslint v8+ which depends on structuredClone
 *
 * Node.js 16.20.2 lacks native structuredClone (added in v17.0.0)
 * This polyfill provides a minimal implementation using JSON serialization
 * which is sufficient for ESLint's internal use cases.
 */

if (typeof global.structuredClone === "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  global.structuredClone = function structuredClone(obj) {
    // Simple JSON-based clone for basic objects
    // This is sufficient for ESLint's internal rule configuration handling
    if (obj === undefined || obj === null) {
      return obj;
    }

    // Handle primitive types
    if (typeof obj !== "object") {
      return obj;
    }

    // Use JSON serialize/deserialize for objects
    // This works for plain objects and arrays but loses:
    // - Functions
    // - undefined values
    // - Symbol keys
    // - Circular references
    // However, ESLint's rule configs don't use these features
    try {
      return JSON.parse(JSON.stringify(obj));
    } catch (error) {
      // Fallback for objects that can't be JSON serialized
      console.warn("structuredClone polyfill: JSON serialization failed, using shallow clone");
      return { ...obj };
    }
  };
}
