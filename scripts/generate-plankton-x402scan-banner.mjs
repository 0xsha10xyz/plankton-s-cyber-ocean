/**
 * Plankton | x402scan banner for X — dark topo backdrop, white center rule, Plankton lockup + x402scan logo.
 * Canvas 2400×640 (panoramic; wider than classic 1920×640).
 * Run: npm run generate:banner-x402scan
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const PLANKTON_PNG = join(ROOT, "frontend/public/brand/plankton-token-logo.png");
const X402SCAN_PNG = join(ROOT, "frontend/public/brand/x402scan-logo.png");
const OUT_DIR = join(ROOT, "assets/banners");
const OUT_SVG = join(OUT_DIR, "plankton-x402scan-banner.embed.svg");
const OUT_PNG = join(OUT_DIR, "plankton-x402scan-banner.png");
const OUT_PNG_PUBLIC = join(ROOT, "frontend/public/banners/plankton-x402scan-banner.png");

/** Panoramic width (X header–friendly; more horizontal than 1920). */
const W = 2400;
const H = 640;

function toDataUrl(buf) {
  return `data:image/png;base64,${buf.toString("base64")}`;
}

function buildSvg(planktonDataUrl, x402DataUrl) {
  const mid = W / 2;
  const leftCx = W / 4;
  const rightCx = (W * 3) / 4;
  const plClipR = 88;
  const plImgW = 176;
  const plImgH = 176;
  const plImgX = leftCx - plImgW / 2;
  const plImgY = 122;
  const plCy = plImgY + plImgH / 2;
  const ringR = 90;
  const tile = 208;
  const tileX = rightCx - tile / 2;
  const tileY = 138;
  const inner = 184;
  const innerX = rightCx - inner / 2;
  const innerY = 150;
  const cornerOff = 28;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <radialGradient id="bgGlow" cx="50%" cy="0%" r="65%">
      <stop offset="0%" stop-color="#22d3ee" stop-opacity="0.09"/>
      <stop offset="100%" stop-color="#22d3ee" stop-opacity="0"/>
    </radialGradient>
    <clipPath id="plClip"><circle cx="${leftCx}" cy="${plCy}" r="${plClipR}"/></clipPath>
    <filter id="whiteGlow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="4" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <rect width="${W}" height="${H}" fill="#020203"/>
  <rect width="${W}" height="${H}" fill="url(#bgGlow)" opacity="0.9"/>
  <g fill="none" stroke="#ffffff" stroke-opacity="0.065" stroke-width="1.1">
    <path d="M0 72 C${W * 0.13} 40 ${W * 0.27} 88 ${mid} 64 S${W * 0.73} 36 ${W} 30"/>
    <path d="M0 118 C${W * 0.17} 88 ${W * 0.29} 145 ${mid * 1.08} 105 S${W * 0.78} 58 ${W} 46"/>
    <path d="M0 168 C${W * 0.15} 140 ${W * 0.3} 195 ${mid * 1.04} 158 S${W * 0.72} 108 ${W} 92"/>
    <path d="M0 222 C${W * 0.12} 198 ${W * 0.25} 252 ${mid} 215 S${W * 0.68} 162 ${W} 148"/>
    <path d="M0 278 C${W * 0.18} 250 ${W * 0.33} 310 ${mid * 1.12} 272 S${W * 0.74} 228 ${W} 212"/>
    <path d="M0 334 C${W * 0.13} 312 ${W * 0.27} 365 ${mid * 1.02} 332 S${W * 0.71} 286 ${W} 268"/>
    <path d="M0 388 C${W * 0.21} 360 ${W * 0.38} 420 ${mid * 1.18} 385 S${W * 0.76} 346 ${W} 328"/>
    <path d="M0 445 C${W * 0.17} 425 ${W * 0.37} 475 ${mid * 1.1} 448 S${W * 0.75} 412 ${W} 396"/>
  </g>
  <g stroke="#2DD4BF" stroke-opacity="0.14" stroke-width="1.2" stroke-linecap="round" fill="none">
    <path d="M${cornerOff} 72h66l12-12V28"/>
    <path d="M${cornerOff} 72h66l12-12V28" transform="translate(${W} 0) scale(-1 1)"/>
  </g>
  <line x1="${mid - 0.5}" y1="96" x2="${mid - 0.5}" y2="520" stroke="#ffffff" stroke-opacity="0.35" stroke-width="4" filter="url(#whiteGlow)"/>
  <line x1="${mid}" y1="96" x2="${mid}" y2="520" stroke="#ffffff" stroke-opacity="0.92" stroke-width="1.25"/>
  <image xlink:href="${planktonDataUrl}" href="${planktonDataUrl}" x="${plImgX}" y="${plImgY}" width="${plImgW}" height="${plImgH}" clip-path="url(#plClip)" preserveAspectRatio="xMidYMid slice"/>
  <circle cx="${leftCx}" cy="${plCy}" r="${ringR}" stroke="#67e8f9" stroke-width="3.5" fill="none" opacity="0.92"/>
  <text x="${leftCx}" y="348" text-anchor="middle" fill="#C6FAF5" font-family="Segoe UI, system-ui, sans-serif" font-size="36" font-weight="700" letter-spacing="0.14em">PLANKTON</text>
  <text x="${leftCx}" y="392" text-anchor="middle" fill="#FFFFFF" font-family="Segoe UI, system-ui, sans-serif" font-size="17.5" font-weight="400">The Autonomous Protocol · Agent Chat on Solana</text>
  <rect x="${tileX}" y="${tileY}" width="${tile}" height="${tile}" rx="20" fill="#ffffff" stroke="#ffffff" stroke-opacity="0.2" stroke-width="1"/>
  <image xlink:href="${x402DataUrl}" href="${x402DataUrl}" x="${innerX}" y="${innerY}" width="${inner}" height="${inner}" preserveAspectRatio="xMidYMid meet"/>
  <text x="${rightCx}" y="410" text-anchor="middle" font-family="Segoe UI, system-ui, sans-serif" font-size="44" font-weight="700">
    <tspan fill="#ffffff">x402</tspan><tspan fill="#38bdf8">scan</tspan>
  </text>
  <text x="${rightCx}" y="452" text-anchor="middle" fill="#cbd5e1" font-family="Segoe UI, system-ui, sans-serif" font-size="18" font-weight="400">Listed · HTTP 402 discovery</text>
  <text x="${mid}" y="582" text-anchor="middle" fill="#ffffff" fill-opacity="0.72" font-family="Segoe UI, system-ui, sans-serif" font-size="20" font-weight="400"><tspan fill-opacity="0.55">Explore the ecosystem at </tspan><tspan font-weight="600" fill="#7dd3fc">x402scan.com</tspan></text>
</svg>`;
}

async function main() {
  const [plankBuf, x402Buf] = await Promise.all([readFile(PLANKTON_PNG), readFile(X402SCAN_PNG)]);
  const svg = buildSvg(toDataUrl(plankBuf), toDataUrl(x402Buf));
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(OUT_SVG, svg, "utf8");
  console.log("Wrote", OUT_SVG, `(${W}×${H})`);

  try {
    const { Resvg } = await import("@resvg/resvg-js");
    const resvg = new Resvg(svg, {
      background: "#020203",
      fitTo: { mode: "width", value: W },
    });
    const pngBuffer = resvg.render().asPng();
    await mkdir(dirname(OUT_PNG_PUBLIC), { recursive: true });
    await writeFile(OUT_PNG, pngBuffer);
    await writeFile(OUT_PNG_PUBLIC, pngBuffer);
    console.log("Wrote", OUT_PNG, `(${pngBuffer.length} bytes)`);
    console.log("Wrote", OUT_PNG_PUBLIC);
  } catch (e) {
    console.warn(e?.message ?? e);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
