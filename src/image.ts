export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Schneidet den Bereich `area` (in Pixeln des Originalbildes) aus und gibt ihn
 * als quadratisches JPEG mit höchstens `maxSize` Pixel Kantenlänge zurück.
 */
export async function cropImage(image: Blob, area: CropArea, maxSize = 600): Promise<Blob> {
  const bitmap = await createImageBitmap(image);
  const size = Math.min(maxSize, Math.round(area.width));
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = Math.round((size * area.height) / area.width);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, area.x, area.y, area.width, area.height, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('image-failed'))), 'image/jpeg', 0.85),
  );
}
