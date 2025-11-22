/**
 * Example demonstrating the protocol system for inter-process communication.
 *
 * This example shows how to:
 * 1. Define a protocol interface for type safety
 * 2. Implement the protocol with the @protocol decorator
 * 3. Use the protocol in multiple processes
 * 4. Combine multiple protocols
 */

import { Kernel, process, protocol, ProcessContext } from "../src/index.js";

// ============================================================================
// Define Protocol Interfaces (for type safety)
// ============================================================================

interface IMessageProtocol {
  sendMessage(target: string, message: string): void;
  getMessages(target: string): string[];
  clearMessages(target: string): void;
}

interface IStatsProtocol {
  recordStat(name: string, value: number): void;
  getStat(name: string): number | undefined;
  getAllStats(): Record<string, number>;
}

// Combined protocol interface
interface ICombinedProtocol extends IMessageProtocol, IStatsProtocol {}

// ============================================================================
// Implement Protocols
// ============================================================================

/**
 * MessageProtocol provides inter-process messaging capabilities.
 * Processes can send and receive messages without using Memory.
 */
@protocol({ name: "MessageProtocol" })
export class MessageProtocol implements IMessageProtocol {
  private inbox: Map<string, string[]> = new Map();

  public sendMessage(target: string, message: string): void {
    if (!this.inbox.has(target)) {
      this.inbox.set(target, []);
    }
    this.inbox.get(target)!.push(message);
  }

  public getMessages(target: string): string[] {
    return this.inbox.get(target) ?? [];
  }

  public clearMessages(target: string): void {
    this.inbox.delete(target);
  }
}

/**
 * StatsProtocol provides a centralized statistics collection system.
 * Processes can record metrics without cluttering Memory.
 */
@protocol({ name: "StatsProtocol" })
export class StatsProtocol implements IStatsProtocol {
  private stats: Map<string, number> = new Map();

  public recordStat(name: string, value: number): void {
    this.stats.set(name, value);
  }

  public getStat(name: string): number | undefined {
    return this.stats.get(name);
  }

  public getAllStats(): Record<string, number> {
    return Object.fromEntries(this.stats.entries());
  }
}

// ============================================================================
// Define Processes Using Protocols
// ============================================================================

/**
 * ProducerProcess sends messages and records stats.
 * Runs first (priority 100) to produce data for other processes.
 */
@process({ name: "ProducerProcess", priority: 100, singleton: true })
export class ProducerProcess {
  public run(ctx: ProcessContext<Memory, ICombinedProtocol>): void {
    // Send messages
    ctx.protocol.sendMessage("defense", "Enemy spotted in room E1S1");
    ctx.protocol.sendMessage("economy", "Energy reserves low");

    // Record statistics
    ctx.protocol.recordStat("cpu_used", ctx.game.cpu.getUsed());
    ctx.protocol.recordStat("tick", ctx.game.time);

    ctx.logger.log?.("[ProducerProcess] Sent messages and recorded stats");
  }
}

/**
 * DefenseProcess reads messages relevant to defense.
 * Runs second (priority 75) to process messages from ProducerProcess.
 */
@process({ name: "DefenseProcess", priority: 75, singleton: true })
export class DefenseProcess {
  public run(ctx: ProcessContext<Memory, ICombinedProtocol>): void {
    const messages = ctx.protocol.getMessages("defense");

    if (messages.length > 0) {
      ctx.logger.log?.("[DefenseProcess] Received messages:");
      messages.forEach(msg => ctx.logger.log?.(`  - ${msg}`));

      // Clear processed messages
      ctx.protocol.clearMessages("defense");
    }
  }
}

/**
 * EconomyProcess reads messages relevant to economy.
 * Runs third (priority 50) to process economic messages.
 */
@process({ name: "EconomyProcess", priority: 50, singleton: true })
export class EconomyProcess {
  public run(ctx: ProcessContext<Memory, ICombinedProtocol>): void {
    const messages = ctx.protocol.getMessages("economy");

    if (messages.length > 0) {
      ctx.logger.log?.("[EconomyProcess] Received messages:");
      messages.forEach(msg => ctx.logger.log?.(`  - ${msg}`));

      // Clear processed messages
      ctx.protocol.clearMessages("economy");
    }
  }
}

/**
 * ReporterProcess displays all collected statistics.
 * Runs last (priority 10) to report on all stats collected during the tick.
 */
@process({ name: "ReporterProcess", priority: 10, singleton: true })
export class ReporterProcess {
  public run(ctx: ProcessContext<Memory, ICombinedProtocol>): void {
    const stats = ctx.protocol.getAllStats();

    ctx.logger.log?.("[ReporterProcess] Statistics:");
    Object.entries(stats).forEach(([name, value]) => {
      ctx.logger.log?.(`  ${name}: ${value}`);
    });
  }
}

// ============================================================================
// Bootstrap Kernel
// ============================================================================

/**
 * Create kernel instance and run.
 * Protocols are automatically initialized and combined on first run.
 */
const kernel = new Kernel({
  logger: console,
  cpuEmergencyThreshold: 0.9
});

// Mock Game and Memory for demonstration
const mockGame = {
  time: 12345,
  cpu: {
    getUsed: () => 15.5,
    limit: 500,
    bucket: 10000
  },
  creeps: {},
  spawns: {},
  rooms: {}
};

const mockMemory = {} as Memory;

// Simulate a few ticks
console.log("\n=== Tick 1 ===");
kernel.run(mockGame, mockMemory);

console.log("\n=== Tick 2 ===");
mockGame.time++;
mockGame.cpu.getUsed = () => 18.3;
kernel.run(mockGame, mockMemory);

console.log("\n=== Tick 3 ===");
mockGame.time++;
mockGame.cpu.getUsed = () => 22.1;
kernel.run(mockGame, mockMemory);
