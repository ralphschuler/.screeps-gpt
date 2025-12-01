import { process } from "@ralphschuler/screeps-kernel";
import { Logger } from "@ralphschuler/screeps-logger";
import { ROLE_CAP_MULTIPLIER, SPAWN_ENERGY_RESERVE } from "../constants.js";
import { SwarmMemoryManager } from "../memory/SwarmMemoryManager.js";
import type { SwarmProcessContext, SwarmRole } from "../types.js";
import { weightedSelect } from "../utils/weightedSelection.js";

@process({ name: "SwarmSpawnProcess", priority: 65, singleton: true })
export class SwarmSpawnProcess {
  private readonly memoryManager = new SwarmMemoryManager(new Logger({ minLevel: "info" }));

  public run(ctx: SwarmProcessContext): void {
    const swarm = this.memoryManager.getOrInit(ctx.memory);
    const creepsByRole = this.countCreeps(ctx.game.creeps);

    for (const spawn of Object.values(ctx.game.spawns)) {
      if (spawn.spawning) continue;
      const roomMemory = this.memoryManager.getOrInitRoom(swarm, spawn.room.name);
      const role = this.selectRole(roomMemory, creepsByRole[spawn.room.name] ?? {});
      if (!role) continue;
      const body = this.planBody(role, spawn.room.energyAvailable, spawn.room.controller?.level ?? 1);
      if (body.length === 0) continue;
      if (spawn.room.energyAvailable < SPAWN_ENERGY_RESERVE) continue;
      const name = `${role}-${ctx.game.time}`;
      const memory = this.buildMemory(role, swarm, spawn.room.name, ctx);
      const res = spawn.spawnCreep(body, name, { memory });
      if (res === OK) {
        this.memoryManager.pushEvent(roomMemory, `spawn:${role}`, ctx.game.time);
      }
    }
  }

  private countCreeps(creeps: Record<string, Creep>): Record<string, Partial<Record<SwarmRole, number>>> {
    const tally: Record<string, Partial<Record<SwarmRole, number>>> = {};
    for (const creep of Object.values(creeps)) {
      const memory = creep.memory as { role?: SwarmRole; homeRoom?: string };
      if (!memory.role || !memory.homeRoom) continue;
      tally[memory.homeRoom] ??= {};
      tally[memory.homeRoom]![memory.role] = (tally[memory.homeRoom]![memory.role] ?? 0) + 1;
    }
    return tally;
  }

  private selectRole(
    roomMemory: ReturnType<SwarmMemoryManager["getOrInitRoom"]>,
    counts: Partial<Record<SwarmRole, number>>
  ): SwarmRole | null {
    const entries = Object.entries(roomMemory.spawnProfile.weights)
      .map(([role, weight]) => ({ value: role as SwarmRole, weight }))
      .filter(entry => entry.weight > 0);
    const eligible = entries.filter(entry => {
      const cap = Math.max(1, Math.ceil(entry.weight * ROLE_CAP_MULTIPLIER));
      return (counts[entry.value] ?? 0) < cap;
    });
    if (eligible.length === 0) return null;
    return weightedSelect(eligible, Math.random);
  }

  private buildMemory(
    role: SwarmRole,
    swarm: ReturnType<SwarmMemoryManager["getOrInit"]>,
    homeRoom: string,
    ctx: SwarmProcessContext
  ): { role: SwarmRole; homeRoom: string; targetRoom?: string } {
    const memory: { role: SwarmRole; homeRoom: string; targetRoom?: string } = { role, homeRoom };
    const roomMemory = swarm.rooms[homeRoom];
    if (role === "claimAnt") {
      const claimTarget = swarm.overmind.claimQueue.find(room => room !== homeRoom);
      if (claimTarget) memory.targetRoom = claimTarget;
    }
    if (role === "scoutAnt") {
      const scoutTarget = this.pickExplorationTarget(homeRoom, swarm, ctx);
      if (scoutTarget) memory.targetRoom = scoutTarget;
    }
    if (role === "foragerAnt") {
      const harvestTarget = this.pickHarvestTarget(homeRoom, swarm);
      if (harvestTarget) memory.targetRoom = harvestTarget;
    }
    if (role === "queenCarrier") {
      const logisticsTarget = this.pickLogisticsTarget(homeRoom, swarm);
      if (logisticsTarget) memory.targetRoom = logisticsTarget;
    }
    if (role === "depositHarvester") {
      const depositTarget = this.pickDepositTarget(swarm, homeRoom);
      if (depositTarget) memory.targetRoom = depositTarget;
    }
    if (role === "mineralHarvester") {
      memory.targetRoom = homeRoom;
    }
    if (role === "terminalManager") {
      memory.targetRoom = homeRoom;
    }
    if ((role === "guardAnt" || role === "healerAnt" || role === "soldierAnt") && roomMemory?.rallyTarget) {
      memory.targetRoom = roomMemory.rallyTarget;
    }
    return memory;
  }

