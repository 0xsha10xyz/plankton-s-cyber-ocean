import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const svgPath = path.join(root, "assets", "banners", "plankton-x-header-dark-clean.svg");
const outPath = path.join(root, "assets", "banners", "plankton-x-header-dark-clean.png");
const logoPath = path.join(root, "assets", "banners", "plankton-token-logo.png");

const svg = readFileSync(svgPath);

const base = sharp(svg, { density: 192 })
  .resize(1500, 500, { fit: "fill" })
  .png({ compressionLevel: 9 });

// Force-embed the PAP mark so exports always include it.
// Matches banner SVG: translate(1060 392) scale(1.35) with 44x44 image.
const papLeft = 1060;
const papTop = 392;
const papSize = Math.round(44 * 1.35); // ~59px

const logoBuf = await sharp(logoPath)
  .resize(papSize, papSize, { fit: "cover" })
  .png()
  .toBuffer();

const ringSvg = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${papSize}" height="${papSize}" viewBox="0 0 ${papSize} ${papSize}">
     <circle cx="${papSize / 2}" cy="${papSize / 2}" r="${papSize / 2 - 2.5}" fill="none" stroke="rgba(100,255,230,0.9)" stroke-width="3"/>
     <circle cx="${papSize / 2}" cy="${papSize / 2}" r="${papSize / 2 - 1}" fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="1"/>
   </svg>`
);

const png = await base
  .composite([
    { input: logoBuf, left: papLeft, top: papTop },
    { input: ringSvg, left: papLeft, top: papTop },
  ])
  .toBuffer();

writeFileSync(outPath, png);
console.log(`wrote ${outPath} (${png.length} bytes)`);

