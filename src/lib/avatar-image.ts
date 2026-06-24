/**
 * Client-only helper that turns a chosen image file into a small, square
 * avatar data-URL. Runs entirely in the browser (canvas) — never import this
 * from server code. The result is center-cropped to a square and scaled down
 * to AVATAR_PX, then exported as WebP (falls back to JPEG), keeping the stored
 * payload tiny (a few KB) so it fits comfortably inline in the database.
 */
export const AVATAR_PX = 160;

export async function fileToAvatarDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Il file selezionato non è un'immagine");
  }

  const img = await loadImage(file);
  const canvas = document.createElement("canvas");
  canvas.width = AVATAR_PX;
  canvas.height = AVATAR_PX;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Elaborazione immagine non disponibile");

  // Center-crop the source to a square, then scale it into the canvas.
  const side = Math.min(img.naturalWidth, img.naturalHeight);
  const sx = (img.naturalWidth - side) / 2;
  const sy = (img.naturalHeight - side) / 2;
  ctx.drawImage(img, sx, sy, side, side, 0, 0, AVATAR_PX, AVATAR_PX);

  // WebP is the smallest; browsers without WebP encoding return a PNG, in
  // which case we fall back to JPEG to keep the payload down.
  const webp = canvas.toDataURL("image/webp", 0.82);
  if (webp.startsWith("data:image/webp")) return webp;
  return canvas.toDataURL("image/jpeg", 0.85);
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Impossibile leggere l'immagine"));
    };
    img.src = url;
  });
}
