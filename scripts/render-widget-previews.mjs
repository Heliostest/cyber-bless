import { mkdir, writeFile, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import sharp from 'sharp';
import { chromium } from 'playwright';
import { builtInScenes } from '../packages/core/src/daily-scenes.ts';
import { prepareAppAssets } from './prepare-app-assets.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, 'assets/widgets/today');
const android = path.join(root, 'apps/mobile-expo/modules/blessing-widgets/android/src/main/res/drawable-nodpi');
await prepareAppAssets();
await Promise.all([mkdir(output, { recursive: true }), mkdir(android, { recursive: true })]);
const server = await createServer({ configFile: false, root: path.join(root, 'scripts/widget-preview'),
  publicDir: path.join(root, 'apps/cyber-bless/public'),
  define: { 'process.env.EXPO_BASE_URL': JSON.stringify('/') },
  server: { host: '127.0.0.1', port: 0, fs: { allow: [root] } }, logLevel: 'warn' });
await server.listen();
let browser;
try {
  browser = await chromium.launch({ ...(process.env.WBR_CHROME ? { executablePath: process.env.WBR_CHROME } : {}),
    headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  // Seed decorative particle placement. The scene's public pose is deterministic.
  await page.addInitScript(() => { let seed = 42; Math.random = () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296); });
  const origin = server.resolvedUrls.local[0];
  const scenes = [];
  for (const scene of builtInScenes) {
    const record = { id: scene.id, engine: scene.engine };
    for (const [size, width, height] of [['small', 600, 600], ['medium', 1280, 600]]) {
      await page.setViewportSize({ width, height });
      await page.goto(`${origin}?scene=${scene.id}&width=${width}&height=${height}`, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => window.__widgetReady || window.__widgetError, { timeout: 30_000 });
      const error = await page.evaluate(() => window.__widgetError);
      if (error) throw Error(`${scene.id}: ${error}`);
      // Renderer ready + next frames cover asynchronous model/texture upload.
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const evidence = await page.evaluate(() => window.__widgetCapture());
      const bytes = await sharp(await page.locator('#stage').screenshot()).png({ compressionLevel: 9 }).toBuffer();
      const file = `${scene.id}-${size}.png`;
      await writeFile(path.join(output, file), bytes);
      await writeFile(path.join(android, `blessing_preview_${scene.id.replaceAll('-', '_')}_${size}.png`), bytes);
      record[size] = { file, width, height, sha256: createHash('sha256').update(bytes).digest('hex'), ...evidence };
      console.log(`${scene.id}/${size}: real WebGL2, ${bytes.length} bytes`);
    }
    scenes.push(record);
  }
  // Generic gallery/expired entry uses a public woodfish cover, never personal state.
  for (const size of ['small', 'medium']) {
    await copyFile(path.join(output, `woodfish-${size}.png`), path.join(output, `generic-${size}.png`));
    await copyFile(path.join(output, `generic-${size}.png`), path.join(android, `blessing_preview_generic_${size}.png`));
  }
  const revision = createHash('sha256').update(JSON.stringify(scenes)).digest('hex');
  await writeFile(path.join(output, 'manifest.json'), JSON.stringify({ renderer: 'project-threejs-scenes', revision, scenes }, null, 2) + '\n');
} finally {
  await browser?.close();
  await server.close();
}
