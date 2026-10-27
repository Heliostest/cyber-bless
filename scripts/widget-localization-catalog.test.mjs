import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { builtInScenes } from '../packages/core/src/daily-scenes.ts';
import { locales, widgetLocalizationOutputs } from './generate-widget-localization.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));

test('release widget catalogs include all bundled titles in all eight languages and generated outputs have no drift', () => {
  const copy = JSON.parse(readFileSync(path.join(root, 'apps/mobile-expo/widget-copy.generated.json'), 'utf8'));
  for (const locale of locales) {
    assert.deepEqual(Object.keys(copy.titles[locale]).sort(), builtInScenes.map(scene => scene.id).sort());
    assert.deepEqual(Object.keys(copy.native[locale]).sort(), Object.keys(copy.native['zh-Hans']).sort());
    for (const title of Object.values(copy.titles[locale])) assert.ok(typeof title === 'string' && title.trim());
    assert.deepEqual([...copy.native[locale]['native.widget.accessibility'].matchAll(/\{([^}]+)\}/g)].map(match => match[1]).sort(), ['date', 'title']);
  }
  for (const [relative, expected] of widgetLocalizationOutputs()) {
    assert.equal(readFileSync(path.join(root, relative), 'utf8'), expected, relative);
  }
});
