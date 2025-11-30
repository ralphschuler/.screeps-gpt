export function selectExitTowards(room: Room, targetRoom: string): RoomPosition | null {
  const exitDir = room.findExitTo(targetRoom);
  if (exitDir === ERR_NO_PATH || exitDir === ERR_INVALID_ARGS) return null;
  const exits = room.find(exitDir);
  if (exits.length === 0) return null;
  return exits[Math.floor(Math.random() * exits.length)] ?? null;
}
