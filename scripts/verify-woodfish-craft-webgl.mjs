import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
const root = process.cwd().replaceAll('\\', '/'), base = process.env.WBR_URL || 'http://127.0.0.1:5186';
const phase = process.argv.includes('--baseline') ? 'before' : 'after';
const out = path.join(root, 'artifacts/material-rollout', phase, '390'); await mkdir(out, { recursive: true });
const files = ['scripts/verify-woodfish-craft-webgl.mjs', 'scripts/craft-rollout-woodfish-browser.mjs',
  'packages/app/src/woodfish-scene.ts', 'packages/app/src/woodfish-model.ts', 'packages/scene-runtime/src/craft-surfaces.ts', 'packages/scene-runtime/src/toon-surfaces.ts'];
const snapshot = () => Promise.all(files.map(async file => ({ file, sha256: createHash('sha256').update(await readFile(file)).digest('hex') })));
const sources = await snapshot();
const executable = chromium.executablePath(), fallback = executable.replace(/AppData[/\\]Local[/\\]Packages[/\\][^/\\]+[/\\]AC[/\\]/, 'AppData/Local/');
const browser = await chromium.launch({ headless: true, executablePath: existsSync(executable) ? executable : fallback,
  args: ['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
const errors = []; page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
try {
  // Static source harness: retain actual CSS injection while omitting Vite's
  // developer-only WebSocket (unavailable in this isolated browser origin).
  await page.route('**/@vite/client', route => route.fulfill({ contentType: 'application/javascript', body: `
    const styles = new Map();
    export function updateStyle(id, css) { let node = styles.get(id); if (!node) { node = document.createElement('style'); document.head.appendChild(node); styles.set(id, node); } node.textContent = css; }
    export function removeStyle(id) { styles.get(id)?.remove(); styles.delete(id); }
    export function createHotContext() { return { data: {}, accept(){}, acceptExports(){}, dispose(){}, prune(){}, invalidate(){}, on(){}, off(){}, send(){} }; }
    export function injectQuery(url, query) { return url + (url.includes('?') ? '&' : '?') + query; }
    export class ErrorOverlay extends HTMLElement {}
  ` }));
  await page.route('**/woodfish-material-verification', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head></head><body></body></html>' }));
  await page.goto(`${base}/woodfish-material-verification`);
  await page.evaluate(async root => {
    window.process = { env: { EXPO_BASE_URL: '/' } };
    const { default: refresh } = await import('/@react-refresh');
    refresh.injectIntoGlobalHook(window);
    window.$RefreshReg$ = () => {};
    window.$RefreshSig$ = () => type => type;
    window.__vite_plugin_react_preamble_installed__ = true;
    const { mountWoodfishMaterialProbe } = await import(`/@fs/${root}/scripts/craft-rollout-woodfish-browser.mjs`);
    mountWoodfishMaterialProbe();
  }, root);
  await page.waitForSelector('.library-scene-stage[data-ready="true"] canvas', { timeout: 60000 });
  await page.evaluate(() => document.fonts.ready);
  const styles = [];
  for (const style of phase === 'before' ? ['toon-soft'] : ['original', 'toon-soft', 'toon-ink', 'gouache']) {
    await page.evaluate(style => window.woodfishMaterialProbe.debugStyles.select('woodfish', style), style);
    await page.waitForFunction(style => window.woodfishMaterialProbe.debugStyles.getSnapshot().some(item => item.id === 'woodfish' && item.actual === style), style);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const materials = await page.evaluate(() => [...window.woodfishMaterialProbe.meshes].map(mesh => ({ name: mesh.name,
      materials: (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).map(material => ({ kind: material.userData.craftSurface?.kind || null,
        type: material.type, map: !!material.map, normalMap: !!material.normalMap, roughnessMap: !!material.roughnessMap })) })));
    if (materials.length !== 2) throw Error(`Expected real GLB body and mallet; got ${materials.length}`);
    if (phase === 'after' && materials.some(mesh => mesh.materials.some(material => material.kind !== 'wood'))) throw Error('Woodfish GLB craft surface absent');
    styles.push({ style, materials });
    if (style === 'toon-soft') await page.locator('.library-scene-stage[data-ready="true"] canvas').screenshot({ path: path.join(out, 'woodfish.png') });
  }
  await page.evaluate(() => window.woodfishMaterialProbe.dispose());
  if (JSON.stringify(sources) !== JSON.stringify(await snapshot())) throw Error('Source changed during woodfish verification');
  await writeFile(path.join(out, 'woodfish-report.json'), JSON.stringify({ phase, styles, errors, sources, actualApp: true,
    limitation: 'Desktop Chromium SwiftShader; reduced motion; static Vite CSS/HMR bridge only omits the developer websocket; no phone GPU performance claim.' }, null, 2));
  if (errors.length) throw Error(`${errors.length} browser errors`);
  console.log(JSON.stringify({ phase, styles: styles.length, errors: errors.length, actualApp: true }));
} finally { await browser.close(); }
