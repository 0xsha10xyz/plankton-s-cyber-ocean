/**
 * Copy frontend/dist to root dist for Vercel (output directory).
 * Run after: npm run build:backend && npm run build
 */
const fs = require("fs");
const path = require("path");

const src = path.join(__dirname, "..", "frontend", "dist");
const dest = path.join(__dirname, "..", "dist");

if (!fs.existsSync(src)) {
  console.error("Missing frontend/dist. Run: npm run build --workspace=frontend");
  process.exit(1);
}

if (fs.existsSync(dest)) {
  fs.rmSync(dest, { recursive: true });
}
fs.cpSync(src, dest, { recursive: true });
console.log("Copied frontend/dist -> dist");
