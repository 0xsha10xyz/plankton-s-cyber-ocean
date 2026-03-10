/**
 * Vercel build: copy frontend/dist -> dist and backend/dist -> api/__backend.
 * Backend in api/__backend is imported by the serverless handler so it gets bundled.
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

// 2. Backend dist -> api/__backend (so serverless can import it)
const backSrc = path.join(root, "backend", "dist");
const backDest = path.join(root, "api", "__backend");
if (!fs.existsSync(backSrc)) {
  console.error("Missing backend/dist. Run: npm run build --workspace=backend");
  process.exit(1);
}
if (fs.existsSync(backDest)) fs.rmSync(backDest, { recursive: true });
fs.cpSync(backSrc, backDest, { recursive: true });
console.log("Copied backend/dist -> api/__backend");
