/**
 * Vercel build: copy frontend/dist -> repo-root dist/ for static hosting.
 * Serverless routes live in repo-root `api/` (see docs/DEPLOYMENT.md).
 *
 * We merge into dist/ without deleting the folder first. Clearing dist/ caused
 * ENOENT on plankton-documentation.html when Vercel analyzed outputDirectory
 * between delete and copy.
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");

const frontSrc = path.join(root, "frontend", "dist");
const frontDest = path.join(root, "dist");
const docFallback = path.join(root, "frontend", "public", "plankton-documentation.html");

if (!fs.existsSync(frontSrc)) {
  console.error("Missing frontend/dist. Run: npm run build --workspace=frontend");
  process.exit(1);
}

fs.mkdirSync(frontDest, { recursive: true });
fs.cpSync(frontSrc, frontDest, { recursive: true });

const docOut = path.join(frontDest, "plankton-documentation.html");
if (fs.existsSync(docFallback)) {
  fs.copyFileSync(docFallback, docOut);
}

console.log("Copied frontend/dist -> dist");