/**
 * Vercel Serverless: all /api/* requests are handled by the Express backend.
 * Backend must be built (npm run build:backend) before deploy.
 */
// @ts-ignore - backend dist is ESM
import { app } from "../backend/dist/index.js";
export default app;
