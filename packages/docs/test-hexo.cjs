const Hexo = require("hexo");
const fs = require("fs");
const yaml = require("yaml");
const path = require("path");

const configPath = path.join(process.cwd(), "_config.yml");
const userConfig = yaml.parse(fs.readFileSync(configPath, "utf8"));
const hexo = new Hexo(process.cwd(), {});

hexo
  .init()
  .then(() => {
    Object.assign(hexo.config, userConfig);
    hexo.theme_dir = path.join(hexo.base_dir, "themes", hexo.config.theme) + path.sep;

    hexo.loadPlugin(require.resolve("hexo-renderer-ejs"));

    return hexo.load();
  })
  .then(() => {
    console.log("Theme:", hexo.config.theme);
    console.log("Theme views loaded:", Object.keys(hexo.theme.views || {}).length);
    console.log("Sample views:", Object.keys(hexo.theme.views || {}).slice(0, 10));
    console.log("Has index view:", !!hexo.theme.getView("index"));
    console.log("Has page view:", !!hexo.theme.getView("page"));
    console.log("Has layout view:", !!hexo.theme.getView("layout"));
  })
  .catch(console.error);
