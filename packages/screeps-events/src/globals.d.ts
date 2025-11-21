/**
 * Minimal global type declarations for Screeps Game object
 * This allows the package to work without full @types/screeps dependency
 */
declare global {
  const Game: {
    time: number;
  };
}

export {};
