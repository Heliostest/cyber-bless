import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
const require = createRequire(import.meta.url);
const { adaptWidgetSource } = require('../apps/mobile-expo/plugins/withWidgetSceneVisibility.cjs');

test('SDK57 adapter injects language on every extension redraw, including the gallery', () => {
  const template = `import SwiftUI\ninternal import ExpoWidgets\nStaticConfiguration(kind: name, provider: WidgetsTimelineProvider(name: name)) { entry in\n      WidgetsEntryView(entry: entry)\n    }\n    .configurationDisplayName("今日仪式")\n    .description("为今天留一点温柔")`;
  const adapted = adaptWidgetSource(template);
  assert.match(adapted, /BlessingLocalizedEntryView\(entry: entry\)/);
  assert.match(adapted, /Locale\.preferredLanguages/);
  assert.match(adapted, /props\["resolvedLocale"\]/);
  assert.match(adapted, /evaluateLayout\(layout: layout, props: props/);
  assert.match(adapted, /Text\(verbatim: BlessingWidgetCopy/);
  assert.match(adapted, /localePreference/);
  assert.equal(adaptWidgetSource(adapted), adapted);
});

test('unsupported upstream source fails explicitly instead of silently losing localization', () => {
  assert.throws(() => adaptWidgetSource('struct ChangedTemplate {}'), /Unsupported Expo Widgets SDK57 template/);
});
