import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { builtInScenes, WISH_SCENE_IDS } from '../packages/core/src/daily-scenes.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const directory = path.join(root, 'assets/widgets/today');
test('every bundled scene has matching real-rendered covers for all three native sizes', async () => {
  const manifest = JSON.parse(await readFile(path.join(directory, 'manifest.json'), 'utf8'));
  assert.equal(manifest.renderer, 'project-threejs-scenes');
  assert.deepEqual(manifest.scenes.map(s => s.id).sort(), builtInScenes.map(s => s.id).sort());
  const nativeCatalog = JSON.parse(await readFile(path.join(root,
    'apps/mobile-expo/modules/blessing-widgets/android/src/test/resources/widget-catalog.json'), 'utf8'));
  assert.deepEqual(nativeCatalog, builtInScenes.map(scene => ({
    id: scene.id, title: scene.title, category: WISH_SCENE_IDS.includes(scene.id) ? 'wish' : 'blessing',
  })));
  for (const scene of manifest.scenes) {
    assert.equal(scene.engine, builtInScenes.find(s => s.id === scene.id).engine);
    for (const [size, width, height] of [['small', 600, 600], ['medium', 1280, 600], ['large', 1200, 1200]]) {
      const item = scene[size];
      const bytes = await readFile(path.join(directory, item.file));
      assert.equal(bytes.subarray(1, 4).toString(), 'PNG');
      assert.equal(bytes.readUInt32BE(16), width);
      assert.equal(bytes.readUInt32BE(20), height);
      assert.equal(createHash('sha256').update(bytes).digest('hex'), item.sha256);
      const native = await readFile(path.join(root, 'apps/mobile-expo/modules/blessing-widgets/android/src/main/res/drawable-nodpi', `blessing_preview_${scene.id.replaceAll('-', '_')}_${size}.png`));
      assert.ok(native.equals(bytes), `${scene.id}/${size} differs between platforms`);
      assert.ok(item.webgl === true, 'capture must confirm a real WebGL render');
    }
  }
  for (const size of ['small', 'medium', 'large']) {
    const generic = await readFile(path.join(directory, `generic-${size}.png`));
    assert.ok(generic.equals(await readFile(path.join(directory, `woodfish-${size}.png`))));
    const native = await readFile(path.join(root,
      'apps/mobile-expo/modules/blessing-widgets/android/src/main/res/drawable-nodpi', `blessing_preview_generic_${size}.png`));
    assert.ok(generic.equals(native), `generic/${size} differs between platforms`);
  }
});
