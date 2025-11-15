#!/usr/bin/env node
const { execSync } = require("child_process");

try {
  // Use npx hexo which works properly with fresh hexo setup
  execSync("npx hexo generate", {
    cwd: process.cwd(),
    stdio: "inherit"
  });
  console.log("Documentation site generated successfully!");
  process.exit(0);
} catch (err) {
  console.error("Error generating documentation:", err.message);
  process.exit(1);
}