  private planBody(role: SwarmRole, availableEnergy: number, rcl: number): BodyPartConstant[] {
    const basicBodies: Record<SwarmRole, BodyPartConstant[]> = {
      larvaWorker: [WORK, CARRY, MOVE],
      harvester: [WORK, WORK, MOVE],
      hauler: [CARRY, CARRY, MOVE],
      upgrader: [WORK, CARRY, MOVE],
      foragerAnt: [WORK, CARRY, MOVE, MOVE],
      builderAnt: [WORK, WORK, CARRY, MOVE],
      queenCarrier: [CARRY, CARRY, MOVE],
      mineralHarvester: [WORK, WORK, MOVE, MOVE],
      depositHarvester: [WORK, WORK, CARRY, MOVE, MOVE],
      terminalManager: [CARRY, CARRY, MOVE],
      scoutAnt: [MOVE],
      claimAnt: [CLAIM, MOVE],
      guardAnt: [ATTACK, TOUGH, MOVE],
      healerAnt: [HEAL, MOVE],
      soldierAnt: [RANGED_ATTACK, ATTACK, MOVE, MOVE],
      engineer: [WORK, CARRY, MOVE],
      remoteWorker: [WORK, WORK, CARRY, MOVE, MOVE],
      siegeUnit: [WORK, WORK, CARRY, MOVE, MOVE],
      linkManager: [CARRY, CARRY, MOVE],
      factoryWorker: [CARRY, CARRY, MOVE],
      labTech: [CARRY, CARRY, MOVE],
      powerQueen: [CARRY, CARRY, MOVE, MOVE],
      powerWarrior: [TOUGH, ATTACK, MOVE, MOVE]
    } as Record<SwarmRole, BodyPartConstant[]>;

    const base = basicBodies[role];
    if (availableEnergy < this.bodyCost(base)) return [];

    const body: BodyPartConstant[] = [...base];
    let remaining = availableEnergy - this.bodyCost(base);
    while (remaining >= 200 && body.length < 30) {
      if (role === "larvaWorker" || role === "builderAnt") {
        body.push(WORK, CARRY, MOVE);
        remaining -= 200;
      } else if (role === "harvester") {
        body.push(WORK, WORK, MOVE);
        remaining -= 250;
      } else if (role === "mineralHarvester") {
        body.push(WORK, WORK, MOVE);
        remaining -= 250;
      } else if (role === "hauler" || role === "queenCarrier") {
        body.push(CARRY, CARRY, MOVE);
        remaining -= 150;
      } else if (role === "terminalManager") {
        body.push(CARRY, MOVE);
        remaining -= 100;
      } else if (role === "upgrader") {
        body.push(WORK, CARRY, MOVE);
        remaining -= 200;
      } else if (role === "foragerAnt") {
        body.push(WORK, CARRY, MOVE);
        remaining -= 200;
      } else if (role === "soldierAnt") {
        body.push(RANGED_ATTACK, MOVE);
        remaining -= 150;
      } else if (role === "guardAnt") {
        body.push(ATTACK, MOVE);
        remaining -= 130;
      } else if (role === "remoteWorker") {
        body.push(WORK, WORK, CARRY, MOVE);
        remaining -= 300;
      } else if (role === "depositHarvester") {
        body.push(WORK, CARRY, MOVE);
        remaining -= 200;
      } else if (role === "siegeUnit") {
        body.push(WORK, WORK, MOVE, MOVE);
        remaining -= 250;
      } else if (role === "engineer") {
        body.push(WORK, CARRY, MOVE);
        remaining -= 200;
      } else if (role === "linkManager" || role === "factoryWorker" || role === "labTech") {
        body.push(CARRY, CARRY, MOVE);
        remaining -= 150;
      } else if (role === "powerQueen") {
        body.push(CARRY, CARRY, MOVE);
        remaining -= 150;
      } else if (role === "powerWarrior") {
        body.push(ATTACK, MOVE);
        remaining -= 130;
      } else {
        break;
      }
    }

    if (rcl < 3) {
      return body.slice(0, Math.max(3, body.length / 2));
    }
    return body;
  }

  private bodyCost(parts: BodyPartConstant[]): number {
    return parts.reduce((sum, part) => sum + BODYPART_COST[part], 0);
  }

  private pickExplorationTarget(
    home: string,
    swarm: ReturnType<SwarmMemoryManager["getOrInit"]>,
    ctx: SwarmProcessContext
  ): string | undefined {
    const exits = Game.map.describeExits(home);
    if (!exits) return undefined;
    const unseen = Object.values(exits).filter(neighbor => {
      if (!neighbor) return false;
      const lastSeen = swarm.overmind.roomsSeen[neighbor];
      return !lastSeen || lastSeen < ctx.game.time - 200;
    }) as string[];
    return unseen[0] ?? (Object.values(exits)[0] as string | undefined);
  }

  private pickHarvestTarget(home: string, swarm: ReturnType<SwarmMemoryManager["getOrInit"]>): string | undefined {
    const candidates = Object.entries(swarm.rooms)
      .filter(([roomName, memory]) => roomName !== home && memory.pheromones.harvest > 0)
      .sort(([, a], [, b]) => b.pheromones.harvest - a.pheromones.harvest);
    return candidates[0]?.[0];
  }

  private pickLogisticsTarget(home: string, swarm: ReturnType<SwarmMemoryManager["getOrInit"]>): string | undefined {
    const route = swarm.logisticsRoutes.find(candidate => candidate.from === home);
    return route?.to;
  }

  private pickDepositTarget(swarm: ReturnType<SwarmMemoryManager["getOrInit"]>, home: string): string | undefined {
    const entries = Object.entries(swarm.global.intel)
      .filter(
        ([roomName, intel]) =>
          (intel.deposits?.length ?? 0) > 0 && intel.lastSeen > Game.time - 500 && roomName !== home
      )
      .map(([roomName, intel]) => ({ roomName, cooldown: intel.deposits?.[0]?.cooldown ?? 100 }));
    const best = entries.sort((a, b) => a.cooldown - b.cooldown)[0];
    return best?.roomName;
  }
}
