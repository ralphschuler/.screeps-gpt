import { mkdir, readdir, rm } from "node:fs/promises";
import { resolve, join } from "node:path";
import { build, context as createContext, type BuildOptions } from "esbuild";

const outDir = resolve("dist");
const srcDir = resolve("src");

async function prepare() {
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });
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
 */
async function buildModules(watch: boolean): Promise<void> {
  const moduleEntries = await findModuleEntryPoints();

  // Build each runtime module as a separate self-contained bundle
  for (const entry of moduleEntries) {
    const outFile = resolve(outDir, `${entry.name}.js`);

    const options: BuildOptions = {
      entryPoints: [entry.path],
      bundle: true,
      sourcemap: true,
      platform: "browser" as const,
      target: "es2021",
      format: "cjs" as const,
      outfile: outFile,
      logLevel: "warning" as const
      // No external modules - each bundle is self-contained
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
    target: "es2021",
    format: "cjs" as const,
    outfile: resolve(outDir, "main.js"),
    logLevel: "info" as const
  };

  if (watch) {
    const ctx = await createContext(mainOptions);
    await ctx.watch();
    console.log("Watching for changes...");
  } else {
    await build(mainOptions);
  }
}

export async function buildProject(watch: boolean): Promise<void> {
  await prepare();

  // Check for MODULAR_BUILD environment variable
  const useModularBuild = process.env.MODULAR_BUILD === "true";

  if (useModularBuild) {
    console.log("Building with modular architecture...");
    await buildModules(watch);
  } else {
    // Legacy single-bundle build for backward compatibility
    const options: BuildOptions = {
      entryPoints: ["src/main.ts"],
      bundle: true,
      sourcemap: true,
      platform: "browser" as const,
      target: "es2021",
      format: "cjs" as const,
      outfile: resolve(outDir, "main.js"),
      logLevel: "info" as const
    };

    if (watch) {
      const ctx = await createContext(options);
      await ctx.watch();
      console.log("Watching for changes...");
    } else {
      await build(options);
    }
  }
}
