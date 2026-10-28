import { graphemes } from '@wbr/i18n';
import type { ShareImageRequest } from '@wbr/runtime';

export type PreparedShareImage = ShareImageRequest & { file: File };

/** Fit the whole scene, including tall objects, inside the picture area. */
export function containImage(width: number, height: number, boxWidth: number, boxHeight: number) {
  const scale = Math.min(boxWidth / width, boxHeight / height);
  const fittedWidth = width * scale, fittedHeight = height * scale;
  return { x: (boxWidth - fittedWidth) / 2, y: (boxHeight - fittedHeight) / 2, width: fittedWidth, height: fittedHeight };
}

export function prepareShareImage(dataUrl: string, sceneId: string, title: string): PreparedShareImage {
  const bytes = Uint8Array.from(atob(dataUrl.split(',')[1]), character => character.charCodeAt(0));
  const fileName = `ritual-${sceneId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80) || 'scene'}.png`;
  return { dataUrl, fileName, title, file: new File([bytes], fileName, { type: 'image/png' }) };
}

/** Call on the share click itself, after the preview has already prepared the file. */
export async function shareImageInBrowser(image: PreparedShareImage): Promise<'shared' | 'cancelled' | 'unsupported'> {
  if (typeof navigator.share !== 'function' || typeof navigator.canShare !== 'function' || !navigator.canShare({ files: [image.file] }))
    return 'unsupported';
  try {
    await navigator.share({ files: [image.file], title: image.title });
    return 'shared';
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError') return 'cancelled';
    throw error;
  }
}

function loadSnapshot(snapshot: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const timer = window.setTimeout(() => { image.src = ''; reject(new Error('Image decode timed out')); }, 10000);
    image.onload = () => { clearTimeout(timer); resolve(image); };
    image.onerror = () => { clearTimeout(timer); reject(new Error('Image decode failed')); };
    image.src = snapshot;
  });
}

function drawTitle(context: CanvasRenderingContext2D, title: string) {
  const characters = graphemes(title.trim());
  let lines: string[] = [];
  let size = 54;
  for (; size >= 28; size -= 2) {
    context.font = `600 ${size}px system-ui, sans-serif`;
    lines = [];
    let line = '';
    for (const character of characters) {
      if (line && context.measureText(line + character).width > 900) { lines.push(line); line = ''; }
      line += character;
    }
    if (line) lines.push(line);
    if (lines.length <= 3) break;
  }
  if (lines.length > 3) {
    lines = lines.slice(0, 3);
    while (context.measureText(lines[2] + '…').width > 900) lines[2] = lines[2].slice(0, -1);
    lines[2] += '…';
  }
  lines.forEach((line, index) => context.fillText(line, 90, 1140 + index * 52));
}

/** Compose from pixels only; DOM controls and wish fields never enter the card. */
export async function createRitualShareCard({ snapshot, sceneId, title, brand, completed }: {
  snapshot: string; sceneId: string; title: string; brand: string; completed: string;
}): Promise<PreparedShareImage> {
  const image = await loadSnapshot(snapshot);
  await document.fonts?.ready;
  const canvas = document.createElement('canvas');
  canvas.width = 1080; canvas.height = 1350;
  const context = canvas.getContext('2d');
  if (!context || !image.naturalWidth || !image.naturalHeight) throw new Error('Image canvas unavailable');
  context.fillStyle = '#cdf1e6'; context.fillRect(0, 0, 1080, 1350);
  context.fillStyle = '#b3e7d9';
  for (let y = 28; y < 1350; y += 56) for (let x = 28; x < 1080; x += 56) {
    context.beginPath(); context.arc(x, y, 3, 0, Math.PI * 2); context.fill();
  }
  context.fillStyle = '#4a2a12';
  context.font = '600 38px system-ui, sans-serif';
  context.fillText(brand, 72, 84, 936);
  context.fillStyle = '#fffcf2'; context.fillRect(48, 126, 984, 1160);
  context.fillStyle = '#fbf3dc'; context.fillRect(66, 144, 948, 930);
  const fit = containImage(image.naturalWidth, image.naturalHeight, 948, 930);
  context.drawImage(image, 66 + fit.x, 144 + fit.y, fit.width, fit.height);
  context.fillStyle = '#4a2a12'; drawTitle(context, title);
  context.font = '28px system-ui, sans-serif'; context.fillStyle = '#6b4a2b';
  context.fillText(completed, 72, 1322, 936);
  return prepareShareImage(canvas.toDataURL('image/png'), sceneId, title);
}
