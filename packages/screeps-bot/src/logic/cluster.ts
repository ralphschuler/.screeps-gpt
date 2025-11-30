/**
 * Cluster Logic & Inter-Room Logistics - Phase 13
 *
 * Cluster formation, resource balancing, and coordination.
 */

import type { SwarmState, ClusterMemory, OvermindMemory } from "../memory/schemas";

/**
 * Get overmind memory
 */
function getOvermind(): OvermindMemory {
  const mem = Memory as unknown as Record<string, OvermindMemory>;
  return mem["overmind"]!;
}

// Ensure getOvermind is used
void getOvermind;

/**
 * Get clusters memory
 */
function getClusters(): Record<string, ClusterMemory> {
  const mem = Memory as unknown as Record<string, Record<string, ClusterMemory>>;
  if (!mem["clusters"]) {
    mem["clusters"] = {};
  }
  return mem["clusters"];
}

// =============================================================================
// 13.1 Cluster Formation
// =============================================================================

/**
 * Create a new cluster
 */
export function createCluster(coreRoom: string): ClusterMemory {
  const clusters = getClusters();
  const id = `cluster_${coreRoom}`;

  const cluster: ClusterMemory = {
    id,
    coreRoom,
    memberRooms: [coreRoom],
    remoteRooms: [],
    forwardBases: [],
    role: "economic",
    metrics: {
      energyIncome: 0,
      energyConsumption: 0,
      energyBalance: 0,
      warIndex: 0,
      economyIndex: 50
    },
    squads: [],
    rallyPoints: [],
    lastUpdate: Game.time
  };

  clusters[id] = cluster;
  return cluster;
}

/**
 * Get or create cluster for room
 */
export function getOrCreateCluster(roomName: string): ClusterMemory {
  const clusters = getClusters();

  // Check if room already belongs to a cluster
  for (const cluster of Object.values(clusters)) {
    if (
      cluster.coreRoom === roomName ||
      cluster.memberRooms.includes(roomName) ||
      cluster.remoteRooms.includes(roomName) ||
      cluster.forwardBases.includes(roomName)
    ) {
      return cluster;
    }
  }

  // Create new cluster
  return createCluster(roomName);
}

/**
 * Add room to cluster
 */
export function addRoomToCluster(clusterId: string, roomName: string, type: "member" | "remote" | "forward"): void {
  const cluster = getClusters()[clusterId];
  if (!cluster) return;

  switch (type) {
    case "member":
      if (!cluster.memberRooms.includes(roomName)) {
        cluster.memberRooms.push(roomName);
      }
      break;
    case "remote":
      if (!cluster.remoteRooms.includes(roomName)) {
        cluster.remoteRooms.push(roomName);
      }
      break;
    case "forward":
      if (!cluster.forwardBases.includes(roomName)) {
        cluster.forwardBases.push(roomName);
      }
      break;
  }
}

/**
 * Remove room from cluster
 */
export function removeRoomFromCluster(clusterId: string, roomName: string): void {
  const cluster = getClusters()[clusterId];
  if (!cluster) return;

  cluster.memberRooms = cluster.memberRooms.filter(r => r !== roomName);
  cluster.remoteRooms = cluster.remoteRooms.filter(r => r !== roomName);
  cluster.forwardBases = cluster.forwardBases.filter(r => r !== roomName);
}

/**
 * Algorithm to assign rooms to clusters based on adjacency
 */
export function assignRoomsToClusters(ownedRooms: string[]): void {
  const clusters = getClusters();

  // Ensure each owned room has a cluster
  for (const roomName of ownedRooms) {
    let foundCluster = false;

    for (const cluster of Object.values(clusters)) {
      if (cluster.memberRooms.includes(roomName)) {
        foundCluster = true;
        break;
      }
    }

    if (!foundCluster) {
      // Find nearest cluster or create new one
      let nearestCluster: ClusterMemory | null = null;
      let minDistance = Infinity;

      for (const cluster of Object.values(clusters)) {
        const distance = Game.map.getRoomLinearDistance(roomName, cluster.coreRoom);
        if (distance < minDistance && distance <= 3) {
          minDistance = distance;
          nearestCluster = cluster;
        }
      }

      if (nearestCluster) {
        addRoomToCluster(nearestCluster.id, roomName, "member");
      } else {
        createCluster(roomName);
      }
    }
  }
}

