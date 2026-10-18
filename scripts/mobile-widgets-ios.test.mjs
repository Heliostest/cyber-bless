import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import vm from 'node:vm';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { APP_HIDDEN_SCENE_IDS } from '../packages/core/src/daily-scenes.ts';
const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(import.meta.url);
const { transformSync } = require('@babel/core');
function compile(relative) {
  const filename = path.join(root, relative);
  return transformSync(readFileSync(filename, 'utf8'), { filename, babelrc: false, configFile: false,
    presets: [require.resolve('babel-preset-expo')], caller: { name: 'metro', platform: 'ios', isDev: false, isServer: false, bundler: 'metro', supportsStaticESM: false } }).code;
}
const component = compile('apps/mobile-expo/widgets/TodayWidget.tsx');
const module = { exports: {} };
vm.runInNewContext(component, { module, exports: module.exports, require: () => ({}) });
const serialized = module.exports.TodayWidget;
function render(props, family) {
  const globals = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
  for (const name of ['HStack', 'VStack', 'ZStack', 'Rectangle', 'Link', 'Spacer', 'Text', 'Image']) globals[name] = name;
  for (const name of ['accessibilityElement', 'accessibilityLabel', 'background', 'containerBackground', 'font', 'foregroundStyle', 'frame', 'lineLimit', 'minimumScaleFactor', 'widgetURL', 'aspectRatio', 'clipped', 'cornerRadius', 'fixedSize', 'padding', 'resizable', 'widgetAccentedRenderingMode']) globals[name] = (...args) => ({ type: name, args });
  globals._jsx = globals.jsx;
  globals._jsxs = globals.jsxs;
  const fn = vm.runInNewContext(`(${serialized})`, globals);
  return fn(props, { widgetFamily: family, colorScheme: 'light' });
}
test('the actual Expo Babel preset serializes a self-contained isolated widget function', () => {
  assert.equal(typeof serialized, 'string');
  const props = { day: '2026-10-11', title: '折一只纸鹤', sceneId: 'crane', subtitle: '为今天，留一点温柔', deepLink: 'cyber-bless://widget/today?v=1&day=2026-10-11&scene=crane', previewSmall: 'file:///group/crane-small.png', previewMedium: 'file:///group/crane-medium.png', previewLarge: 'file:///group/crane-large.png' };
  for (const [family, cover] of [['systemSmall', props.previewSmall], ['systemMedium', props.previewMedium], ['systemLarge', props.previewLarge]]) {
    const tree = render(props, family);
    const json = JSON.stringify(tree);
    assert.ok(json.includes(props.title));
    assert.ok(json.includes(props.day));
    assert.ok(json.includes(props.deepLink));
    assert.equal(tree.props.modifiers.filter(m => m.type === 'widgetURL').length, 1);
    assert.ok(json.includes(cover), `${family} must use its own cover`);
    assert.ok(!json.includes('进入仪式'), 'the scene itself is the only tap target');
    const visit = node => !node || typeof node !== 'object' ? [] : [node, ...Object.values(node).flatMap(value => Array.isArray(value) ? value.flatMap(visit) : visit(value))];
    const links = visit(tree).filter(node => node.type === 'Link');
    assert.equal(links.length, 0);
    assert.equal(tree.props.modifiers.find(m => m.type === 'widgetURL').args[0], props.deepLink);
  }
  const legacy = JSON.stringify(render({ ...props, previewLarge: undefined }, 'systemLarge'));
  assert.ok(legacy.includes(props.previewSmall), 'older timelines keep the square cover until the next refresh');
  assert.ok(!legacy.includes(props.previewMedium));
  const fallback = JSON.stringify(render(undefined, 'systemSmall'));
  assert.ok(fallback.includes('今日仪式'));
  assert.ok(fallback.includes('cyber-bless://widget/today?v=1'));
});

