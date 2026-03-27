/**
 * Vercel build: copy frontend/dist -> dist and backend/dist -> vercel-express-bundle/.
 * The Express bundle must NOT live under api/: Vercel treats nested .js files under api/ as
 * extra serverless entrypoints, which breaks deployment when helper bundles sit next to handlers.
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");

// 1. Frontend dist -> root dist
const frontSrc = path.join(root, "frontend", "dist");
const frontDest = path.join(root, "dist");
if (!fs.existsSync(frontSrc)) {
  console.error("Missing frontend/dist. Run: npm run build --workspace=frontend");
  process.exit(1);
}
if (fs.existsSync(frontDest)) fs.rmSync(frontDest, { recursive: true });
fs.cpSync(frontSrc, frontDest, { recursive: true });
console.log("Copied frontend/dist -> dist");

// 2. Remove legacy backend copy under api/ (can be restored from Vercel cache).
//    If left behind, Vercel counts those *.js files as extra Serverless Functions.
const legacyBackDest = path.join(root, "api", "__backend");
if (fs.existsSync(legacyBackDest)) fs.rmSync(legacyBackDest, { recursive: true, force: true });

// 3. Backend dist -> repo-root vercel-express-bundle (imported from api/[[...path]].ts)
const backSrc = path.join(root, "backend", "dist");
const backDest = path.join(root, "vercel-express-bundle");
if (!fs.existsSync(backSrc)) {
  console.error("Missing backend/dist. Run: npm run build --workspace=backend");
  process.exit(1);
}
if (fs.existsSync(backDest)) fs.rmSync(backDest, { recursive: true });
fs.cpSync(backSrc, backDest, { recursive: true });
console.log("Copied backend/dist -> vercel-express-bundle");
