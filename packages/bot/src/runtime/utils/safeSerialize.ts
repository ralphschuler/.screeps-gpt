/**
 * Safely serializes any value to a string for console logging.
 * Handles errors, circular references, complex objects, and edge cases
 * to prevent "Cannot convert object to primitive value" errors in Screeps console.
 *
 * @param value - The value to serialize
 * @returns A string representation that's safe for console output
 *
 * @example
 * ```typescript
 * // Safe error logging
 * console.log(`Error: ${safeSerialize(error)}`);
 *
 * // Safe object logging
 * console.log(`Data: ${safeSerialize(complexObject)}`);
 * ```
 */
export function safeSerialize(value: unknown): string {
  try {
    // Handle null/undefined
    if (value === null) return "null";
    if (value === undefined) return "undefined";

    // Handle primitives by type
    switch (typeof value) {
      case "string":
        return value;
      case "number":
      case "boolean":
      case "bigint":
        return String(value);
      case "symbol":
        return value.toString();
      case "function":
        return "[Function]";
    }

    // At this point, value must be an object (but not null, already handled)

    // Handle Error objects (including Zod errors)
    if (value instanceof Error) {
      const errorObj: Record<string, unknown> = {
        name: value.name,
        message: value.message
      };

      // Include stack if available
      if (value.stack) {
        errorObj.stack = value.stack;
      }

      // Include Zod-specific issues if present
      if ("issues" in value) {
        errorObj.issues = value.issues;
      }

      // Include any other enumerable properties
      for (const key in value) {
        if (Object.prototype.hasOwnProperty.call(value, key) && !(key in errorObj)) {
          errorObj[key] = (value as Record<string, unknown>)[key];
        }
      }

      return JSON.stringify(errorObj);
    }

    // Try JSON.stringify with circular reference handling
    const seen = new WeakSet<object>();
    return JSON.stringify(value, (_key, val: unknown) => {
      if (typeof val === "object" && val !== null) {
        if (seen.has(val)) {
          return "[Circular]";
        }
        seen.add(val);
      }
      return val;
    });
  } catch {
    // Last resort: return type description
    // This handles objects that can't be stringified at all
    try {
      return `[Unserializable: ${typeof value}]`;
    } catch {
      return "[Unserializable: unknown]";
    }
  }
}
