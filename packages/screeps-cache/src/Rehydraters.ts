/* eslint-disable @typescript-eslint/no-explicit-any */
export type Rehydrater = (data: any) => unknown;

export const defaultRehydrater: Rehydrater = d => d;

// Access RoomPosition from global context (works in both Node.js and Screeps)
const getRoomPosition = (): any => {
  if (typeof global !== "undefined" && (global as any).RoomPosition) {
    return (global as any).RoomPosition;
  }
  return undefined;
};

export const asRoomPosition: Rehydrater = (pos: { x: number; y: number; roomName: string } | undefined): any => {
  if (!pos) return;
  const RoomPositionClass = getRoomPosition();
  if (!RoomPositionClass) return pos;
  return new RoomPositionClass(pos.x, pos.y, pos.roomName);
};
