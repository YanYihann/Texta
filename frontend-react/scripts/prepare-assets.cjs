const fs = require("node:fs");
const path = require("node:path");
const source = path.resolve(__dirname, "../../public");
const target = path.resolve(__dirname, "../public");
fs.mkdirSync(target, { recursive: true });
for (const name of [
  "fonts",
  "vendor",
  "assets",
  "workspace.css",
  "controls.css",
  "vocabulary.css",
  "legal.css",
  "billing.css",
  "favicon.svg",
  "logo.svg",
])
  fs.cpSync(path.join(source, name), path.join(target, name), {
    recursive: true,
  });
