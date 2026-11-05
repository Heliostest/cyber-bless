import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { chromium } from 'playwright';

// Offline conversion of the pinned MIT generator's CPU path. No renderer,
// package download, user images, music or sound from upstream is required.
const root = fileURLToPath(new URL('../', import.meta.url));
const directory = path.join(root, 'assets/environments/trees/simple-tree');
const manifestPath = path.join(directory, 'source-manifest.json');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const check = process.argv.includes('--check');
const preview = process.argv.includes('--preview');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const source = {};
for (const record of manifest.sources) {
  const bytes = await readFile(path.join(directory, 'source', record.file));
  const gitBlob = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
  if (sha256(bytes) !== record.sha256 || gitBlob !== record.gitBlob) throw Error(`Upstream source changed: ${record.file}`);
  source[record.file] = bytes.toString('utf8');
}
const extensions = {};
for (const record of manifest.productExtensions ?? []) {
  const bytes = await readFile(path.join(directory, record.file));
  if (sha256(bytes) !== record.sha256) throw Error(`Product extension changed: ${record.file}`);
  extensions[record.module] = bytes.toString('utf8');
}
const licensePath = path.join(directory, 'LICENSE.txt');
if (check) {
  if (await readFile(licensePath, 'utf8') !== source.LICENSE) throw Error('Packaged MIT license differs from upstream');
} else await writeFile(licensePath, source.LICENSE);

