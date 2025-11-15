#!/usr/bin/env node
const Hexo = require("hexo");
const fs = require("fs");
const yaml = require("yaml");
const path = require("path");

// Manually load config first
const configPath = path.join(process.cwd(), "_config.yml");
const configContent = fs.readFileSync(configPath, "utf8");
const userConfig = yaml.parse(configContent);

// Create hexo instance
const hexo = new Hexo(process.cwd(), {});

hexo
  .init()
  .then(() => {
    // Override config after init
    Object.assign(hexo.config, userConfig);

    // Update theme_dir to match the config
    hexo.theme_dir = path.join(hexo.base_dir, "themes", hexo.config.theme, path.sep);
    hexo.theme_script_dir = path.join(hexo.theme_dir, "scripts", path.sep);

    console.log("Loaded config - Theme:", hexo.config.theme);
    console.log("Theme dir:", hexo.theme_dir);

    // Manually load plugins after init
    hexo.loadPlugin(require.resolve("hexo-renderer-marked"));
    hexo.loadPlugin(require.resolve("hexo-renderer-ejs"));
    hexo.loadPlugin(require.resolve("hexo-renderer-stylus"));
    hexo.loadPlugin(require.resolve("hexo-generator-index"));
    hexo.loadPlugin(require.resolve("hexo-generator-archive"));
    hexo.loadPlugin(require.resolve("hexo-generator-category"));
    hexo.loadPlugin(require.resolve("hexo-generator-tag"));
    hexo.loadPlugin(require.resolve("hexo-generator-search"));
    hexo.loadPlugin(require.resolve("hexo-generator-feed"));
    return hexo.load();
  })
  .then(() => hexo.call("generate"))
  .then(() => {
    console.log("Documentation site generated successfully!");
    process.exit(0);
  })
  .catch(err => {
    console.error("Error generating documentation:", err);
    console.error(err.stack);
    process.exit(1);
  });
