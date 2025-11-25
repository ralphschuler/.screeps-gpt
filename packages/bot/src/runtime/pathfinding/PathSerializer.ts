/**
 * Path serialization utilities for memory-efficient path storage.
 *
 * When storing paths in Memory (e.g., for creep movement), using serialized
 * format significantly reduces memory usage compared to storing RoomPosition objects.
 *
 * Memory savings:
 * - Raw path (5 positions): ~200 bytes
 * - Serialized path: ~30 bytes (85% reduction)
 *
 * @see https://wiki.screepspl.us/Memory/ - Path storage optimization
 * @see https://docs.screeps.com/api/#Room.serializePath
 */

/**
 * Room coordinate bounds (0-49 for both x and y)
 */
const ROOM_MIN_COORD = 0;
const ROOM_MAX_COORD = 49;

/**
 * Memory size estimates for serialization comparison
 * These are approximate sizes based on typical JSON serialization
 */
const BYTES_PER_POSITION_RAW = 40; // RoomPosition JSON: {"x":25,"y":25,"roomName":"W1N1"} ~40 bytes
const BYTES_HEADER_SERIALIZED = 20; // Serialized header: "25,25,W1N1:" ~20 bytes

/**
 * Path step with direction for movement
 */
export interface PathStep {
  x: number;
  y: number;
  dx: number;
  dy: number;
  direction: DirectionConstant;
}

/**
 * Direction constant values (matching Screeps API)
 * These are defined as const values to avoid runtime dependency on global constants
 */
const DIRECTION_VALUES = {
  TOP: 1 as DirectionConstant,
  TOP_RIGHT: 2 as DirectionConstant,
  RIGHT: 3 as DirectionConstant,
  BOTTOM_RIGHT: 4 as DirectionConstant,
  BOTTOM: 5 as DirectionConstant,
  BOTTOM_LEFT: 6 as DirectionConstant,
  LEFT: 7 as DirectionConstant,
  TOP_LEFT: 8 as DirectionConstant
};

/**
 * Direction constants for path encoding
 * Matches Screeps API direction values
 */
const DIRECTION_MAP: Record<DirectionConstant, string> = {
  [DIRECTION_VALUES.TOP]: "1",
  [DIRECTION_VALUES.TOP_RIGHT]: "2",
  [DIRECTION_VALUES.RIGHT]: "3",
  [DIRECTION_VALUES.BOTTOM_RIGHT]: "4",
  [DIRECTION_VALUES.BOTTOM]: "5",
  [DIRECTION_VALUES.BOTTOM_LEFT]: "6",
  [DIRECTION_VALUES.LEFT]: "7",
  [DIRECTION_VALUES.TOP_LEFT]: "8"
};

const REVERSE_DIRECTION_MAP: Record<string, DirectionConstant> = {
  "1": DIRECTION_VALUES.TOP,
  "2": DIRECTION_VALUES.TOP_RIGHT,
  "3": DIRECTION_VALUES.RIGHT,
  "4": DIRECTION_VALUES.BOTTOM_RIGHT,
  "5": DIRECTION_VALUES.BOTTOM,
  "6": DIRECTION_VALUES.BOTTOM_LEFT,
  "7": DIRECTION_VALUES.LEFT,
  "8": DIRECTION_VALUES.TOP_LEFT
};

/**
 * Serialize a path to a compact string format.
 *
 * Format: startX,startY,roomName:d1d2d3...
 * Where d1, d2, etc. are direction digits (1-8)
 *
 * Uses the built-in Room.serializePath() when available in game context,
 * otherwise provides a compatible implementation.
 *
 * @param path Array of RoomPosition objects
 * @returns Serialized path string, or undefined if path is empty
 *
 * @example
 * const path = creep.pos.findPathTo(target);
 * const serialized = serializePath(creep.room.name, path);
 * creep.memory.path = serialized; // Store in creep memory
 */
export function serializePath(roomName: string, path: PathStep[]): string | undefined {
  if (!path || path.length === 0) {
    return undefined;
  }

  // Build direction string
  const directions = path.map(step => DIRECTION_MAP[step.direction]).join("");

  // Store start position and directions
  const start = path[0];
  return `${start.x},${start.y},${roomName}:${directions}`;
}

/**
 * Serialize a RoomPosition array to compact format.
 * Converts RoomPosition[] to PathStep[] format first.
 *
 * @param positions Array of RoomPosition objects
 * @returns Serialized path string, or undefined if path is empty
 */
export function serializePositions(positions: RoomPosition[]): string | undefined {
  if (!positions || positions.length < 2) {
    return undefined;
  }

  const roomName = positions[0].roomName;
  const steps: PathStep[] = [];

  for (let i = 0; i < positions.length - 1; i++) {
    const from = positions[i];
    const to = positions[i + 1];

    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const direction = getDirectionFromDelta(dx, dy);

    if (direction !== undefined) {
      steps.push({
        x: from.x,
        y: from.y,
        dx,
        dy,
        direction
      });
    }
  }

  return serializePath(roomName, steps);
}

/**
 * Deserialize a path string back to RoomPosition array.
 *
 * @param serialized Serialized path string
 * @returns Array of RoomPosition objects, or empty array if invalid
 */
