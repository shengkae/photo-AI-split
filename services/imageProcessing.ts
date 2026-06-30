
import { Boundary } from '../types';

function isWhiteRow(y: number, thresh: number, imgData: ImageData, width: number) {
  const d = imgData.data;
  const start = y * width * 4;
  const end = start + width * 4;
  for (let i = start; i < end; i += 4) {
    if (d[i] < 255 - thresh || d[i+1] < 255 - thresh || d[i+2] < 255 - thresh) return false;
  }
  return true;
}

function isWhiteCol(x: number, thresh: number, imgData: ImageData, width: number, height: number) {
  const d = imgData.data;
  for (let y = 0; y < height; y++) {
    const idx = (y * width + x) * 4;
    if (d[idx] < 255 - thresh || d[idx+1] < 255 - thresh || d[idx+2] < 255 - thresh) return false;
  }
  return true;
}

function getSegments(dir: 'h' | 'v', thresh: number, imgData: ImageData, width: number, height: number) {
  const len = dir === 'h' ? height : width;
  const isWhite = dir === 'h'
    ? (i: number) => isWhiteRow(i, thresh, imgData, width)
    : (i: number) => isWhiteCol(i, thresh, imgData, width, height);

  const segments: [number, number][] = [];
  let inContent = false, segStart = 0;

  for (let i = 0; i < len; i++) {
    const white = isWhite(i);
    if (!white && !inContent) { inContent = true; segStart = i; }
    if (white && inContent)  { inContent = false; segments.push([segStart, i - 1]); }
  }
  if (inContent) segments.push([segStart, len - 1]);
  return segments;
}

export async function findPhotoBoundaries(imageBase64: string, mimeType: string): Promise<Boundary[]> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return reject(new Error('Canvas context not available'));
      
      ctx.drawImage(img, 0, 0);
      const imgData = ctx.getImageData(0, 0, img.width, img.height);

      const thresh = 20; // threshold for white detection (0-100)
      const hSegs = getSegments('h', thresh, imgData, img.width, img.height);
      const vSegs = getSegments('v', thresh, imgData, img.width, img.height);

      const boundaries: Boundary[] = [];
      let idx = 0;
      
      for (let r = 0; r < hSegs.length; r++) {
        const [y0, y1] = hSegs[r];
        const h = y1 - y0 + 1;
        for (let c = 0; c < vSegs.length; c++) {
          const [x0, x1] = vSegs[c];
          const w = x1 - x0 + 1;
          if (w < 4 || h < 4) continue;
          
          boundaries.push({
            id: `boundary-${Date.now()}-${idx++}`,
            centerX: ((x0 + x1) / 2 / img.width) * 100,
            centerY: ((y0 + y1) / 2 / img.height) * 100,
            width: (w / img.width) * 100,
            height: (h / img.height) * 100,
            rotation: 0
          });
        }
      }
      resolve(boundaries);
    };
    img.onerror = () => reject(new Error('Failed to load image for detection'));
    img.src = `data:${mimeType};base64,${imageBase64}`;
  });
}

export async function restorePhoto(imageBase64: string, mimeType: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Canvas context not available'));
      
      // Basic local restore using filters (contrast, brightness, saturation)
      ctx.filter = 'contrast(1.1) brightness(1.05) saturate(1.2)';
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL(mimeType || 'image/png'));
    };
    img.onerror = () => reject(new Error('Failed to load image for restoration'));
    img.src = `data:${mimeType};base64,${imageBase64}`;
  });
}
