/**
 * Vercel serverless: GET /api/market/token-info?mint=...
 * Resolves token name/symbol + decimals (Birdeye/Jupiter/RPC fallback).
 *
 * UI expects a readable "token name" (not CA-like truncation). To achieve that reliably,
 * we also parse Metaplex on-chain metadata as a last-resort.
 */
import type { IncomingMessage, ServerResponse } from "http";
import { PublicKey } from "@solana/web3.js";

function sendJson(res: ServerResponse, statusCode: number, body: unknown): void {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "private, max-age=60");
  res.end(JSON.stringify(body));
}

function asTrimmedString(x: unknown): string | null {
  return typeof x === "string" ? (x.trim() || null) : null;
}

async function lookupTokenViaJupiter(mint: string): Promise<{ symbol: string; name?: string; decimals: number } | null> {
  const truncated = `${mint.slice(0, 4)}…${mint.slice(-4)}`;
  const urls = [
    // lite-api often works without x-api-key (but not guaranteed for all endpoints/mints)
    `https://lite-api.jup.ag/tokens/v1/token/${encodeURIComponent(mint)}`,
    // api.jup.ag is more likely to require x-api-key
    `https://api.jup.ag/tokens/v1/token/${encodeURIComponent(mint)}`,
  ];

  // Optional: if you set this env var, Jupiter token API calls can succeed even when auth is required.
  const apiKey =
    process.env.JUPITER_API_KEY ||
    process.env.JUPITER_TOKEN_API_KEY ||
    process.env.JUP_AGGREGATOR_API_KEY;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    for (const u of urls) {
      try {
        const r = await fetch(u, {
          headers: apiKey ? { "x-api-key": apiKey } : undefined,
          signal: controller.signal,
        });
        if (!r.ok) continue;
        const j = (await r.json()) as unknown;

        // Response shape is usually { symbol, decimals, ... } but be tolerant.
        const obj = (j as any)?.data ?? j;
        const symbolFromApi = asTrimmedString((obj as any)?.symbol) ?? asTrimmedString((j as any)?.symbol);
        const nameFromApi = asTrimmedString((obj as any)?.name) ?? asTrimmedString((j as any)?.name);
        const decimalsRaw = (obj as any)?.decimals ?? (j as any)?.decimals ?? (obj as any)?.data?.decimals;
        const decimals = typeof decimalsRaw === "number" ? decimalsRaw : Number(decimalsRaw);

        if (typeof symbolFromApi === "string" && Number.isFinite(decimals) && decimals >= 0 && decimals <= 18) {
          return { symbol: symbolFromApi, name: nameFromApi ?? undefined, decimals };
        }
        if (Number.isFinite(decimals) && decimals >= 0 && decimals <= 18) {
          // Allow truncated symbol fallback; decimals are what block swaps.
          return { symbol: truncated, decimals };
        }
      } catch {
        continue;
      }
    }
  } finally {
    clearTimeout(timeout);
  }

  return null;
}

async function tryRpcDecimalsViaJsonParsed(mint: string, rpcUrl: string): Promise<number | null> {
  // jsonParsed avoids brittle "readUInt8(44)" assumptions across mint/account variants.
  const rpcRes = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getAccountInfo",
      params: [mint, { encoding: "jsonParsed" }],
    }),
  });
  const rpcJson = await rpcRes.json();
  const decimalsRaw = rpcJson?.result?.value?.data?.parsed?.info?.decimals;
  const decimals = typeof decimalsRaw === "number" ? decimalsRaw : Number(decimalsRaw);
  if (!Number.isFinite(decimals) || decimals < 0 || decimals > 18) return null;
  return decimals;
}

async function tryRpcDecimalsViaTokenSupply(mint: string, rpcUrl: string): Promise<number | null> {
  const rpcRes = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getTokenSupply",
      params: [mint],
    }),
  });
  const rpcJson = await rpcRes.json();
  const decimalsRaw = rpcJson?.result?.value?.decimals;
  const decimals = typeof decimalsRaw === "number" ? decimalsRaw : Number(decimalsRaw);
  if (!Number.isFinite(decimals) || decimals < 0 || decimals > 18) return null;
  return decimals;
}

const MPL_TOKEN_METADATA_PROGRAM_ID_B58 = "metaqbxxuerdq2enqj7ggx8d3ndkbpmwc9j8k4nfp6r2p1";

