import { describe, expect, it, vi, beforeEach } from "vitest";
import { RoomVisualManager } from "@runtime/visuals/RoomVisualManager";
import { WallUpgradeManager } from "@runtime/defense/WallUpgradeManager";

describe("Wall Upgrade Visuals", () => {
  let roomVisualManager: RoomVisualManager;
  let wallUpgradeManager: WallUpgradeManager;

  beforeEach(() => {
    wallUpgradeManager = new WallUpgradeManager();
    roomVisualManager = new RoomVisualManager(
      {
        enabled: true,
        showWallUpgrade: true
      },
      wallUpgradeManager
    );
  });

  describe("Visual rendering", () => {
    it("should render wall upgrade progress for room with walls", () => {
      const textCalls: unknown[] = [];

      const mockRoom = {
        name: "W0N0",
        controller: { level: 4 } as StructureController,
        visual: {
          text: vi.fn((...args: unknown[]) => {
            textCalls.push(args);
          }),
          circle: vi.fn(),
          line: vi.fn()
        } as unknown as RoomVisual,
        find: vi.fn((type: FindConstant) => {
          if (type === FIND_STRUCTURES) {
            // Return walls below target
            return [
              {
                structureType: STRUCTURE_WALL,
                hits: 30_000,
                hitsMax: 300_000_000
              } as StructureWall,
              {
                structureType: STRUCTURE_WALL,
                hits: 70_000,
                hitsMax: 300_000_000
              } as StructureWall
            ];
          }
          return [];
        })
      };

      const mockGame = {
        time: 1000,
        cpu: {
          getUsed: vi.fn(() => 5.0)
        },
        rooms: {
          W0N0: mockRoom
        },
        creeps: {}
      };

      roomVisualManager.render(mockGame);

      // Should have called text() for wall upgrade info
      expect(textCalls.length).toBeGreaterThan(0);

      // Check that wall progress was rendered
      const wallProgressCall = textCalls.find((call: unknown[]) => {
        if (Array.isArray(call) && typeof call[0] === "string") {
          return call[0].includes("Walls:");
        }
        return false;
      });

      expect(wallProgressCall).toBeDefined();

      // Extract the text from the call
      const [text] = wallProgressCall as [string, number, number, object];
      expect(text).toContain("🛡️ Walls:");
      expect(text).toContain("K"); // Should show values in K format
    });

    it("should not render when showWallUpgrade is disabled", () => {
      const roomVisualManagerDisabled = new RoomVisualManager(
        {
          enabled: true,
          showWallUpgrade: false,
          showConstructionTargets: false,
          showCreepPaths: false,
          showEnergyFlow: false,
          showSpawnQueue: false,
          showCpuUsage: false
        },
        wallUpgradeManager
      );

      const textCalls: unknown[] = [];

      const mockRoom = {
        name: "W0N0",
        controller: { level: 4 } as StructureController,
        visual: {
          text: vi.fn((...args: unknown[]) => {
            textCalls.push(args);
          }),
          circle: vi.fn(),
          line: vi.fn()
        } as unknown as RoomVisual,
        find: vi.fn(() => [
          {
            structureType: STRUCTURE_WALL,
            hits: 50_000,
            hitsMax: 300_000_000
          } as StructureWall
        ])
      };

      const mockGame = {
        time: 1000,
        cpu: {
          getUsed: vi.fn(() => 5.0)
        },
        rooms: {
          W0N0: mockRoom
        },
        creeps: {}
      };

      roomVisualManagerDisabled.render(mockGame);

      // Should not have any wall upgrade visuals
      const wallProgressCall = textCalls.find((call: unknown[]) => {
        if (Array.isArray(call) && typeof call[0] === "string") {
          return call[0].includes("Walls:");
        }
        return false;
      });

      expect(wallProgressCall).toBeUndefined();
    });

    it("should not render for room without controller", () => {
      const textCalls: unknown[] = [];

      const mockRoom = {
        name: "W0N0",
        controller: null,
        visual: {
          text: vi.fn((...args: unknown[]) => {
            textCalls.push(args);
          }),
          circle: vi.fn(),
          line: vi.fn()
        } as unknown as RoomVisual,
        find: vi.fn(() => [])
      };

      const mockGame = {
        time: 1000,
        cpu: {
          getUsed: vi.fn(() => 5.0)
        },
        rooms: {
          W0N0: mockRoom
        },
        creeps: {}
      };

      roomVisualManager.render(mockGame);

      // Should not have wall upgrade visuals
      const wallProgressCall = textCalls.find((call: unknown[]) => {
        if (Array.isArray(call) && typeof call[0] === "string") {
          return call[0].includes("Walls:");
        }
        return false;
      });

      expect(wallProgressCall).toBeUndefined();
    });

    it("should not render when no walls exist", () => {
      const textCalls: unknown[] = [];

      const mockRoom = {
        name: "W0N0",
        controller: { level: 4 } as StructureController,
        visual: {
          text: vi.fn((...args: unknown[]) => {
            textCalls.push(args);
          }),
          circle: vi.fn(),
          line: vi.fn()
        } as unknown as RoomVisual,
        find: vi.fn(() => []) // No walls
      };

      const mockGame = {
        time: 1000,
        cpu: {
          getUsed: vi.fn(() => 5.0)
        },
        rooms: {
          W0N0: mockRoom
        },
        creeps: {}
      };

      roomVisualManager.render(mockGame);

      // Should not have wall upgrade visuals
      const wallProgressCall = textCalls.find((call: unknown[]) => {
        if (Array.isArray(call) && typeof call[0] === "string") {
          return call[0].includes("Walls:");
        }
        return false;
      });

      expect(wallProgressCall).toBeUndefined();
    });

    it("should show completion status when all walls upgraded", () => {
      const textCalls: unknown[] = [];

      const mockRoom = {
        name: "W0N0",
        controller: { level: 4 } as StructureController,
        visual: {
          text: vi.fn((...args: unknown[]) => {
            textCalls.push(args);
          }),
          circle: vi.fn(),
          line: vi.fn()
        } as unknown as RoomVisual,
        find: vi.fn((type: FindConstant) => {
          if (type === FIND_STRUCTURES) {
            // Return walls at or above target (100K for RCL 4)
            return [
              {
                structureType: STRUCTURE_WALL,
                hits: 100_000,
                hitsMax: 300_000_000
              } as StructureWall,
              {
                structureType: STRUCTURE_WALL,
                hits: 150_000,
                hitsMax: 300_000_000
              } as StructureWall
            ];
          }
          return [];
        })
      };

      const mockGame = {
        time: 1000,
        cpu: {
          getUsed: vi.fn(() => 5.0)
        },
        rooms: {
          W0N0: mockRoom
        },
        creeps: {}
      };

      roomVisualManager.render(mockGame);

      // Should show stage complete
      const completeCall = textCalls.find((call: unknown[]) => {
        if (Array.isArray(call) && typeof call[0] === "string") {
          return call[0].includes("Stage Complete");
        }
        return false;
      });

      expect(completeCall).toBeDefined();
    });

    it("should format hits correctly for different magnitudes", () => {
      const textCalls: unknown[] = [];

      const mockRoom = {
        name: "W0N0",
        controller: { level: 6 } as StructureController,
        visual: {
          text: vi.fn((...args: unknown[]) => {
            textCalls.push(args);
          }),
          circle: vi.fn(),
          line: vi.fn()
        } as unknown as RoomVisual,
        find: vi.fn((type: FindConstant) => {
          if (type === FIND_STRUCTURES) {
            // Return walls below 1M target
            return [
              {
                structureType: STRUCTURE_WALL,
                hits: 500_000,
                hitsMax: 300_000_000
              } as StructureWall
            ];
          }
          return [];
        })
      };

      const mockGame = {
        time: 1000,
        cpu: {
          getUsed: vi.fn(() => 5.0)
        },
        rooms: {
          W0N0: mockRoom
        },
        creeps: {}
      };

      roomVisualManager.render(mockGame);

      // Should format millions with M suffix
      const wallProgressCall = textCalls.find((call: unknown[]) => {
        if (Array.isArray(call) && typeof call[0] === "string") {
          return call[0].includes("Walls:");
        }
        return false;
      });

      expect(wallProgressCall).toBeDefined();
      const [text] = wallProgressCall as [string, number, number, object];
      expect(text).toContain("M"); // Should show target in M format
      expect(text).toContain("K"); // Should show current in K format
    });

    it("should show range when walls have different hit points", () => {
      const textCalls: unknown[] = [];

      const mockRoom = {
        name: "W0N0",
        controller: { level: 4 } as StructureController,
        visual: {
          text: vi.fn((...args: unknown[]) => {
            textCalls.push(args);
          }),
          circle: vi.fn(),
          line: vi.fn()
        } as unknown as RoomVisual,
        find: vi.fn((type: FindConstant) => {
          if (type === FIND_STRUCTURES) {
            // Return walls with varying hit points
            return [
              {
                structureType: STRUCTURE_WALL,
                hits: 20_000,
                hitsMax: 300_000_000
              } as StructureWall,
              {
                structureType: STRUCTURE_WALL,
                hits: 80_000,
                hitsMax: 300_000_000
              } as StructureWall
            ];
          }
          return [];
        })
      };

      const mockGame = {
        time: 1000,
        cpu: {
          getUsed: vi.fn(() => 5.0)
        },
        rooms: {
          W0N0: mockRoom
        },
        creeps: {}
      };

      roomVisualManager.render(mockGame);

      // Should show range
      const rangeCall = textCalls.find((call: unknown[]) => {
        if (Array.isArray(call) && typeof call[0] === "string") {
          return call[0].includes("Range:");
        }
        return false;
      });

      expect(rangeCall).toBeDefined();
    });

    it("should use appropriate colors based on completion percentage", () => {
      const testCompletionColor = (minHits: number, expectedColorMatch: RegExp) => {
        const textCalls: unknown[] = [];

        const mockRoom = {
          name: "W0N0",
          controller: { level: 4 } as StructureController,
          visual: {
            text: vi.fn((...args: unknown[]) => {
              textCalls.push(args);
            }),
            circle: vi.fn(),
            line: vi.fn()
          } as unknown as RoomVisual,
          find: vi.fn((type: FindConstant) => {
            if (type === FIND_STRUCTURES) {
              return [
                {
                  structureType: STRUCTURE_WALL,
                  hits: minHits,
                  hitsMax: 300_000_000
                } as StructureWall
              ];
            }
            return [];
          })
        };

        const mockGame = {
          time: 1000,
          cpu: {
            getUsed: vi.fn(() => 5.0)
          },
          rooms: {
            W0N0: mockRoom
          },
          creeps: {}
        };

        roomVisualManager.render(mockGame);

        const wallProgressCall = textCalls.find((call: unknown[]) => {
          if (Array.isArray(call) && typeof call[0] === "string") {
            return call[0].includes("Walls:");
          }
          return false;
        });

        expect(wallProgressCall).toBeDefined();
        const [, , , options] = wallProgressCall as [string, number, number, { color: string }];
        expect(options.color).toMatch(expectedColorMatch);
      };

      // Test different completion levels
      testCompletionColor(10_000, /#ff0000/i); // 10% - Red
      testCompletionColor(40_000, /#ff8800/i); // 40% - Orange
      testCompletionColor(70_000, /#ffff00/i); // 70% - Yellow
      testCompletionColor(95_000, /#00ff00/i); // 95% - Green
    });
  });
});
