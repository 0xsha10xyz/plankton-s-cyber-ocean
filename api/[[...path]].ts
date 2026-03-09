/**
 * Vercel Serverless: semua /api/* di-handle oleh Express backend.
 * Backend harus sudah di-build (npm run build:backend) sebelum deploy.
 */
// @ts-ignore - backend dist is ESM
import { app } from "../backend/dist/index.js";
export default app;
