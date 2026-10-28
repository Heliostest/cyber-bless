import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { ShareImageRequest } from '@wbr/runtime';

const PREFIX = 'data:image/png;base64,';
const MAX_BYTES = 12 * 1024 * 1024;
const RETAIN_MS = 48 * 60 * 60 * 1000;
let sequence = 0;

/** Keeps completed images briefly: recipient apps may read after the sheet closes. */
export async function shareImage(image: ShareImageRequest): Promise<void> {
  if (!image || typeof image.dataUrl !== 'string' ||
      !image.dataUrl.startsWith(PREFIX) ||
      image.dataUrl.length > PREFIX.length + Math.ceil(MAX_BYTES / 3) * 4 ||
      typeof image.fileName !== 'string' || image.fileName.length > 96 ||
      !/^[A-Za-z0-9][A-Za-z0-9._-]*\.png$/i.test(image.fileName) ||
      typeof image.title !== 'string') {
    throw Error('Invalid share image');
  }
  const base64 = image.dataUrl.slice(PREFIX.length);
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  if (!base64.startsWith('iVBORw0KGgo') || base64.length % 4 !== 0 ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(base64) ||
      base64.length / 4 * 3 - padding > MAX_BYTES) {
    throw Error('Invalid share PNG');
  }
  if (!await Sharing.isAvailableAsync()) throw Error('Image sharing is unavailable');

  const directory = new Directory(Paths.cache, 'wbr-shared-images-v1');
  directory.create({ intermediates: true, idempotent: true });
  // This directory contains only disposable exports owned by this feature.
  try {
    for (const entry of directory.list()) {
      try {
        if (entry instanceof File && entry.lastModified !== null &&
            entry.lastModified < Date.now() - RETAIN_MS) entry.delete();
      } catch { /* An inaccessible old export must not prevent a new share. */ }
    }
  } catch { /* Cache cleanup can retry with the next share. */ }

  const file = new File(directory, `${Date.now()}-${++sequence}-${image.fileName}`);
  try {
    file.create();
    file.write(base64, { encoding: 'base64' });
  } catch (error) {
    try { if (file.exists) file.delete(); } catch { /* Preserve the original write error. */ }
    throw error;
  }
  await Sharing.shareAsync(file.uri, {
    mimeType: 'image/png',
    UTI: 'public.png',
    dialogTitle: image.title.slice(0, 200),
  });
}
