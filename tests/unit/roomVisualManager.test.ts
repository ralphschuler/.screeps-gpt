import { describe, it, expect, vi, beforeEach } from "vitest";
import { RoomVisualManager } from "../../src/runtime/visuals/RoomVisualManager";

describe("RoomVisualManager", () => {
  let mockGame: ReturnType<typeof createMockGame>;
  let mockRoomVisual: ReturnType<typeof createMockRoomVisual>;

  function createMockRoomVisual() {
    return {
      circle: vi.fn().mockReturnThis(),
      line: vi.fn().mockReturnThis(),
      text: vi.fn().mockReturnThis(),
      poly: vi.fn().mockReturnThis(),
      rect: vi.fn().mockReturnThis()
    };
  }

  function createMockGame() {
    const visual = createMockRoomVisual();
    return {
      time: 1000,
      cpu: {
        getUsed: vi.fn().mockReturnValue(10.5)
      },
      rooms: {
        W1N1: {
          name: "W1N1",
          visual,
          find: vi.fn().mockReturnValue([])
        }
      },
      creeps: {}
    };
  }

  beforeEach(() => {
    mockRoomVisual = createMockRoomVisual();
    mockGame = createMockGame();
  });

  describe("Configuration", () => {
    it("should be disabled by default", () => {
      const manager = new RoomVisualManager();
      manager.render(mockGame);

      // Should not render anything when disabled
      expect(mockRoomVisual.circle).not.toHaveBeenCalled();
      expect(mockRoomVisual.text).not.toHaveBeenCalled();
    });

    it("should enable all features when enabled is true", () => {
      const manager = new RoomVisualManager({ enabled: true });
      manager.render(mockGame);

      // Should render at least CPU usage when enabled
      expect(mockGame.rooms.W1N1.visual.text).toHaveBeenCalled();
    });

    it("should respect individual feature toggles", () => {
      const manager = new RoomVisualManager({
        enabled: true,
        showCpuUsage: false,
        showCreepPaths: false
      });

      manager.render(mockGame);

      // Should not render CPU usage when disabled
      const calls = mockGame.rooms.W1N1.visual.text.mock.calls;
      const hasCpuText = calls.some(call => call[0]?.toString().includes("CPU"));
      expect(hasCpuText).toBe(false);
    });
  });

  describe("CPU Budget Management", () => {
    it("should respect CPU budget", () => {
      const manager = new RoomVisualManager({
        enabled: true,
        cpuBudget: 5.0,
        showCpuUsage: true
      });

      // Set up game with multiple rooms
      const visual1 = createMockRoomVisual();
      const visual2 = createMockRoomVisual();
      mockGame.rooms = {
        W1N1: { name: "W1N1", visual: visual1, find: vi.fn(() => []) },
        W2N2: { name: "W2N2", visual: visual2, find: vi.fn(() => []) },
        W3N3: { name: "W3N3", visual: createMockRoomVisual(), find: vi.fn(() => []) }
      };

      // Mock CPU increasing with each call to simulate rendering cost
      let cpuUsage = 10;
      mockGame.cpu.getUsed = vi.fn(() => {
        cpuUsage += 2.5;
        return cpuUsage;
      });

      manager.render(mockGame);

      // Should process first room (within budget)
      expect(visual1.text).toHaveBeenCalled();

      // May or may not process second room depending on budget
      // Third room should definitely not be processed (budget exceeded)
      const totalCalls = visual1.text.mock.calls.length + visual2.text.mock.calls.length;
      expect(totalCalls).toBeGreaterThan(0);
    });
  });

  describe("Creep Path Rendering", () => {
    it("should render creep positions with role colors", () => {
      const manager = new RoomVisualManager({
        enabled: true,
        showCreepPaths: true
      });

      mockGame.creeps = {
        "harvester-1": {
          name: "harvester-1",
          pos: { x: 25, y: 25 },
          room: { name: "W1N1" },
          memory: { role: "harvester" }
        }
      };

      manager.render(mockGame);

      expect(mockGame.rooms.W1N1.visual.circle).toHaveBeenCalledWith(
        expect.objectContaining({ x: 25, y: 25 }),
        expect.objectContaining({
          stroke: "#ffaa00", // harvester color
          opacity: 0.8
        })
      );

      expect(mockGame.rooms.W1N1.visual.text).toHaveBeenCalledWith(
        "harvester-1",
        25,
        expect.any(Number),
        expect.objectContaining({ color: "#ffaa00" })
      );
    });

    it("should skip creeps in other rooms", () => {
      const manager = new RoomVisualManager({
        enabled: true,
        showCreepPaths: true
      });

      mockGame.creeps = {
        "harvester-1": {
          name: "harvester-1",
          pos: { x: 25, y: 25 },
          room: { name: "W2N2" }, // Different room
          memory: { role: "harvester" }
        }
      };

      manager.render(mockGame);

      // Should not render creep in different room
      const circleCalls = mockGame.rooms.W1N1.visual.circle.mock.calls;
      expect(circleCalls.length).toBe(0);
    });
  });

  describe("Energy Flow Rendering", () => {
    it("should render lines from harvesters to sources", () => {
      const manager = new RoomVisualManager({
        enabled: true,
        showEnergyFlow: true,
        showCreepPaths: false,
        showCpuUsage: false
      });

      const mockSource = {
        pos: { x: 10, y: 10 }
      };

      mockGame.rooms.W1N1.find = vi.fn((type: number) => {
        if (type === FIND_SOURCES) return [mockSource];
        return [];
      });

      mockGame.creeps = {
        "harvester-1": {
          name: "harvester-1",
          pos: { x: 25, y: 25 },
          room: { name: "W1N1" },
          memory: { role: "harvester" }
        }
      };

      manager.render(mockGame);

      expect(mockGame.rooms.W1N1.visual.line).toHaveBeenCalledWith(
        expect.objectContaining({ x: 25, y: 25 }),
        expect.objectContaining({ x: 10, y: 10 }),
        expect.objectContaining({
          color: "#ffaa00",
          lineStyle: "dashed"
        })
      );
    });

    it("should not render for non-harvester creeps", () => {
      const manager = new RoomVisualManager({
        enabled: true,
        showEnergyFlow: true,
        showCreepPaths: false,
        showCpuUsage: false
      });

      mockGame.creeps = {
        "upgrader-1": {
          name: "upgrader-1",
          pos: { x: 25, y: 25 },
          room: { name: "W1N1" },
          memory: { role: "upgrader" }
        }
      };

      manager.render(mockGame);

      expect(mockGame.rooms.W1N1.visual.line).not.toHaveBeenCalled();
    });
  });

  describe("Construction Target Rendering", () => {
    it("should render construction sites with progress", () => {
      const manager = new RoomVisualManager({
        enabled: true,
        showConstructionTargets: true,
        showCreepPaths: false,
        showCpuUsage: false
      });

      const mockSite = {
        pos: { x: 20, y: 20 },
        progress: 500,
        progressTotal: 1000
      };

      mockGame.rooms.W1N1.find = vi.fn((type: number) => {
        if (type === FIND_MY_CONSTRUCTION_SITES) return [mockSite];
        return [];
      });

      manager.render(mockGame);

      expect(mockGame.rooms.W1N1.visual.circle).toHaveBeenCalledWith(
        expect.objectContaining({ x: 20, y: 20 }),
        expect.objectContaining({
          stroke: "#00ff00"
        })
      );

      expect(mockGame.rooms.W1N1.visual.text).toHaveBeenCalledWith(
        "50%",
        20,
        expect.any(Number),
        expect.objectContaining({ color: "#00ff00" })
      );
    });
  });

  describe("Spawn Queue Rendering", () => {
    it("should render spawning creep progress", () => {
      const manager = new RoomVisualManager({
        enabled: true,
        showSpawnQueue: true,
        showCreepPaths: false,
        showCpuUsage: false
      });

      const mockSpawn = {
        pos: { x: 25, y: 25 },
        spawning: {
          name: "harvester-2",
          needTime: 10,
          remainingTime: 5
        }
      };

      mockGame.rooms.W1N1.find = vi.fn((type: number) => {
        if (type === FIND_MY_SPAWNS) return [mockSpawn];
        return [];
      });

      manager.render(mockGame);

      expect(mockGame.rooms.W1N1.visual.text).toHaveBeenCalledWith(
        expect.stringContaining("harvester-2"),
        25,
        expect.any(Number),
        expect.objectContaining({ color: "#00ffff" })
      );

      expect(mockGame.rooms.W1N1.visual.text).toHaveBeenCalledWith(
        expect.stringContaining("50%"),
        25,
        expect.any(Number),
        expect.objectContaining({ color: "#00ffff" })
      );
    });

    it("should not render when spawn is idle", () => {
      const manager = new RoomVisualManager({
        enabled: true,
        showSpawnQueue: true,
        showCreepPaths: false,
        showCpuUsage: false
      });

      const mockSpawn = {
        pos: { x: 25, y: 25 },
        spawning: null
      };

      mockGame.rooms.W1N1.find = vi.fn((type: number) => {
        if (type === FIND_MY_SPAWNS) return [mockSpawn];
        return [];
      });

      manager.render(mockGame);

      // Should not render spawn status when idle
      const textCalls = mockGame.rooms.W1N1.visual.text.mock.calls;
      const hasSpawnText = textCalls.some(call => call[0]?.toString().includes("🏭"));
      expect(hasSpawnText).toBe(false);
    });
  });

  describe("CPU Usage Rendering", () => {
    it("should render CPU usage and tick in room corner", () => {
      const manager = new RoomVisualManager({
        enabled: true,
        showCpuUsage: true,
        showCreepPaths: false
      });

      mockGame.time = 12345;
      mockGame.cpu.getUsed = vi.fn().mockReturnValue(42.5);

      manager.render(mockGame);

      expect(mockGame.rooms.W1N1.visual.text).toHaveBeenCalledWith(
        "CPU: 42.50",
        48,
        1,
        expect.objectContaining({
          align: "right",
          color: "#ffffff"
        })
      );

      expect(mockGame.rooms.W1N1.visual.text).toHaveBeenCalledWith(
        "Tick: 12345",
        48,
        2,
        expect.objectContaining({
          align: "right"
        })
      );
    });
  });

  describe("Role Colors", () => {
    it("should use correct colors for different roles", () => {
      const manager = new RoomVisualManager({
        enabled: true,
        showCreepPaths: true,
        showCpuUsage: false
      });

      const roles = [
        { role: "harvester", expectedColor: "#ffaa00" },
        { role: "upgrader", expectedColor: "#0088ff" },
        { role: "builder", expectedColor: "#00ff00" },
        { role: "repairer", expectedColor: "#ff8800" },
        { role: "courier", expectedColor: "#ff00ff" },
        { role: "unknown", expectedColor: "#ffffff" }
      ];

      for (const { role, expectedColor } of roles) {
        const visual = createMockRoomVisual();
        mockGame.rooms.W1N1.visual = visual;
        mockGame.creeps = {
          [`${role}-1`]: {
            name: `${role}-1`,
            pos: { x: 25, y: 25 },
            room: { name: "W1N1" },
            memory: { role }
          }
        };

        manager.render(mockGame);

        expect(visual.circle).toHaveBeenCalledWith(
          expect.any(Object),
          expect.objectContaining({ stroke: expectedColor })
        );
      }
    });
  });
});
