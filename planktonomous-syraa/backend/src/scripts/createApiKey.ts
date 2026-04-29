import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { loadEnv } from "../config/env.js";

function hmacSha256(secret: string, value: string): string {
  return crypto.createHmac("sha256", secret).update(value).digest("hex");
}

async function main(): Promise<void> {
  const env = loadEnv();
  const label = process.argv[2] ?? "default";
  const rawKey = crypto.randomBytes(32).toString("hex");
  const keyHash = hmacSha256(env.API_KEY_SECRET, rawKey);

  const prisma = new PrismaClient();
  await prisma.apiKey.create({ data: { keyHash, label } });
  await prisma.$disconnect();

  // Print raw key once (store it securely)
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ label, apiKey: rawKey }, null, 2));
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});

