import { Kernel } from "@runtime/bootstrap/kernel";
import type { KernelConfig } from "@runtime/bootstrap/kernel";

/**
 * Factory helper used by the Screeps entrypoint to bootstrap the runtime kernel.
 */
export const createKernel = (config: KernelConfig = {}): Kernel => new Kernel(config);
