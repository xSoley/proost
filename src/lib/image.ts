// Compression côté client : redessiner dans un canvas supprime aussi les données EXIF (dont la géolocalisation)

async function decode(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return img;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

function toJpeg(src: ImageBitmap | HTMLImageElement, max: number, quality: number): Promise<Blob> {
  const w0 = "naturalWidth" in src ? src.naturalWidth : src.width;
  const h0 = "naturalHeight" in src ? src.naturalHeight : src.height;
  const r = Math.min(1, max / Math.max(w0, h0));
  const w = Math.round(w0 * r), h = Math.round(h0 * r);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src, 0, 0, w, h);
  return new Promise((ok, ko) => canvas.toBlob(b => (b ? ok(b) : ko(new Error("toBlob"))), "image/jpeg", quality));
}

/** Photo 1600 px max (JPEG 0,8) + miniature 400 px */
export async function compressPhoto(file: Blob): Promise<{ photo: Blob; thumb: Blob }> {
  const src = await decode(file);
  const photo = await toJpeg(src, 1600, 0.8);
  const thumb = await toJpeg(src, 400, 0.75);
  if ("close" in src) src.close();
  return { photo, thumb };
}

export const thumbPath = (path: string) => path.replace(/\.jpg$/, "_thumb.jpg");
