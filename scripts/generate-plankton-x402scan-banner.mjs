/**
 * Plankton | x402scan banner for X — dark topo backdrop, white center rule, Plankton lockup + x402scan logo.
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

const W = 1920;
const H = 640;

function toDataUrl(buf) {
  return `data:image/png;base64,${buf.toString("base64")}`;
}

function buildSvg(planktonDataUrl, x402DataUrl) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <radialGradient id="bgGlow" cx="50%" cy="0%" r="65%">
      <stop offset="0%" stop-color="#22d3ee" stop-opacity="0.09"/>
      <stop offset="100%" stop-color="#22d3ee" stop-opacity="0"/>
    </radialGradient>
    <clipPath id="plClip"><circle cx="480" cy="210" r="88"/></clipPath>
    <filter id="whiteGlow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="4" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <rect width="${W}" height="${H}" fill="#020203"/>
  <rect width="${W}" height="${H}" fill="url(#bgGlow)" opacity="0.9"/>
  <g fill="none" stroke="#ffffff" stroke-opacity="0.065" stroke-width="1.1">
    <path d="M0 72 C320 40 640 88 960 64s640-38 960-28"/>
    <path d="M0 118 C400 88 700 145 1100 105s520-48 820-40"/>
    <path d="M0 168 C360 140 720 195 1200 158s480-52 720-44"/>
    <path d="M0 222 C280 198 600 252 960 215s720-58 960-48"/>
    <path d="M0 278 C420 250 780 310 1280 272s440-42 640-36"/>
    <path d="M0 334 C300 312 640 365 1000 332s620-30 920-24"/>
    <path d="M0 388 C500 360 900 420 1400 385s380-18 520-12"/>
    <path d="M0 445 C400 425 880 475 1280 448s440-10 640-6"/>
  </g>
  <g stroke="#2DD4BF" stroke-opacity="0.14" stroke-width="1.2" stroke-linecap="round" fill="none">
    <path d="M28 72h66l12-12V28"/><path d="M1892 72h66l12-12V28"/>
  </g>
  <line x1="959" y1="96" x2="959" y2="520" stroke="#ffffff" stroke-opacity="0.35" stroke-width="4" filter="url(#whiteGlow)"/>
  <line x1="960" y1="96" x2="960" y2="520" stroke="#ffffff" stroke-opacity="0.92" stroke-width="1.25"/>
  <image xlink:href="${planktonDataUrl}" href="${planktonDataUrl}" x="392" y="122" width="176" height="176" clip-path="url(#plClip)" preserveAspectRatio="xMidYMid slice"/>
  <circle cx="480" cy="210" r="90" stroke="#67e8f9" stroke-width="3.5" fill="none" opacity="0.92"/>
  <text x="480" y="348" text-anchor="middle" fill="#C6FAF5" font-family="Segoe UI, system-ui, sans-serif" font-size="36" font-weight="700" letter-spacing="0.14em">PLANKTON</text>
  <text x="480" y="392" text-anchor="middle" fill="#FFFFFF" font-family="Segoe UI, system-ui, sans-serif" font-size="17.5" font-weight="400">The Autonomous Protocol · Agent Chat on Solana</text>
  <rect x="1336" y="138" width="208" height="208" rx="20" fill="#ffffff" stroke="#ffffff" stroke-opacity="0.2" stroke-width="1"/>
  <image xlink:href="${x402DataUrl}" href="${x402DataUrl}" x="1348" y="150" width="184" height="184" preserveAspectRatio="xMidYMid meet"/>
  <text x="1440" y="410" text-anchor="middle" font-family="Segoe UI, system-ui, sans-serif" font-size="44" font-weight="700">
    <tspan fill="#ffffff">x402</tspan><tspan fill="#38bdf8">scan</tspan>
  </text>
  <text x="1440" y="452" text-anchor="middle" fill="#cbd5e1" font-family="Segoe UI, system-ui, sans-serif" font-size="18" font-weight="400">Listed · HTTP 402 discovery</text>
  <text x="960" y="582" text-anchor="middle" fill="#ffffff" fill-opacity="0.72" font-family="Segoe UI, system-ui, sans-serif" font-size="20" font-weight="400"><tspan fill-opacity="0.55">Explore the ecosystem at </tspan><tspan font-weight="600" fill="#7dd3fc">x402scan.com</tspan></text>
</svg>`;
}

async function main() {
  const [plankBuf, x402Buf] = await Promise.all([readFile(PLANKTON_PNG), readFile(X402SCAN_PNG)]);
  const svg = buildSvg(toDataUrl(plankBuf), toDataUrl(x402Buf));
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(OUT_SVG, svg, "utf8");
  console.log("Wrote", OUT_SVG);

  try {
    const { Resvg } = await import("@resvg/resvg-js");
    const resvg = new Resvg(svg, {
      background: "#020203",
      fitTo: { mode: "width", value: 1920 },
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
