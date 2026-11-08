import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(new URL('../apps/mobile-expo/package.json', import.meta.url));
const config = require('./metro.config.js');
const { withDomExportCompatibility } = require('../../scripts/expo-dom-export.cjs');
const cli = require.resolve('@expo/cli', { paths: [require.resolve('expo/package.json')] });
const cliSource = path.resolve(path.dirname(cli), '../src');
const { exportDomComponentAsync } = require(path.join(cliSource, 'export/exportDomComponents.js'));
const { getMetroDirectBundleOptions } = require(path.join(cliSource, 'start/server/middleware/metroOptions.js'));

function fixtureGraph(entry, transformOptions) {
  const paths = ['scene-a', 'scene-b', 'common'].map(name => path.join(root, 'artifacts', 'dom-export-fixture', `${name}.js`));
  const dependency = (absolutePath, asyncType = null, index = 0) => ({ absolutePath, data: { name: absolutePath, data: { asyncType, index, isESMImport: true } } });
  const module = (filename, dependencies) => ({
    path: filename, dependencies: new Map(dependencies.map((dep, index) => [`dep${index}`, dep])),
    getSource: () => Buffer.from('fixture'),
    output: [{ type: 'js/module', data: { code: `__d(function(global,require,importDefault,importAll,module,exports,dependencyMap){module.exports=${JSON.stringify(path.basename(filename))};});`, lineCount: 1, map: [] } }],
  });
  const modules = [module(entry, [dependency(paths[0], 'async'), dependency(paths[1], 'async', 1)]),
    module(paths[0], [dependency(paths[2])]), module(paths[1], [dependency(paths[2])]), module(paths[2], [])];
  return { dependencies: new Map(modules.map(item => [item.path, item])), transformOptions };
}

async function fixtureBundle(request, serializer = config.serializer.customSerializer) {
  const direct = getMetroDirectBundleOptions({ mainModuleName: 'node_modules/expo/dom/entry', ...request, isExporting: true, serializerOutput: 'static' });
  const entry = require.resolve('expo/dom/entry.js');
  const graph = fixtureGraph(entry, direct);
  const ids = new Map();
  return serializer(entry, [], graph, {
    ...direct, projectRoot: config.projectRoot, serverRoot: root,
    runBeforeMainModule: [], runModule: true, processModuleFilter: () => true,
    getRunModuleStatement: id => `__r(${id});`,
    createModuleId(filename) { if (!ids.has(filename)) ids.set(filename, ids.size); return ids.get(filename); },
  });
}

test('native DOM MD5 export produces HTML whose script dependencies all exist', async () => {
  const files = new Map();
  const { bundle, htmlOutputName } = await exportDomComponentAsync({
    filePath: path.join(root, 'apps/mobile-expo/BlessingDom.tsx'), projectRoot: config.projectRoot,
    dev: false, isHermes: false, includeSourceMaps: false, exp: {}, files, useMd5Filename: true,
    devServer: { legacySinglePageExportBundleAsync: fixtureBundle },
  });
  const html = files.get(htmlOutputName).contents;
  const scripts = [...html.matchAll(/<script[^>]+src="\.\/([^"]+)"/g)].map(match => match[1]);
  assert.equal(bundle.artifacts.filter(asset => asset.type === 'js').length, 1);
  assert.equal(scripts.length, 1);
  assert.match(scripts[0], /^[a-f0-9]{32}\.js$/);
  assert.ok(files.has(path.join('/www.bundle', scripts[0])));
  const source = bundle.artifacts.find(asset => asset.type === 'js').source;
  for (const name of ['scene-a.js', 'scene-b.js', 'common.js']) assert.ok(source.includes(name), `${name} stays offline in the DOM entry`);
});

test('ordinary web exports retain their async chunks', async () => {
  const bundle = await fixtureBundle({ platform: 'web', mode: 'production', splitChunks: true });
  assert.ok(bundle.artifacts.filter(asset => asset.type === 'js').length > 1);
});

test('development, native and non-MD5 DOM requests keep their original serializer options', () => {
  const serializer = Object.assign((_entry, _pre, _graph, options) => options, { __originalSerializer: null });
  const compatible = withDomExportCompatibility(serializer);
  const options = { serializerOptions: { output: 'static', exporting: true, splitChunks: true } };
  for (const transformOptions of [
    { platform: 'web', dev: true, customTransformOptions: { dom: './App', useMd5Filename: true } },
    { platform: 'ios', dev: false, customTransformOptions: { dom: './App', useMd5Filename: true } },
    { platform: 'web', dev: false, customTransformOptions: { dom: './App', useMd5Filename: false } },
    { platform: 'web', dev: false, customTransformOptions: { useMd5Filename: true } },
  ]) assert.equal(compatible('entry', [], { transformOptions }, options), options);
  assert.equal(compatible.__originalSerializer, null);
});
