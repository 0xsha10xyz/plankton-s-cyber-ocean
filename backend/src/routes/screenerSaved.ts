import { Router } from "express";

export const screenerSavedRouter = Router();

type SavedScreener = {
  id: string;
  name: string;
  createdAt: number;
  config: Record<string, unknown>;
};

// Lightweight dev storage (resets on restart).
const SAVED: SavedScreener[] = [];

function makeId() {
  return `scr_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

screenerSavedRouter.get("/saved", (_req, res) => {
  res.json({ saved: SAVED.slice(0, 25) });
});

screenerSavedRouter.post("/saved", (req, res) => {
  const name = String(req.body?.name ?? "").trim();
  const config = (req.body?.config ?? {}) as Record<string, unknown>;
  if (!name) return res.status(400).json({ error: "name required" });
  const item: SavedScreener = { id: makeId(), name, createdAt: Date.now(), config };
  SAVED.unshift(item);
  res.status(201).json({ saved: item });
});

