import { buildProject } from "./buildProject";

const watch = process.argv.includes("--watch");

buildProject(watch).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