test('retired App scenes cannot reappear from an old persisted iOS timeline', () => {
  for (const id of APP_HIDDEN_SCENE_IDS) {
  const stale = { day: '2026-10-19', sceneId: id, title: '已移出的场景', deepLink: `cyber-bless://widget/today?v=1&day=2026-10-19&scene=${id}`, previewSmall: 'file:///group/hidden-small.png', previewMedium: 'file:///group/hidden-medium.png', previewLarge: 'file:///group/hidden-large.png' };
  for (const family of ['systemSmall', 'systemMedium', 'systemLarge']) {
    for (const props of [stale, { ...stale, sceneId: undefined }]) {
      const tree = render(props, family), json = JSON.stringify(tree);
      assert.ok(!json.includes(stale.title));
      assert.ok(!json.includes('hidden-'));
      assert.ok(!json.includes(id));
      assert.ok(json.includes('今日仪式'));
      assert.equal(tree.props.modifiers.find(m => m.type === 'widgetURL').args[0], 'cyber-bless://widget/today?v=1');
    }
  }
  }
});
test('the iOS publisher does not load unavailable widget or UI modules in Expo Go', async () => {
  const compiled = compile('apps/mobile-expo/widget-sync.ts');
  const loaded = [], instance = { exports: {} };
  const mock = name => {
    loaded.push(name);
    if (name.startsWith('@babel/runtime/')) return require(name);
    if (name === 'react-native') return { Platform: { OS: 'ios' } };
    if (name === 'expo') return { requireOptionalNativeModule: () => null };
    if (name === '@wbr/content') return { createSHA256: () => ({ update: () => ({ digest: () => new Uint8Array(32) }) }) };
    if (name === '@wbr/core/widgets') return { createWidgetSnapshot: () => ({ catalogRevision: 'bundled-daily-v1', timeZone: 'Asia/Shanghai', validThroughDay: '2026-10-17', days: [] }) };
    throw Error(`Unexpected native load: ${name}`);
  };
  vm.runInNewContext(compiled, { module: instance, exports: instance.exports, require: mock });
  await instance.exports.synchronizeWidgets(null);
  assert.ok(!loaded.includes('expo-widgets'));
  assert.ok(!loaded.includes('./widgets/TodayWidget'));
});
test('an unavailable save registers the iOS layout and publishes a generic timeline', async () => {
  const compiled = compile('apps/mobile-expo/widget-sync.ts');
  const registered = [], timelines = [], instance = { exports: {} };
  let release;
  const imagesReady = new Promise(resolve => { release = resolve; });
  const mock = name => {
    if (name.startsWith('@babel/runtime/')) return require(name);
    if (name === 'react-native') return { Platform: { OS: 'ios' } };
    if (name === 'expo') return { requireOptionalNativeModule: () => ({ Widget: {} }) };
    if (name === '@wbr/content') return { createSHA256: () => ({ update: () => ({ digest: () => new Uint8Array(32) }) }) };
    if (name === '@wbr/core/widgets') return {
      createWidgetSnapshot: raw => { assert.equal(raw, undefined); return { catalogRevision: 'bundled-daily-v1', timeZone: 'Asia/Shanghai', validThroughDay: '2026-10-11', days: [] }; },
      widgetTimeline: snapshot => { assert.deepEqual(snapshot.days, []); return [{ props: { title: '今日仪式', deepLink: 'cyber-bless://widget/today?v=1' } }]; },
    };
    if (name === 'expo-widgets') return { widgetsDirectory: 'file:///group/ExpoWidgets', createWidget: (kind, layout) => { registered.push([kind, layout]); return { updateTimeline: timeline => timelines.push(timeline) }; } };
    if (name === './widget-images') return { prepareWidgetImages: async group => {
      assert.equal(group, 'file:///group/ExpoWidgets'); await imagesReady;
      return { generic: { small: 'file:///group/generic-small.png', medium: 'file:///group/generic-medium.png', large: 'file:///group/generic-large.png' } };
    } };
    if (name === './widgets/TodayWidget') return { TodayWidget: serialized };
    throw Error(`Unexpected native load: ${name}`);
  };
  vm.runInNewContext(compiled, { module: instance, exports: instance.exports, require: mock });
  const publishing = instance.exports.synchronizeWidgets(undefined);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(timelines.length, 0, 'never publish before the shared images exist');
  release();
  await publishing;
  assert.deepEqual(registered, [['BlessingToday', serialized]]);
  assert.equal(timelines[0][0].props.deepLink, 'cyber-bless://widget/today?v=1');
  assert.equal(timelines[0][0].props.previewSmall, 'file:///group/generic-small.png');
  assert.equal(timelines[0][0].props.previewLarge, 'file:///group/generic-large.png');
});
test('the official source generator preserves all three families and dedicated App Group across regeneration', async () => {
  const pluginRoot = path.dirname(require.resolve('expo-widgets/package.json'));
  const withSource = require(path.join(pluginRoot, 'plugin/build/ios/withWidgetSourceFiles.js')).default;
  mkdirSync(path.join(root, 'artifacts'), { recursive: true });
  const output = mkdtempSync(path.join(root, 'artifacts/widget-ios-sources-'));
  const config = JSON.parse(readFileSync(path.join(root, 'apps/mobile-expo/app.json'), 'utf8')).expo;
  const settings = config.plugins.find(p => Array.isArray(p) && p[0] === 'expo-widgets')[1];
  const withVisibility = require('../apps/mobile-expo/plugins/withWidgetSceneVisibility.cjs');
  assert.ok(config.plugins.indexOf('./plugins/withWidgetSceneVisibility.cjs') < config.plugins.findIndex(p => Array.isArray(p) && p[0] === 'expo-widgets'));
  const generated = withSource(withVisibility(config), { ...settings, targetName: 'ExpoWidgetsTarget', onFilesGenerated: () => {} });
  const run = () => generated.mods.ios.dangerous({ ...generated, modResults: {}, modRequest: { platform: 'ios', modName: 'dangerous', platformProjectRoot: output, projectRoot: path.join(root, 'apps/mobile-expo'), introspect: false } });
  await run();
  const target = path.join(output, 'ExpoWidgetsTarget');
  const first = readFileSync(path.join(target, 'BlessingToday.swift'), 'utf8');
  await run();
  assert.equal(readFileSync(path.join(target, 'BlessingToday.swift'), 'utf8'), first);
  assert.ok(first.includes('systemSmall') && first.includes('systemMedium'));
  assert.ok(first.includes('systemLarge'));
  assert.ok(first.includes(`let hiddenScenes: Set<String> = [${APP_HIDDEN_SCENE_IDS.map(id => JSON.stringify(id)).join(', ')}]`));
  assert.ok(first.includes('hiddenScenes.contains(sceneId) || hiddenScenes.contains(linkedId)'));
  assert.ok(first.includes('URLComponents(string: deepLink)'));
  assert.ok(first.includes('} else {\n        WidgetsEntryView(entry: entry)'));
  assert.ok(first.includes('Text("今日仪式")'));
  assert.equal((first.match(/App scene curation/g) || []).length, 1);
  assert.ok(readFileSync(path.join(target, 'ExpoWidgetsTarget.entitlements'), 'utf8').includes(settings.groupIdentifier));
});
