import type { Router } from "express";
import express from "express";
import { z } from "zod";
import { validateBody } from "../middleware/validate.middleware.js";
import type { SyraaClient } from "../services/syraaClient.js";

const schema = z.object({
  query: z.string().min(1),
  asset: z.string().optional(),
});

export function insightRouter({ syraa }: { syraa: SyraaClient }): Router {
  const r = express.Router();
  r.post("/", validateBody(schema), async (req, res, next) => {
    try {
      const body = schema.parse(req.body);
      const payload = body.asset ? { query: body.query, context: { asset: body.asset } } : { query: body.query };
      const out = await syraa.getInsight(payload);
      res.json(out);
    } catch (e) {
      next(e);
    }
  });
  return r;
}

