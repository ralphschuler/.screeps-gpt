import Hexo from "hexo";
import { resolve } from "node:path";
import { cp, rm } from "node:fs/promises";

async function buildHexoSite(): Promise<void> {
  console.log("Building Hexo documentation site...\n");

  const hexo = new Hexo(resolve("."), {
    silent: false,
    debug: false
  });

  try {
    // Initialize Hexo
    console.log("Initializing Hexo...");
    await hexo.init();

    // Load plugins and theme
    console.log("Loading plugins...");
    await hexo.load();

    // Manually load renderers after init
    console.log("Loading renderers...");
    const plugins = [
      "hexo-renderer-ejs",
      "hexo-renderer-marked",
      "hexo-renderer-stylus",
      "hexo-generator-index",
      "hexo-generator-archive",
      "hexo-generator-category",
      "hexo-generator-tag"
    ];

    for (const pluginName of plugins) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const plugin = await import(pluginName);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (typeof plugin.default === "function") {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
          plugin.default(hexo);
        } else if (typeof plugin === "function") {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call
          plugin(hexo);
        }
      } catch (error) {
        console.warn(`Failed to load plugin ${pluginName}:`, error);
      }
    }

    // Debug info
    console.log("\nConfiguration:");
    console.log("- Theme:", hexo.config.theme);
    console.log("- Theme dir:", hexo.theme_dir);
    console.log("- Source dir:", hexo.source_dir);
    console.log("- Public dir:", hexo.public_dir);
    console.log("- Renderers:", Object.keys(hexo.extend.renderer.list()));
    console.log("- Generators:", Object.keys(hexo.extend.generator.list()));

    // Clean previous build
    console.log("\nCleaning previous build...");
    await hexo.call("clean");

    // Generate the site
    console.log("\nGenerating site...");
    await hexo.call("generate", { force: true });

    // Copy to build/docs-site for GitHub Pages compatibility
    console.log("\nCopying to build/docs-site...");
    const targetDir = resolve("build/docs-site");
    await rm(targetDir, { recursive: true, force: true });
    await cp(hexo.public_dir, targetDir, { recursive: true });

    console.log("\n✅ Hexo site built successfully!");
    console.log("Output: build/docs-site/");
  } catch (error) {
    console.error("Build error:", error);
    throw error;
  } finally {
    await hexo.exit();
  }
}

buildHexoSite().catch(error => {
  console.error("Build failed:", error);
  process.exitCode = 1;
});
