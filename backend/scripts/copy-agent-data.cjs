/**
 * Copy static agent data next to compiled output (tsc does not emit .json from src/).
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const srcFile = path.join(root, "src", "data", "indonesian-detection-tokens.json");
const destFile = path.join(root, "dist", "data", "indonesian-detection-tokens.json");

if (!fs.existsSync(srcFile)) {
  console.warn("[copy-agent-data] skip: missing", srcFile);
  process.exit(0);
}

fs.mkdirSync(path.dirname(destFile), { recursive: true });
fs.copyFileSync(srcFile, destFile);
console.log("[copy-agent-data]", path.relative(root, destFile));
