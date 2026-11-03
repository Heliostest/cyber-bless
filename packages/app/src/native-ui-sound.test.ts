import { readFileSync } from 'node:fs';
import { afterEach, expect, it, vi } from 'vitest';
import { UI_SOUND_FILES } from './ui-sound-assets';
import { readUiSound } from '../../../apps/mobile-expo/ui-sound';

const boundary = vi.hoisted(() => ({ paths: [] as string[], size: 25004 }));
vi.mock('expo-file-system', () => ({
  Paths: { bundle: 'file:///App.app' },
  File: class {
    path: string;
    constructor(...parts: string[]) { this.path = parts.join('/'); boundary.paths.push(this.path); }
    exists = true;
    get size() { return boundary.size; }
    async base64() {
      const file = this.path.replace('file:///App.app/www.bundle/', '');
      return readFileSync(new URL(`../../../assets/${file}`, import.meta.url)).toString('base64');
    }
  },
}));
afterEach(() => { boundary.paths.length = 0; boundary.size = 25004; });

it('reads the approved WAV bytes from the native offline bundle', async () => {
  for (const file of new Set(Object.values(UI_SOUND_FILES))) {
    const encoded = await readUiSound(file);
    expect(Buffer.from(encoded, 'base64')).toEqual(readFileSync(new URL(`../../../assets/${file}`, import.meta.url)));
  }
  expect(boundary.paths[0]).toBe('file:///App.app/www.bundle/ui-sounds/soft-garden-v1/navigate.wav');
});

it.each(['../../Documents/save.json', 'https://example.com/a.wav', '__proto__', '/ui-sounds/soft-garden-v1/navigate.wav'])(
  'rejects non-allowlisted native file requests: %s', async file => {
    await expect(readUiSound(file)).rejects.toThrow();
    expect(boundary.paths).toEqual([]);
  },
);

it.each([0, 100001])('rejects empty or oversized native audio before reading: %s', async size => {
  boundary.size = size;
  await expect(readUiSound(UI_SOUND_FILES.navigate)).rejects.toThrow();
});
