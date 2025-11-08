import { buildProject } from "./lib/buildProject";

const watch = process.argv.includes("--watch");

buildProject(watch).catch(error => {
  console.error(error);
  process.exitCode = 1;
});
