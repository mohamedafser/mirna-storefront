// Renders the PWA / favicon PNGs from public/icons/icon.svg.
// Run after replacing the placeholder mark: npm run icons
import { readFile } from "node:fs/promises";
import sharp from "sharp";

const source = await readFile(new URL("../public/icons/icon.svg", import.meta.url));
const out = (name) => new URL(`../public/icons/${name}`, import.meta.url).pathname;
const BRAND = "#1c1b1b";

// "any" icons and the Apple touch icon: the rounded mark as drawn.
for (const [name, size] of [
  ["icon-192.png", 192],
  ["icon-512.png", 512],
  ["favicon-32.png", 32],
]) {
  await sharp(source, { density: 384 }).resize(size, size).png().toFile(out(name));
}

// Apple and maskable icons are cropped by the OS: full-bleed brand colour
// with the mark inside the 80% safe zone.
for (const [name, size, inner] of [
  ["apple-touch-icon.png", 180, 0.78],
  ["icon-maskable-512.png", 512, 0.7],
]) {
  const mark = await sharp(source, { density: 384 })
    .resize(Math.round(size * inner), Math.round(size * inner))
    .png()
    .toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: BRAND } })
    .composite([{ input: mark, gravity: "center" }])
    .png()
    .toFile(out(name));
}

console.log("Icons written to public/icons/");
