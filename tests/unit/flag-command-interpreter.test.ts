import { describe, it, expect, beforeEach } from "vitest";
import {
  FlagCommandInterpreter,
  FlagCommandType,
  FlagPriority
} from "../../packages/bot/src/runtime/commands/FlagCommandInterpreter";
import type { GameContext } from "../../packages/bot/src/runtime/types/GameContext";

describe("FlagCommandInterpreter", () => {
  let interpreter: FlagCommandInterpreter;
  let mockGame: GameContext;
  let mockMemory: Memory;

  beforeEach(() => {
    interpreter = new FlagCommandInterpreter();

    mockGame = {
      time: 1000,
      cpu: {
        limit: 100,
        tickLimit: 500,
        bucket: 10000,
        shardLimits: {},
        unlocked: false,
        unlockedTime: undefined,
        getUsed: () => 10,
        setShardLimits: () => {},
        halt: () => {},
        generatePixel: () => 0
      },
      creeps: {},
      spawns: {},
      rooms: {},
      flags: {}
    } as GameContext;

    mockMemory = {} as Memory;
  });

  describe("Flag Parsing", () => {
    it("should parse ATTACK command from red flag", () => {
      mockGame.flags = {
        AttackFlag: {
          name: "AttackFlag",
          color: COLOR_RED,
          secondaryColor: COLOR_WHITE,
          pos: {
            x: 25,
            y: 25,
            roomName: "W1N1"
          } as RoomPosition
        } as Flag
      };

      const commands = interpreter.parseFlags(mockGame);

      expect(commands).toHaveLength(1);
      expect(commands[0].name).toBe("AttackFlag");
      expect(commands[0].type).toBe(FlagCommandType.ATTACK);
      expect(commands[0].priority).toBe(FlagPriority.LOW);
      expect(commands[0].roomName).toBe("W1N1");
    });

    it("should parse CLAIM command from blue flag with high priority", () => {
      mockGame.flags = {
        ClaimW2N1: {
          name: "ClaimW2N1",
          color: COLOR_BLUE,
          secondaryColor: COLOR_RED,
          pos: {
            x: 25,
            y: 25,
            roomName: "W2N1"
          } as RoomPosition
        } as Flag
      };

      const commands = interpreter.parseFlags(mockGame);

      expect(commands).toHaveLength(1);
      expect(commands[0].type).toBe(FlagCommandType.CLAIM);
      expect(commands[0].priority).toBe(FlagPriority.HIGH);
    });

    it("should parse REMOTE_MINE command from green flag with medium priority", () => {
      mockGame.flags = {
        RemoteMine: {
          name: "RemoteMine",
          color: COLOR_GREEN,
          secondaryColor: COLOR_ORANGE,
          pos: {
            x: 10,
            y: 15,
            roomName: "W3N2"
          } as RoomPosition
        } as Flag
      };

      const commands = interpreter.parseFlags(mockGame);

      expect(commands).toHaveLength(1);
      expect(commands[0].type).toBe(FlagCommandType.REMOTE_MINE);
      expect(commands[0].priority).toBe(FlagPriority.MEDIUM);
    });

    it("should parse multiple flags correctly", () => {
      mockGame.flags = {
        Flag1: {
          name: "Flag1",
          color: COLOR_BLUE,
          secondaryColor: COLOR_RED,
          pos: { x: 25, y: 25, roomName: "W1N1" } as RoomPosition
        } as Flag,
        Flag2: {
          name: "Flag2",
          color: COLOR_GREEN,
          secondaryColor: COLOR_WHITE,
          pos: { x: 30, y: 30, roomName: "W2N2" } as RoomPosition
        } as Flag,
        Flag3: {
          name: "Flag3",
          color: COLOR_YELLOW,
          secondaryColor: COLOR_ORANGE,
          pos: { x: 35, y: 35, roomName: "W3N3" } as RoomPosition
        } as Flag
      };

      const commands = interpreter.parseFlags(mockGame);

      expect(commands).toHaveLength(3);
      expect(commands[0].type).toBe(FlagCommandType.CLAIM);
      expect(commands[1].type).toBe(FlagCommandType.REMOTE_MINE);
      expect(commands[2].type).toBe(FlagCommandType.EXPAND);
    });

    it("should parse all command types correctly", () => {
      mockGame.flags = {
        Attack: { color: COLOR_RED, secondaryColor: COLOR_WHITE, pos: { roomName: "W1N1" } } as Flag,
        Claim: { color: COLOR_BLUE, secondaryColor: COLOR_WHITE, pos: { roomName: "W1N1" } } as Flag,
        RemoteMine: { color: COLOR_GREEN, secondaryColor: COLOR_WHITE, pos: { roomName: "W1N1" } } as Flag,
        Expand: { color: COLOR_YELLOW, secondaryColor: COLOR_WHITE, pos: { roomName: "W1N1" } } as Flag,
        Scout: { color: COLOR_WHITE, secondaryColor: COLOR_WHITE, pos: { roomName: "W1N1" } } as Flag,
        Defend: { color: COLOR_PURPLE, secondaryColor: COLOR_WHITE, pos: { roomName: "W1N1" } } as Flag,
        Build: { color: COLOR_ORANGE, secondaryColor: COLOR_WHITE, pos: { roomName: "W1N1" } } as Flag,
        Reserve: { color: COLOR_BROWN, secondaryColor: COLOR_WHITE, pos: { roomName: "W1N1" } } as Flag
      };

      const commands = interpreter.parseFlags(mockGame);

      expect(commands).toHaveLength(8);
      expect(commands.map(c => c.type)).toEqual([
        FlagCommandType.ATTACK,
        FlagCommandType.CLAIM,
        FlagCommandType.REMOTE_MINE,
        FlagCommandType.EXPAND,
        FlagCommandType.SCOUT,
        FlagCommandType.DEFEND,
        FlagCommandType.BUILD,
        FlagCommandType.RESERVE
      ]);
    });
  });

  describe("Command Validation", () => {
    it("should validate CLAIM command with sufficient prerequisites", () => {
      const command = {
        name: "ClaimW2N1",
        type: FlagCommandType.CLAIM,
        priority: FlagPriority.HIGH,
        roomName: "W2N1",
        pos: { x: 25, y: 25 },
        flag: {} as Flag
      };

      // Add claimer creep
      mockGame.creeps = {
        claimer1: {
          memory: { role: "claimer" }
        } as Creep
      };

      // Add storage with energy
      mockGame.rooms = {
        W1N1: {
          controller: { my: true, level: 4 } as StructureController,
          storage: {
            store: {
              getUsedCapacity: (resource: ResourceConstant) => (resource === RESOURCE_ENERGY ? 15000 : 0)
            }
          } as StructureStorage
        } as Room
      };

      // Set GCL
      mockMemory.gcl = { level: 2 };

      const validation = interpreter.validateCommand(command, mockGame, mockMemory);

      expect(validation.valid).toBe(true);
      expect(validation.reason).toBeUndefined();
    });

    it("should invalidate CLAIM command without claimer creep", () => {
      const command = {
        name: "ClaimW2N1",
        type: FlagCommandType.CLAIM,
        priority: FlagPriority.HIGH,
        roomName: "W2N1",
        pos: { x: 25, y: 25 },
        flag: {} as Flag
      };

      // No claimer creep
      mockGame.creeps = {};

      // Add storage with energy
      mockGame.rooms = {
        W1N1: {
          controller: { my: true } as StructureController,
          storage: {
            store: {
              getUsedCapacity: (resource: ResourceConstant) => (resource === RESOURCE_ENERGY ? 15000 : 0)
            }
          } as StructureStorage
        } as Room
      };

      mockMemory.gcl = { level: 2 };

      const validation = interpreter.validateCommand(command, mockGame, mockMemory);

      expect(validation.valid).toBe(false);
      expect(validation.reason).toContain("No claimer creep available");
    });

    it("should invalidate REMOTE_MINE command without hauler creeps", () => {
      const command = {
        name: "RemoteMine",
        type: FlagCommandType.REMOTE_MINE,
        priority: FlagPriority.MEDIUM,
        roomName: "W3N2",
        pos: { x: 10, y: 15 },
        flag: {} as Flag
      };

      // No hauler creeps
      mockGame.creeps = {};

      // Add storage with energy
      mockGame.rooms = {
        W1N1: {
          controller: { my: true } as StructureController,
          storage: {
            store: {
              getUsedCapacity: (resource: ResourceConstant) => (resource === RESOURCE_ENERGY ? 15000 : 0)
            }
          } as StructureStorage
        } as Room
      };

      const validation = interpreter.validateCommand(command, mockGame, mockMemory);

      expect(validation.valid).toBe(false);
      expect(validation.reason).toContain("No remote hauler creeps available");
    });

    it("should validate ATTACK command with attack creeps", () => {
      const command = {
        name: "AttackTarget",
        type: FlagCommandType.ATTACK,
        priority: FlagPriority.HIGH,
        roomName: "E5S3",
        pos: { x: 25, y: 25 },
        flag: {} as Flag
      };

      // Add attack creep
      mockGame.creeps = {
        warrior1: {
          memory: { role: "warrior" }
        } as Creep
      };

      // Add storage with energy
      mockGame.rooms = {
        W1N1: {
          controller: { my: true } as StructureController,
          storage: {
            store: {
              getUsedCapacity: (resource: ResourceConstant) => (resource === RESOURCE_ENERGY ? 15000 : 0)
            }
          } as StructureStorage
        } as Room
      };

      const validation = interpreter.validateCommand(command, mockGame, mockMemory);

      expect(validation.valid).toBe(true);
    });

    it("should invalidate commands without stable energy", () => {
      const command = {
        name: "ClaimW2N1",
        type: FlagCommandType.CLAIM,
        priority: FlagPriority.HIGH,
        roomName: "W2N1",
        pos: { x: 25, y: 25 },
        flag: {} as Flag
      };

      // Add claimer creep
      mockGame.creeps = {
        claimer1: {
          memory: { role: "claimer" }
        } as Creep
      };

      // No storage or insufficient energy
      mockGame.rooms = {
        W1N1: {
          controller: { my: true } as StructureController,
          energyAvailable: 100
        } as Room
      };

      mockMemory.gcl = { level: 2 };

      const validation = interpreter.validateCommand(command, mockGame, mockMemory);

      expect(validation.valid).toBe(false);
      expect(validation.reason).toContain("Insufficient energy reserves");
    });
  });

  describe("Command Storage", () => {
    it("should store valid command in memory", () => {
      const command = {
        name: "ClaimW2N1",
        type: FlagCommandType.CLAIM,
        priority: FlagPriority.HIGH,
        roomName: "W2N1",
        pos: { x: 25, y: 25 },
        flag: {} as Flag
      };

      // Setup valid prerequisites
      mockGame.creeps = {
        claimer1: { memory: { role: "claimer" } } as Creep
      };
      mockGame.rooms = {
        W1N1: {
          controller: { my: true } as StructureController,
          storage: {
            store: {
              getUsedCapacity: (resource: ResourceConstant) => (resource === RESOURCE_ENERGY ? 15000 : 0)
            }
          } as StructureStorage
        } as Room
      };
      mockMemory.gcl = { level: 2 };

      interpreter.storeCommand(command, mockMemory, mockGame);

      expect(mockMemory.flagCommands).toBeDefined();
      expect(mockMemory.flagCommands?.ClaimW2N1).toBeDefined();
      expect(mockMemory.flagCommands?.ClaimW2N1.type).toBe(FlagCommandType.CLAIM);
      expect(mockMemory.flagCommands?.ClaimW2N1.valid).toBe(true);
      expect(mockMemory.flagCommands?.ClaimW2N1.acknowledged).toBe(true);
    });

    it("should store invalid command with validation reason", () => {
      const command = {
        name: "RemoteMine",
        type: FlagCommandType.REMOTE_MINE,
        priority: FlagPriority.MEDIUM,
        roomName: "W3N2",
        pos: { x: 10, y: 15 },
        flag: {} as Flag
      };

      // No haulers, no energy
      mockGame.creeps = {};
      mockGame.rooms = {};

      interpreter.storeCommand(command, mockMemory, mockGame);

      expect(mockMemory.flagCommands?.RemoteMine).toBeDefined();
      expect(mockMemory.flagCommands?.RemoteMine.valid).toBe(false);
      expect(mockMemory.flagCommands?.RemoteMine.validationReason).toContain("Prerequisites not met");
    });

    it("should remove command from memory", () => {
      mockMemory.flagCommands = {
        TestFlag: {
          type: FlagCommandType.SCOUT,
          priority: FlagPriority.LOW,
          roomName: "W1N1",
          pos: { x: 25, y: 25 },
          acknowledged: true,
          valid: true,
          acknowledgedAt: 1000
        }
      };

      interpreter.removeCommand("TestFlag", mockMemory);

      expect(mockMemory.flagCommands?.TestFlag).toBeUndefined();
    });
  });

  describe("Status Text Generation", () => {
    it("should generate valid command status text", () => {
      const command = {
        name: "ScoutW4N3",
        type: FlagCommandType.SCOUT,
        priority: FlagPriority.LOW,
        roomName: "W4N3",
        pos: { x: 25, y: 25 },
        flag: {} as Flag
      };

      // Add energy for validation
      mockGame.rooms = {
        W1N1: {
          controller: { my: true } as StructureController,
          storage: {
            store: {
              getUsedCapacity: (resource: ResourceConstant) => (resource === RESOURCE_ENERGY ? 15000 : 0)
            }
          } as StructureStorage
        } as Room
      };

      const statusText = interpreter.getCommandStatusText(command, mockGame, mockMemory);

      expect(statusText).toContain("✓");
      expect(statusText).toContain("SCOUT");
      expect(statusText).toContain("LOW Priority");
    });

    it("should generate invalid command status text with reason", () => {
      const command = {
        name: "AttackTarget",
        type: FlagCommandType.ATTACK,
        priority: FlagPriority.HIGH,
        roomName: "E5S3",
        pos: { x: 25, y: 25 },
        flag: {} as Flag
      };

      // No attack creeps, no energy
      mockGame.creeps = {};
      mockGame.rooms = {};

      const statusText = interpreter.getCommandStatusText(command, mockGame, mockMemory);

      expect(statusText).toContain("⚠️");
      expect(statusText).toContain("ATTACK");
      expect(statusText).toContain("Prerequisites not met");
    });
  });
});
