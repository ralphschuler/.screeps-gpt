import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { inc, valid } from "semver";

async function bump(): Promise<void> {
  const pkgPath = resolve("package.json");
  const content = await readFile(pkgPath, "utf8");
  const pkg = JSON.parse(content) as { version: string };
  if (!valid(pkg.version)) {
    throw new Error(`Invalid version in package.json: ${pkg.version}`);
  }

  const next = inc(pkg.version, "patch");
  if (!next) {
    throw new Error("Unable to calculate next version");
  }

  pkg.version = next;
  await writeFile(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
  console.log(next);
}

bump().catch((error: unknown) => {
  if (error instanceof Error) {
    console.error(error.message);
  } else {
    console.error(error);
  }
  process.exitCode = 1;
});
