import { mkdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { build, context as createContext } from "esbuild";

const outFile = resolve("dist/main.js");

async function prepare() {
  await rm(dirname(outFile), { recursive: true, force: true });
  await mkdir(dirname(outFile), { recursive: true });
}

export async function buildProject(watch: boolean): Promise<void> {
  await prepare();
  const options = {
    entryPoints: ["src/main.ts"],
    bundle: true,
    sourcemap: true,
    platform: "browser" as const,
    target: "es2021",
    format: "cjs" as const,
    outfile: outFile,
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
