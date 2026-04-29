import type { Router } from "express";
import express from "express";
import { z } from "zod";
import { validateBody } from "../middleware/validate.middleware.js";
import type { SyraaClient } from "../services/syraaClient.js";

const schema = z.object({
  walletAddress: z.string().min(1),
});

export function trackingRouter({ syraa }: { syraa: SyraaClient }): Router {
  const r = express.Router();
  r.post("/", validateBody(schema), async (req, res, next) => {
    try {
      const body = schema.parse(req.body);
      const out = await syraa.trackWallet(body.walletAddress);
      res.json(out);
    } catch (e) {
      next(e);
    }
  });
  return r;
}

