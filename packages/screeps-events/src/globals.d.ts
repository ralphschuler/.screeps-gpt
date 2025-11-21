/**
 * Minimal global type declarations for Screeps Game object
 * This allows the package to work without full @types/screeps dependency
 */
declare global {
  const Game: {
    time: number;
  };

  // Screeps type aliases for type-safe event payloads
  type StructureConstant = string;
  type BuildableStructureConstant = string;
  type Id<T> = string & { readonly __id__: T };
  type Structure = unknown;
  type ConstructionSite = unknown;
}

export {};
