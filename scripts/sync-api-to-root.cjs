/**
 * Vercel / local production build: copy `frontend/api` → repo-root `api/`.
 * Source of truth for serverless handlers lives under `frontend/api` so deployments with
 * Vercel "Root Directory" = `frontend` still ship `/api/*` from the same files.
 * Deployments with Root = `.` also use the generated `api/` folder (Hobby: one copy of each route).
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const src = path.join(root, "frontend", "api");
const dest = path.join(root, "api");

if (!fs.existsSync(src)) {
  console.error("Missing frontend/api. Serverless routes must live under frontend/api/");
  process.exit(1);
}
if (fs.existsSync(dest)) fs.rmSync(dest, { recursive: true, force: true });
fs.cpSync(src, dest, { recursive: true });
console.log("Synced frontend/api -> api/");
