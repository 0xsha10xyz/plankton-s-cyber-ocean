/**
 * Vercel build: copy frontend/dist -> repo-root dist/ for static hosting.
 * Serverless routes live in repo-root `api/` (see docs/DEPLOYMENT.md).
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

/**
 * Clear `dist/` contents but keep the directory. Deleting the whole `dist` folder
 * can race with Vercel analyzing `outputDirectory` (ENOENT on plankton-documentation.html).
 */
function emptyDirInPlace(dir) {
  fs.mkdirSync(dir, { recursive: true });
  for (const name of fs.readdirSync(dir)) {
    fs.rmSync(path.join(dir, name), { recursive: true, force: true });
  }
}

emptyDirInPlace(frontDest);
fs.cpSync(frontSrc, frontDest, { recursive: true });

const docOut = path.join(frontDest, "plankton-documentation.html");
if (!fs.existsSync(docOut) && fs.existsSync(docFallback)) {
  fs.copyFileSync(docFallback, docOut);
  console.log("Restored plankton-documentation.html from frontend/public");
}

console.log("Copied frontend/dist -> dist");
