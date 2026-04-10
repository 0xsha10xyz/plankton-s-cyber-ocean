/**
 * Copy JSON under src/data next to compiled output (tsc does not emit .json from src/).
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const srcDir = path.join(root, "src", "data");
const destDir = path.join(root, "dist", "data");

if (!fs.existsSync(srcDir)) {
  process.exit(0);
}

const files = fs.readdirSync(srcDir).filter((f) => f.endsWith(".json"));
if (files.length === 0) {
  process.exit(0);
}

fs.mkdirSync(destDir, { recursive: true });
for (const f of files) {
  fs.copyFileSync(path.join(srcDir, f), path.join(destDir, f));
  console.log("[copy-agent-data]", path.relative(root, path.join(destDir, f)));
}