async function getMetaplexMetadata(
  mint: string
): Promise<{ name?: string; symbol?: string } | null> {
  if (!mint || typeof mint !== "string" || mint.length < 32 || mint.length > 44) return null;
  try {
    const mintPk = new PublicKey(mint);
    const programId = new PublicKey(MPL_TOKEN_METADATA_PROGRAM_ID_B58);
    const [metadataPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("metadata"), programId.toBuffer(), mintPk.toBuffer()],
      programId
    );

    const rpcUrl = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
    const res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getAccountInfo",
        params: [metadataPda.toBase58(), { encoding: "base64" }],
      }),
    });

    const json = await res.json();
    const b64 = json?.result?.value?.data?.[0];
    if (!b64 || typeof b64 !== "string") return null;

    const buf = Buffer.from(b64, "base64");
    const minLen = 1 + 32 + 32 + 4 + 1 + 4 + 1; // minimal heuristic (same as backend)
    if (buf.length < minLen) return null;

    let off = 1 + 32 + 32; // after key, update_authority, mint
    const nameLen = buf.readUInt32LE(off);
    off += 4;
    if (nameLen > 256 || off + nameLen > buf.length) return null;
    const name = buf.subarray(off, off + nameLen).toString("utf8").trim();
    off += nameLen;

    if (off + 4 > buf.length) return null;
    const symbolLen = buf.readUInt32LE(off);
    off += 4;
    if (symbolLen > 32 || off + symbolLen > buf.length) return null;
    const symbol = buf.subarray(off, off + symbolLen).toString("utf8").trim();

    return {
      name: name || undefined,
      symbol: symbol || undefined,
    };
  } catch {
    return null;
  }
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if ((req.method || "GET").toUpperCase() !== "GET") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }
  const url = req.url || "/";
  const query = url.includes("?") ? url.slice(url.indexOf("?") + 1) : "";
  const searchParams = new URLSearchParams(query);
  const mint = searchParams.get("mint")?.trim() || "";

  if (!mint || mint.length > 64) {
    sendJson(res, 400, { error: "Missing or invalid mint" });
    return;
  }

  const apiKey = process.env.BIRDEYE_API_KEY;
  const truncated = `${mint.slice(0, 4)}…${mint.slice(-4)}`;
  const metaplex = await getMetaplexMetadata(mint).catch(() => null);
  const metaplexName = metaplex?.name;
  const metaplexSymbol = metaplex?.symbol;

  if (apiKey) {
    try {
      const overviewUrl = `https://public-api.birdeye.so/defi/token_overview?address=${encodeURIComponent(mint)}`;
      const resp = await fetch(overviewUrl, {
        headers: { "X-API-KEY": apiKey, "x-chain": "solana" },
      });
      if (resp.ok) {
        const json = await resp.json();
        const data = json?.data;
        const symbol = typeof data?.symbol === "string" ? data.symbol : undefined;
        const name = typeof data?.name === "string" ? data.name : undefined;
        const decimals = typeof data?.decimals === "number" ? data.decimals : undefined;
        if (decimals !== undefined) {
          sendJson(res, 200, {
            symbol: symbol || metaplexSymbol || truncated,
            name: name || metaplexName,
            decimals,
          });
          return;
        }
      }
    } catch {
      // fall through
    }
  }

  // 1) Try Jupiter token metadata first (best chance of correct symbol + decimals).
  try {
    const jup = await lookupTokenViaJupiter(mint);
    if (jup) {
      sendJson(res, 200, {
        symbol: jup.symbol || metaplexSymbol || truncated,
        name: jup.name || metaplexName,
        decimals: jup.decimals,
      });
      return;
    }
  } catch {
    // ignore
  }

  // 2) Try RPC jsonParsed decimals (most reliable way to avoid layout/offset issues).
  try {
    const rpcUrl = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
    const decimals = await tryRpcDecimalsViaJsonParsed(mint, rpcUrl);
    if (decimals != null) {
      // Symbol is nice-to-have; swaps only truly require correct decimals.
      sendJson(res, 200, {
        symbol: metaplexSymbol || truncated,
        name: metaplexName,
        decimals,
      });
      return;
    }
  } catch {
    // ignore
  }

  // 3) Try getTokenSupply (another reliable decimals source for mint accounts).
  try {
    const rpcUrl = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
    const decimals = await tryRpcDecimalsViaTokenSupply(mint, rpcUrl);
    if (decimals != null) {
      sendJson(res, 200, {
        symbol: metaplexSymbol || truncated,
        name: metaplexName,
        decimals,
      });
      return;
    }
  } catch {
    // ignore
  }

  // 4) As a last resort, keep the older base64 layout parsing (may still work for standard SPL mints).
  try {
    const rpcUrl = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
    const rpcRes = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getAccountInfo",
        params: [mint, { encoding: "base64" }],
      }),
    });
    const rpcJson = await rpcRes.json();
    const result = rpcJson?.result?.value;
    const b64 = result?.data?.[0];
    if (b64 && typeof b64 === "string") {
      const buf = Buffer.from(b64, "base64");
      if (buf.length >= 45) {
        const decimals = buf.readUInt8(44);
        if (Number.isFinite(decimals) && decimals >= 0 && decimals <= 18) {
            sendJson(res, 200, {
              symbol: metaplexSymbol || truncated,
              name: metaplexName,
              decimals,
            });
          return;
        }
      }
    }
  } catch {
    // ignore
  }

  sendJson(res, 404, { error: "Token not found or invalid mint" });
}
