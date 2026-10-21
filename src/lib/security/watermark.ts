import sharp from "sharp";

/** Attribution is composited into pixels; originals must stay outside public/. */
export async function watermarkedPreview(bytes: Buffer, label = "veloceapp.dev", width = 1920): Promise<Buffer> {
  if (!/^[a-zA-Z0-9 ._-]{1,80}$/.test(label)) throw new Error("Use a plain attribution label");
  const image = await sharp(bytes, { limitInputPixels: 40_000_000 }).timeout({ seconds: 10 }).rotate().resize({ width, withoutEnlargement: true }).toBuffer({ resolveWithObject: true });
  const w = image.info.width, h = image.info.height;
  const size = Math.max(12, Math.round(Math.min(w, h) * 0.027));
  const margin = Math.max(8, Math.round(size * 0.75));
  const stripHeight = Math.min(h, size + margin * 2);
  const overlay = Buffer.from(`<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg"><rect x="0" y="${h - stripHeight}" width="${w}" height="${stripHeight}" fill="black" fill-opacity="0.28"/><text x="${w - margin}" y="${h - margin}" text-anchor="end" font-family="sans-serif" font-size="${size}" fill="white" fill-opacity="0.85">${label}</text></svg>`);
  return sharp(image.data).timeout({ seconds: 10 }).composite([{ input: overlay }]).webp({ quality: 82 }).toBuffer();
}
