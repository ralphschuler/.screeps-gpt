import { mkdir, readdir, rm } from "node:fs/promises";
import { resolve, join } from "node:path";
import { build, context as createContext, type BuildOptions } from "esbuild";

const outDir = resolve("dist");
const srcDir = resolve("src");

/**
 * Common runtime defines for all build configurations
 * Replaces Node.js environment variables with literals at build time
 */
const RUNTIME_DEFINES = {
  __PROFILER_ENABLED__: process.env.PROFILER_ENABLED === "false" ? "false" : "true",
  "process.env.TASK_SYSTEM_ENABLED": JSON.stringify(process.env.TASK_SYSTEM_ENABLED ?? "false"),
  "process.env.ROOM_VISUALS_ENABLED": JSON.stringify(process.env.ROOM_VISUALS_ENABLED ?? "false")
} as const;

async function prepare() {
  const { readFile, writeFile } = await import("node:fs/promises");
  const lockFile = resolve(outDir, ".test-lock");

  // Preserve test lock file if it exists
  let lockContent: string | null = null;
  try {
    lockContent = await readFile(lockFile, "utf8");
  } catch {
    // Lock file doesn't exist, which is fine
  }

  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  // Restore lock file if it existed
  if (lockContent !== null) {
    await writeFile(lockFile, lockContent);
  }
}

/**
 * Find all top-level modules in src/runtime for modular build
 */
async function findModuleEntryPoints(): Promise<Array<{ path: string; name: string }>> {
  const runtimeDir = join(srcDir, "runtime");
  const entries: Array<{ path: string; name: string }> = [];

  try {
    const { stat } = await import("node:fs/promises");
    const subdirs = await readdir(runtimeDir, { withFileTypes: true });

    for (const dirent of subdirs) {
      if (dirent.isDirectory()) {
        // Try index.ts first
        const indexPath = join(runtimeDir, dirent.name, "index.ts");
        try {
          await stat(indexPath);
          entries.push({ path: indexPath, name: dirent.name });
          continue;
        } catch {
          // index.ts doesn't exist, try the single main file
        }

        // Look for single main file (e.g., BehaviorController.ts)
        const files = await readdir(join(runtimeDir, dirent.name));
        const tsFiles = files.filter(f => f.endsWith(".ts"));

        if (tsFiles.length === 1) {
          const mainFile = join(runtimeDir, dirent.name, tsFiles[0]);
          entries.push({ path: mainFile, name: dirent.name });
        }
      }
    }
  } catch {
    console.warn("Warning: Could not read runtime directory for modular build");
  }

  return entries;
}

/**
 * Build individual modules separately to preserve boundaries
 * Each module is self-contained for Screeps compatibility
 * Returns the list of module names that were built
 */
async function buildModules(watch: boolean): Promise<string[]> {
  const moduleEntries = await findModuleEntryPoints();

  // Build each runtime module as a separate self-contained bundle
  for (const entry of moduleEntries) {
    const outFile = resolve(outDir, `${entry.name}.js`);

    const options: BuildOptions = {
      entryPoints: [entry.path],
      bundle: true,
      sourcemap: true,
      platform: "browser" as const,
      target: "es2018",
      format: "cjs" as const,
      outfile: outFile,
      logLevel: "warning" as const,
      external: [], // No external modules - each bundle is self-contained
      define: RUNTIME_DEFINES
    };

    if (watch) {
      const ctx = await createContext(options);
      await ctx.watch();
    } else {
      await build(options);
    }
  }

  // Build main entry point which ties everything together
  const mainOptions: BuildOptions = {
    entryPoints: ["src/main.ts"],
    bundle: true,
    sourcemap: true,
    platform: "browser" as const,
    target: "es2018",
    format: "cjs" as const,
    outfile: resolve(outDir, "main.js"),
    logLevel: "info" as const,
    define: RUNTIME_DEFINES
  };

  if (watch) {
    const ctx = await createContext(mainOptions);
    await ctx.watch();
    console.log("Watching for changes...");
  } else {
    await build(mainOptions);
  }

  return moduleEntries.map(e => e.name);
}

export async function buildProject(watch: boolean): Promise<void> {
  await prepare();

  // Check for MODULAR_BUILD environment variable
  const useModularBuild = process.env.MODULAR_BUILD === "true";

  if (useModularBuild) {
    console.log("Building with modular architecture...");
    const moduleNames = await buildModules(watch);

    // Validate build output in non-watch mode
    if (!watch) {
      await validateBuildOutput(true, moduleNames);
    }
  } else {
    // Legacy single-bundle build for backward compatibility
    const options: BuildOptions = {
      entryPoints: ["src/main.ts"],
      bundle: true,
      sourcemap: true,
      platform: "browser" as const,
      target: "es2018",
      format: "cjs" as const,
      outfile: resolve(outDir, "main.js"),
      logLevel: "info" as const,
      define: RUNTIME_DEFINES
    };

    if (watch) {
      const ctx = await createContext(options);
      await ctx.watch();
      console.log("Watching for changes...");
    } else {
      await build(options);

      // Validate build output in non-watch mode
      if (!watch) {
        await validateBuildOutput(false);
      }
    }
  }
}

/**
 * Validate that expected build artifacts were generated
 */
async function validateBuildOutput(isModular: boolean, moduleNames?: string[]): Promise<void> {
  const { access } = await import("node:fs/promises");
  const { constants } = await import("node:fs");

  // Always require main.js
  const mainPath = resolve(outDir, "main.js");
  try {
    await access(mainPath, constants.F_OK);
  } catch {
    throw new Error(`Build validation failed: main.js was not generated at ${mainPath}`);
  }

  if (isModular && moduleNames) {
    // In modular mode, verify that all expected modules were generated
    for (const moduleName of moduleNames) {
      const modulePath = resolve(outDir, `${moduleName}.js`);
      try {
        await access(modulePath, constants.F_OK);
      } catch {
        throw new Error(`Build validation failed: Expected module ${moduleName}.js was not generated at ${modulePath}`);
      }
    }

    console.log(`✓ Build validation passed: Generated main.js + ${moduleNames.length} runtime modules`);
  } else {
    console.log("✓ Build validation passed: Generated main.js");
  }
}