// Anchors refer to the preserved originals. Fail if a future upstream update
// changes these boundaries instead of silently switching generation paths.
function between(text, start, end) {
  const a = text.indexOf(start), b = text.indexOf(end, a + start.length);
  if (a < 0 || b < 0) throw Error(`Missing adaptation boundary: ${start}`);
  return text.slice(a, b);
}
function replaceRange(text, start, end, replacement) {
  const original = between(text, start, end);
  return text.replace(original, replacement);
}
const wind = `
${between(source['wind.js'], 'export function liftBelow', '// How hard it blows')}
${between(source['wind.js'], 'const PACK =', 'export function unpackSwing')}
`;
const growth = `
${between(source['regenerate.js'], 'const LEAF_SPREAD', 'const BLOW_SECONDS')}
${between(source['regenerate.js'], 'export const leafStart', '// A leaf card\'s size:')}
`;
const core = `import * as THREE from 'three';
export const uniform = value => ({ value });
export const linear = (r, g, b) => uniform(new THREE.Color().setRGB(r, g, b));
export const sunDirection = uniform(new THREE.Vector3(...${JSON.stringify(manifest.bakedSunDirection)}));
export const BARK_STOPS = ${JSON.stringify(manifest.barkStops)};
`;
let foliage = `import * as THREE from 'three';
import { GOLDEN_ANGLE, mulberry32, SIDE, UP } from './wood.js';
import { uniform, linear, sunDirection } from './core.js';
import { liftBelow, packSwing } from './wind.js';
import { leafStart } from './growth.js';
import { cherryBlossomCluster } from './cherry-blossoms.js';
${source['foliage.js'].slice(source['foliage.js'].indexOf('// Anime foliage'))}`;
if (!foliage.includes('const LEAVES = {')) throw Error('Missing upstream texture registration boundary');
foliage = foliage.replace('const LEAVES = {', "const LEAVES = {\n  'product cherry blossoms': cherryBlossomCluster,");
foliage = replaceRange(foliage, '  // As drawn: a new theme', "  // What a tree's clumps need", `
  // CPU export only: replace TSL materials and preview meshes with their
  // data holders. The original update/bake functions below are unchanged.
  let segments = 2;
  const cut = () => segments;
  const cards = {};
  for (const n of [1, 2, 3, 4]) cards[n] = new THREE.PlaneGeometry(1, 1, n, n);
  const mesh = { count: 0 };
  const leaves = { value: null }, ownColors = { value: null };
  const clumpView = { update() {} };
  const showIfAny = () => {};
`);
foliage = replaceRange(foliage, '  // The clumps themselves, hidden, but handy to see', '// The leaf clumps the cards are scattered over', `
  return { uniforms, update, bake, setLeafTexture, setSegments: value => { segments = value; } };
}

`);
let glb = `import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { LEAF_STOPS } from './foliage.js';
import { BARK_STOPS } from './core.js';
import { encodeTexture, textureWriter } from './textures.js';
${source['glb.js'].slice(source['glb.js'].indexOf('// The tree as a GLB'))}`;
const download = "  download(new Blob([glb], { type: 'model/gltf-binary' }), name ?? `${species}-${seed}.glb`)";
if (!glb.includes(download)) throw Error('Missing upstream export result boundary');
glb = glb.replace(download, '  return glb');
const modules = {
  'core.js': core, 'wind.js': wind, 'growth.js': growth,
  'wood.js': source['wood.js'].replace("'three/webgpu'", "'three'"),
  'oak.js': source['oak.js'].replace("'three/webgpu'", "'three'"),
  ...Object.fromEntries(['pine', 'cypress', 'willow'].map(species => [`${species}.js`, source[`${species}.js`].replace("'three/webgpu'", "'three'")])),
  'foliage.js': foliage, 'glb.js': glb, 'textures.js': source['textures.js'],
  ...extensions,
};
const html = `<!doctype html><meta charset="utf-8"><script type="importmap">${JSON.stringify({ imports: {
  three: '/three/build/three.module.js', 'three/addons/': '/three/examples/jsm/',
} })}</script>`;
// Fulfil browser requests from memory/disk. This uses no listening socket or
// network connection, including on machines that prohibit localhost access.
async function serve(route) {
  try {
    const url = new URL(route.request().url());
    if (url.pathname === '/') { await route.fulfill({ contentType: 'text/html', body: html }); return; }
    const key = url.pathname.slice(1);
    if (Object.hasOwn(modules, key)) { await route.fulfill({ contentType: 'text/javascript', body: modules[key] }); return; }
    // Only serve the installed Three package, with path traversal rejected.
    const threeRoot = path.join(root, 'node_modules/three');
    const target = path.resolve(threeRoot, url.pathname.slice('/three/'.length));
    if (!url.pathname.startsWith('/three/') || !target.startsWith(threeRoot + path.sep)) throw Error('Unknown module');
    await route.fulfill({ contentType: 'text/javascript', body: await readFile(target) });
  } catch (error) { await route.fulfill({ status: 404, body: String(error) }); }
}
let browser;
try {
  const executablePath = [
    process.env.SIMPLE_TREE_CHROMIUM, chromium.executablePath(),
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome',
  ].find(candidate => candidate && existsSync(candidate));
  if (!executablePath) throw Error('A local Chromium browser is required; set SIMPLE_TREE_CHROMIUM. No browser is downloaded.');
  browser = await chromium.launch({ executablePath, headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 900, height: 720 });
  await page.route('**/*', serve);
  page.on('pageerror', error => console.error(error));
  await page.goto('http://simple-tree.invalid/');
  const outputs = [];
  for (const model of manifest.models) {
    const generated = await page.evaluate(async ({ model, palette, preview }) => {
      const THREE = await import('three');
      const type = model.parameters.species;
      if (!['oak', 'pine', 'cypress', 'willow'].includes(type)) throw Error(`Unsupported source species: ${type}`);
      const { [type]: species } = await import(`/${type}.js`);
      const { createFoliage } = await import('/foliage.js');
      const { exportGlb } = await import('/glb.js');
      const params = { ...species.settings, ...model.parameters };
      const grown = species.grow(params);
      // Product art direction through the engine's existing ellipsoid-clump
      // API (also used by its pine pads/willow). Source branch positions stay.
      if (model.crownFlatten !== undefined) grown.clumps.forEach(clump => { clump.flatten = model.crownFlatten; });
      // Mature summer uses source branches, without extra seasonal twigs.
      // Source species place clumps on their real branches/strands/pads.
      grown.clumps.forEach((clump, i) => { clump.swing = grown.geometry.userData.swayAt(clump.position, i); });
      const leaves = createFoliage();
      leaves.setSegments(model.cardSegments);
      for (const key of ['cardSize', 'roundness', 'shadowSide', 'ao', 'variation']) leaves.uniforms[key].value = params[key];
      leaves.uniforms.colors.forEach((value, i) => { value.value.set(palette.leaves[i]); });
      leaves.setLeafTexture(params.leafTexture);
      leaves.update(grown.clumps, params);
      const baked = leaves.bake();
      const array = await exportGlb({ tree: { wood: grown.geometry, leaves: baked }, species: model.exportSpecies ?? type, seed: params.seed,
        barkColors: palette.wood.map(value => ({ value: new THREE.Color(value) })) });
      // Parse the real exported GLB again with the app's Three r170 loader.
      const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
      const loaded = await new GLTFLoader().parseAsync(array, '');
      const parts = [];
      const box = new THREE.Box3().setFromObject(loaded.scene);
      loaded.scene.traverse(mesh => {
        if (!mesh.isMesh) return;
        const attrs = mesh.geometry.attributes, count = attrs.position.count;
        for (const attr of Object.values(attrs)) if (!Array.from(attr.array).every(Number.isFinite)) throw Error('Non-finite attribute');
        for (let i = 0; i < count; i++) if (Math.abs(Math.hypot(attrs.normal.getX(i), attrs.normal.getY(i), attrs.normal.getZ(i)) - 1) > 0.00001) throw Error('Non-unit normal');
        if (!Array.from(mesh.geometry.index.array).every(i => i < count && i >= 0)) throw Error('Invalid index');
        const mat = mesh.material;
        if (mesh.name === 'leaves' && (!attrs.color || !mat.map || mat.alphaTest !== 0.5 || mat.side !== THREE.DoubleSide)) throw Error('Leaf export lost mask, normals, color or sidedness');
        if (mesh.name === 'leaves') {
          const corners = (model.cardSegments + 1) ** 2;
          for (let i = 0; i < count; i += corners) for (let v = i + 1; v < i + corners; v++) {
            if ([0, 1, 2].some(axis => attrs.normal.array[v * 3 + axis] !== attrs.normal.array[i * 3 + axis])) throw Error('Lost source cluster normals');
          }
          if (mat.map.image.width !== 512 || mat.map.image.height !== 512) throw Error('Leaf atlas dimensions changed');
        }
        parts.push({ name: mesh.name, vertices: count, triangles: mesh.geometry.index.count / 3,
          attributes: Object.keys(attrs), alphaTest: mat.alphaTest, doubleSided: mat.side === THREE.DoubleSide,
          ...(attrs.color ? { vertexColorRange: [Math.min(...attrs.color.array), Math.max(...attrs.color.array)] } : {}) });
      });
      if (parts.length !== 2) throw Error('Expected a wood mesh and a summer foliage mesh');
      const bytes = new Uint8Array(array);
      let binary = '';
      for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
      const statistics = { species: type, leafTexture: params.leafTexture, clumps: grown.clumps.length, leafCards: parts.find(p => p.name === 'leaves').vertices / ((model.cardSegments + 1) ** 2),
        vertices: parts.reduce((n, p) => n + p.vertices, 0), triangles: parts.reduce((n, p) => n + p.triangles, 0),
        bounds: { min: box.min.toArray(), max: box.max.toArray() }, shadeScale: baked.shadeScale, parts };
      if (model.adaptation) statistics.adaptation = model.adaptation;
      if (statistics.triangles > 8000 || bytes.length > 700000) throw Error(`Tree budget exceeded: ${model.key}: ${statistics.triangles} triangles, ${statistics.leafCards} cards, ${bytes.length} bytes`);
      if (preview) {
        document.body.style.margin = '0';
        document.body.replaceChildren();
        const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
        renderer.setSize(900, 720);
        renderer.setClearColor('#e9eee0');
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        const scene = new THREE.Scene();
        scene.add(loaded.scene);
        scene.add(new THREE.HemisphereLight('#ebf5ff', '#6a7451', 2));
        const sun = new THREE.DirectionalLight('#fff4dc', 3);
        sun.position.set(5, 8, 6); scene.add(sun);
        const size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
        const framing = Math.max(size.y, size.x * 0.8, size.z * 0.8) * 0.7;
        const camera = new THREE.OrthographicCamera(-framing * 1.25, framing * 1.25, framing, -framing, 0.1, 100);
        camera.position.copy(center).add(new THREE.Vector3(7, 4, 9));
        camera.lookAt(center); camera.updateProjectionMatrix();
        renderer.render(scene, camera);
        document.body.append(renderer.domElement);
      }
      return { base64: btoa(binary), statistics, threeRevision: THREE.REVISION,
        ...(preview && model.adaptation ? { atlasPreview: baked.texture.image.toDataURL('image/png').split(',')[1] } : {}) };
    }, { model, palette: model.palette ?? manifest.palette, preview });
    const bytes = Buffer.from(generated.base64, 'base64');
    const baseline = manifest.preCherryAssetBaselines?.[model.file];
    if (baseline && sha256(bytes) !== baseline) throw Error(`Existing species changed during cherry adaptation: ${model.file}`);
    const gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString('utf8'));
    if (gltf.buffers.some(buffer => buffer.uri) || gltf.images.some(image => image.uri)) throw Error('Expected a self-contained GLB');
    const outputPath = path.join(directory, model.file);
    if (check) {
      if (!(await readFile(outputPath)).equals(bytes)) throw Error(`Generated asset is stale: ${model.file}`);
    } else await writeFile(outputPath, bytes);
    if (preview) await page.screenshot({ path: path.join(directory, `${model.key}.preview.png`) });
    if (generated.atlasPreview) await writeFile(path.join(directory, `${model.key}.atlas.preview.png`), Buffer.from(generated.atlasPreview, 'base64'));
    outputs.push({ key: model.key, file: model.file, bytes: bytes.length, sha256: sha256(bytes), ...generated.statistics });
    console.log(`${check ? 'Verified' : 'Prepared'} ${model.file}: ${generated.statistics.triangles} triangles, ${generated.statistics.leafCards} leaf cards, ${bytes.length} bytes (Three r${generated.threeRevision})`);
  }
  const stats = JSON.stringify({ sourceCommit: manifest.commit, adapterVersion: 3, threeRevision: '170', models: outputs,
    validation: { sourceHashes: true, sourceGitBlobs: true, glbReload: true, finiteAttributes: true, unitNormals: true, clusterNormals: true, validIndices: true, alphaMaskedDoubleSided: true, embeddedAtlas512: true } }, null, 2) + '\n';
  const statsPath = path.join(directory, 'statistics.json');
  if (check) {
    if (await readFile(statsPath, 'utf8') !== stats) throw Error('Generated statistics are stale');
  } else await writeFile(statsPath, stats);
} finally {
  if (browser) await browser.close();
}