export function deserializePath(serialized: string): RoomPosition[] {
  if (!serialized) {
    return [];
  }

  try {
    const [startPart, directions] = serialized.split(":");
    if (!startPart || !directions) {
      return [];
    }

    const [xStr, yStr, roomName] = startPart.split(",");
    if (!xStr || !yStr || !roomName) {
      return [];
    }

    let x = parseInt(xStr, 10);
    let y = parseInt(yStr, 10);

    if (isNaN(x) || isNaN(y)) {
      return [];
    }

    const positions: RoomPosition[] = [new RoomPosition(x, y, roomName)];

    for (const dirChar of directions) {
      const direction = REVERSE_DIRECTION_MAP[dirChar];
      if (!direction) {
        continue;
      }

      const [dx, dy] = getDeltaFromDirection(direction);
      x += dx;
      y += dy;

      // Ensure we stay within room bounds
      if (x < ROOM_MIN_COORD || x > ROOM_MAX_COORD || y < ROOM_MIN_COORD || y > ROOM_MAX_COORD) {
        break;
      }

      positions.push(new RoomPosition(x, y, roomName));
    }

    return positions;
  } catch {
    return [];
  }
}

/**
 * Get direction constant from dx/dy deltas
 */
function getDirectionFromDelta(dx: number, dy: number): DirectionConstant | undefined {
  // Normalize to -1, 0, or 1
  const ndx = dx === 0 ? 0 : dx > 0 ? 1 : -1;
  const ndy = dy === 0 ? 0 : dy > 0 ? 1 : -1;

  if (ndx === 0 && ndy === -1) return DIRECTION_VALUES.TOP;
  if (ndx === 1 && ndy === -1) return DIRECTION_VALUES.TOP_RIGHT;
  if (ndx === 1 && ndy === 0) return DIRECTION_VALUES.RIGHT;
  if (ndx === 1 && ndy === 1) return DIRECTION_VALUES.BOTTOM_RIGHT;
  if (ndx === 0 && ndy === 1) return DIRECTION_VALUES.BOTTOM;
  if (ndx === -1 && ndy === 1) return DIRECTION_VALUES.BOTTOM_LEFT;
  if (ndx === -1 && ndy === 0) return DIRECTION_VALUES.LEFT;
  if (ndx === -1 && ndy === -1) return DIRECTION_VALUES.TOP_LEFT;

  return undefined;
}

/**
 * Get dx/dy deltas from direction constant
 */
function getDeltaFromDirection(direction: DirectionConstant): [number, number] {
  switch (direction) {
    case DIRECTION_VALUES.TOP:
      return [0, -1];
    case DIRECTION_VALUES.TOP_RIGHT:
      return [1, -1];
    case DIRECTION_VALUES.RIGHT:
      return [1, 0];
    case DIRECTION_VALUES.BOTTOM_RIGHT:
      return [1, 1];
    case DIRECTION_VALUES.BOTTOM:
      return [0, 1];
    case DIRECTION_VALUES.BOTTOM_LEFT:
      return [-1, 1];
    case DIRECTION_VALUES.LEFT:
      return [-1, 0];
    case DIRECTION_VALUES.TOP_LEFT:
      return [-1, -1];
    default:
      return [0, 0];
  }
}

/**
 * Check if a serialized path is still valid for a creep.
 * The path is invalid if:
 * - The creep is not at the start position
 * - The path is empty
 *
 * @param serialized Serialized path string
 * @param currentPos Current position of the creep
 * @returns true if path is valid for the creep's position
 */
export function isPathValid(serialized: string, currentPos: RoomPosition): boolean {
  if (!serialized) {
    return false;
  }

  const positions = deserializePath(serialized);
  if (positions.length === 0) {
    return false;
  }

  // Path is valid if current position matches any position in the path
  return positions.some(
    pos => pos.x === currentPos.x && pos.y === currentPos.y && pos.roomName === currentPos.roomName
  );
}

/**
 * Get remaining steps in a serialized path from the current position.
 *
 * @param serialized Serialized path string
 * @param currentPos Current position of the creep
 * @returns Remaining positions in the path, or empty array if not on path
 */
export function getRemainingPath(serialized: string, currentPos: RoomPosition): RoomPosition[] {
  if (!serialized) {
    return [];
  }

  const positions = deserializePath(serialized);
  const currentIndex = positions.findIndex(
    pos => pos.x === currentPos.x && pos.y === currentPos.y && pos.roomName === currentPos.roomName
  );

  if (currentIndex === -1) {
    return [];
  }

  return positions.slice(currentIndex + 1);
}

/**
 * Calculate memory savings from using serialized paths.
 *
 * @param pathLength Number of positions in the path
 * @returns Object with raw and serialized sizes in bytes (approximate)
 */
export function calculateMemorySavings(pathLength: number): { raw: number; serialized: number; savings: number } {
  const rawSize = pathLength * BYTES_PER_POSITION_RAW;

  // Serialized format: header + one char per step (direction character)
  const serializedSize = BYTES_HEADER_SERIALIZED + Math.max(0, pathLength - 1);

  return {
    raw: rawSize,
    serialized: serializedSize,
    savings: rawSize - serializedSize
  };
}