// =============================================================================
// 13.2 Resource Balancing
// =============================================================================

/**
 * Resource transfer request
 */
export interface TransferRequest {
  from: string;
  to: string;
  resource: ResourceConstant;
  amount: number;
  priority: number;
}

/**
 * Calculate cluster resource status
 */
export function calculateClusterResourceStatus(
  cluster: ClusterMemory
): Record<ResourceConstant, { surplus: number; deficit: number; rooms: Map<string, number> }> {
  const status: Record<string, { surplus: number; deficit: number; rooms: Map<string, number> }> = {};

  // Target levels
  const targets: Partial<Record<ResourceConstant, number>> = {
    [RESOURCE_ENERGY]: 100000,
    [RESOURCE_POWER]: 10000,
    [RESOURCE_HYDROGEN]: 10000,
    [RESOURCE_OXYGEN]: 10000,
    [RESOURCE_UTRIUM]: 10000,
    [RESOURCE_LEMERGIUM]: 10000,
    [RESOURCE_KEANIUM]: 10000,
    [RESOURCE_ZYNTHIUM]: 10000,
    [RESOURCE_CATALYST]: 5000
  };

  for (const roomName of cluster.memberRooms) {
    const room = Game.rooms[roomName];
    if (!room) continue;

    const storage = room.storage;
    const terminal = room.terminal;

    for (const [resourceStr, target] of Object.entries(targets)) {
      const resource = resourceStr as ResourceConstant;
      const storageAmount = storage?.store.getUsedCapacity(resource) ?? 0;
      const terminalAmount = terminal?.store.getUsedCapacity(resource) ?? 0;
      const total = storageAmount + terminalAmount;

      if (!status[resource]) {
        status[resource] = { surplus: 0, deficit: 0, rooms: new Map() };
      }

      status[resource].rooms.set(roomName, total);

      if (total > target * 1.5) {
        status[resource].surplus += total - target;
      } else if (total < target * 0.5) {
        status[resource].deficit += target - total;
      }
    }
  }

  return status as Record<ResourceConstant, { surplus: number; deficit: number; rooms: Map<string, number> }>;
}

/**
 * Generate transfer requests for cluster
 */
export function generateTransferRequests(cluster: ClusterMemory): TransferRequest[] {
  const requests: TransferRequest[] = [];
  const status = calculateClusterResourceStatus(cluster);

  for (const [resourceStr, resourceStatus] of Object.entries(status)) {
    const resource = resourceStr as ResourceConstant;

    // Skip if no deficit or surplus
    if (resourceStatus.deficit === 0 || resourceStatus.surplus === 0) continue;

    // Find rooms with surplus and deficit
    const surplusRooms: Array<{ room: string; amount: number }> = [];
    const deficitRooms: Array<{ room: string; amount: number }> = [];

    const targets: Partial<Record<ResourceConstant, number>> = {
      [RESOURCE_ENERGY]: 100000,
      [RESOURCE_POWER]: 10000
    };
    const target = targets[resource] ?? 10000;

    for (const [roomName, amount] of resourceStatus.rooms) {
      if (amount > target * 1.5) {
        surplusRooms.push({ room: roomName, amount: amount - target });
      } else if (amount < target * 0.5) {
        deficitRooms.push({ room: roomName, amount: target - amount });
      }
    }

    // Create transfer requests
    for (const deficit of deficitRooms) {
      for (const surplus of surplusRooms) {
        const transferAmount = Math.min(deficit.amount, surplus.amount, 10000);
        if (transferAmount > 1000) {
          requests.push({
            from: surplus.room,
            to: deficit.room,
            resource,
            amount: transferAmount,
            priority: resource === RESOURCE_ENERGY ? 100 : 50
          });

          surplus.amount -= transferAmount;
          deficit.amount -= transferAmount;

          if (deficit.amount <= 0) break;
        }
      }
    }
  }

  // Sort by priority
  requests.sort((a, b) => b.priority - a.priority);

  return requests;
}

/**
 * Execute terminal transfer
 */
