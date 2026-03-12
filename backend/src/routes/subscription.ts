import { Router } from "express";

export const subscriptionRouter = Router();

const TIERS = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    pattiesPrice: null,
    features: ["Basic Research Feed", "Whale Movement Alerts", "Community Access", "Limited Screener"],
  },
  {
    id: "pro",
    name: "Pro",
    price: "$29/mo",
    pattiesPrice: "23,200 PAP",
    features: ["Advanced AI Research", "Real-time Alerts", "Full Screener Access", "Priority Support", "Chart Indicators"],
    popular: true,
  },
  {
    id: "autonomous",
    name: "Autonomous",
    price: "$99/mo",
    pattiesPrice: "79,200 PAP",
    features: [
      "Full Web4 Auto-Pilot",
      "Autonomous Trading Agent",
      "Custom Risk Profiles",
      "All Pro Features",
      "Dedicated Agent Instance",
      "Governance Voting Power",
    ],
  },
];

subscriptionRouter.get("/tiers", (_req, res) => {
  res.json({ tiers: TIERS });
});

subscriptionRouter.get("/tiers/:id", (req, res) => {
  const tier = TIERS.find((t) => t.id === req.params.id);
  if (!tier) return res.status(404).json({ error: "Tier not found" });
  res.json(tier);
});

// Get current user tier by wallet (default free; can be extended with DB)
subscriptionRouter.get("/me", (req, res) => {
  const wallet = req.query.wallet as string | undefined;
  if (!wallet) return res.status(400).json({ error: "wallet query required" });
  // TODO: resolve tier from DB by wallet; for now always free
  res.json({ tier: "free" });
});
