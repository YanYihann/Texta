const fs = require("node:fs"),
  path = require("node:path");
const output = path.resolve(__dirname, "../out");
fs.copyFileSync(
  path.resolve(__dirname, "../../public/CNAME"),
  path.join(output, "CNAME"),
);
fs.writeFileSync(path.join(output, ".nojekyll"), "");
// Next 16.2's static exporter writes nested segment files, while its client asks
// for dot-separated filenames (vercel/next.js#85374). Keep both forms so Pages
// serves Link prefetch and client navigation without requiring rewrite rules.
function segmentAliases(directory, prefix = "") {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (prefix || entry.name.startsWith("__next."))
        segmentAliases(file, prefix ? prefix + "." + entry.name : entry.name);
      else segmentAliases(file);
    } else if (prefix && entry.name.endsWith(".txt")) {
      let parent = directory;
      while (!path.basename(parent).startsWith("__next."))
        parent = path.dirname(parent);
      fs.copyFileSync(
        file,
        path.join(path.dirname(parent), prefix + "." + entry.name),
      );
    }
  }
}
segmentAliases(output);
// Preserve old bookmarks and Electron navigation, including query strings and fragments.
for (const route of [
  "app",
  "pay",
  "admin",
  "admin-usage",
  "admin-usage-detail",
  "privacy",
  "terms",
  "refund",
]) {
  if (!fs.existsSync(path.join(output, route, "index.html")))
    throw Error(`Missing exported route: ${route}`);
  fs.writeFileSync(
    path.join(output, route + ".html"),
    `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>Texta</title><meta name="viewport" content="width=device-width,initial-scale=1"><script>location.replace('/${route}/'+location.search+location.hash)</script></head><body><a href="/${route}/">打开 Texta</a></body></html>`,
  );
}
if (
  /Create Next App/.test(
    fs.readFileSync(path.join(output, "index.html"), "utf8"),
  )
)
  throw Error("Template homepage was exported");
console.log(
  "Static export verified; legacy links, CNAME and .nojekyll included.",
);