export function executeTerminalTransfer(request: TransferRequest): number {
  const fromRoom = Game.rooms[request.from];
  const toRoom = Game.rooms[request.to];

  if (!fromRoom || !toRoom) return ERR_NOT_FOUND;

  const terminal = fromRoom.terminal;
  if (!terminal) return ERR_NOT_FOUND;

  // Check cooldown
  if (terminal.cooldown > 0) return ERR_TIRED;

  // Check energy for transfer cost
  const cost = Game.market.calcTransactionCost(request.amount, request.from, request.to);
  if (terminal.store.getUsedCapacity(RESOURCE_ENERGY) < cost) {
    return ERR_NOT_ENOUGH_ENERGY;
  }

  return terminal.send(request.resource, request.amount, request.to);
}

/**
 * Update cluster metrics
 */
export function updateClusterMetrics(cluster: ClusterMemory, swarms: Map<string, SwarmState>): void {
  let totalIncome = 0;
  let totalConsumption = 0;
  let warIndex = 0;

  for (const roomName of cluster.memberRooms) {
    const swarm = swarms.get(roomName);
    if (!swarm) continue;

    totalIncome += swarm.metrics.energyHarvested;
    totalConsumption += swarm.metrics.energySpawning + swarm.metrics.energyConstruction;
    warIndex = Math.max(warIndex, swarm.pheromones.war, swarm.pheromones.defense);
  }

  cluster.metrics.energyIncome = totalIncome;
  cluster.metrics.energyConsumption = totalConsumption;
  cluster.metrics.energyBalance = totalIncome - totalConsumption;
  cluster.metrics.warIndex = warIndex;
  cluster.metrics.economyIndex = totalConsumption > 0 ? Math.min(100, (totalIncome / totalConsumption) * 50) : 50;
  cluster.lastUpdate = Game.time;
}

// =============================================================================
// 13.3 Cluster Defense & Offense
// =============================================================================

/**
 * Get rooms needing defense in cluster
 */
export function getRoomsNeedingDefense(cluster: ClusterMemory, swarms: Map<string, SwarmState>): string[] {
  const rooms: string[] = [];

  for (const roomName of [...cluster.memberRooms, ...cluster.forwardBases]) {
    const swarm = swarms.get(roomName);
    if (swarm && swarm.danger >= 2) {
      rooms.push(roomName);
    }
  }

  return rooms;
}

/**
 * Request cross-room defense
 */
export function requestCrossRoomDefense(
  cluster: ClusterMemory,
  targetRoom: string,
  swarms: Map<string, SwarmState>
): void {
  // Find rooms that can send defenders
  for (const roomName of cluster.memberRooms) {
    if (roomName === targetRoom) continue;

    const swarm = swarms.get(roomName);
    if (!swarm || swarm.danger > 0) continue;

    // Increase defense pheromone to trigger defender spawning
    swarm.pheromones.defense = Math.min(100, swarm.pheromones.defense + 20);
  }
}

/**
 * Set cluster role
 */
export function setClusterRole(clusterId: string, role: "economic" | "war" | "mixed" | "frontier"): void {
  const cluster = getClusters()[clusterId];
  if (cluster) {
    cluster.role = role;
  }
}

/**
 * Run cluster logistics
 */
export function runClusterLogistics(cluster: ClusterMemory, swarms: Map<string, SwarmState>): void {
  // Update metrics
  updateClusterMetrics(cluster, swarms);

  // Only run transfers periodically
  if (Game.time % 10 !== 0) return;

  // Generate and execute transfer requests
  const requests = generateTransferRequests(cluster);

  // Execute up to 3 transfers per tick
  let executed = 0;
  for (const request of requests) {
    if (executed >= 3) break;

    const result = executeTerminalTransfer(request);
    if (result === OK) {
      executed++;
    }
  }

  // Check for rooms needing defense
  const needingDefense = getRoomsNeedingDefense(cluster, swarms);
  for (const roomName of needingDefense) {
    requestCrossRoomDefense(cluster, roomName, swarms);
  }
}

/**
 * Run cluster manager for all clusters
 */
export function runClusterManager(ownedRooms: string[], swarms: Map<string, SwarmState>): void {
  // Ensure rooms are assigned to clusters
  if (Game.time % 100 === 0) {
    assignRoomsToClusters(ownedRooms);
  }

  // Run logistics for each cluster
  const clusters = getClusters();
  for (const cluster of Object.values(clusters)) {
    runClusterLogistics(cluster, swarms);
  }
}
