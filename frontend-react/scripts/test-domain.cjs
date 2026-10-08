const path = require("node:path");
const { execFileSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
execFileSync(
  process.execPath,
  [
    path.join(root, "node_modules/typescript/bin/tsc"),
    "src/lib/texta/library.ts",
    "src/lib/texta/reading.ts",
    "src/lib/texta/words.ts",
    "src/lib/texta/export.ts",
    "--module",
    "commonjs",
    "--moduleResolution",
    "node",
    "--target",
    "ES2022",
    "--skipLibCheck",
    "--outDir",
    "../output/frontend-domain",
  ],
  { cwd: root, stdio: "inherit" },
);
execFileSync(process.execPath, ["--test", "tests/domain.cjs"], {
  cwd: root,
  stdio: "inherit",
});
