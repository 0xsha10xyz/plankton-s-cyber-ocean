/**
 * Vercel build: copy frontend/dist -> repo-root dist/ for static hosting.
 * Run after scripts/sync-api-to-root.cjs (serverless lives in frontend/api, copied to api/).
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");

const frontSrc = path.join(root, "frontend", "dist");
const frontDest = path.join(root, "dist");
if (!fs.existsSync(frontSrc)) {
  console.error("Missing frontend/dist. Run: npm run build --workspace=frontend");
  process.exit(1);
}
if (fs.existsSync(frontDest)) fs.rmSync(frontDest, { recursive: true });
fs.cpSync(frontSrc, frontDest, { recursive: true });
console.log("Copied frontend/dist -> dist");
