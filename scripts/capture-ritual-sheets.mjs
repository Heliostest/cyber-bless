#!/usr/bin/env node
/**
 * Standalone official-stage ritual still capture + 2x2 checkerboard sheet packer.
 *
 * Usage:
 *   node scripts/capture-ritual-sheets.mjs [--out DIR] [--all] [--set NAME] [--list] [--settle MS] [ritual-id ...]
 *   npm run preview:ritual-sheets -- [--out DIR] [--all] [--set NAME] [--list] [--settle MS] [ritual-id ...]
 *
 * Examples:
 *   node scripts/capture-ritual-sheets.mjs --list
 *   node scripts/capture-ritual-sheets.mjs --set trees
 *   node scripts/capture-ritual-sheets.mjs clootie-well-rag lam-tsuen-wishing-tree
 *   node scripts/capture-ritual-sheets.mjs --all --out /workspace/cyber-bless-ritual-sheets-preview
 *
 * Options:
 *   --out DIR      Output root directory (default: <repo-parent>/cyber-bless-ritual-sheets-preview)
 *                  Writes shots/<id>.png (692x664), sheets/sheet-01.png (2x2), and capture-*.json.
 *   --all          Capture every built-in ritual from builtInScenes in catalog order.
 *   --set NAME     Capture a named set (available: trees).
 *   --list         Print all ritual ids + catalog Chinese titles, then exit.
 *   --settle MS    Post-ready settle delay in ms (default: 2500 or env SETTLE).
 *   -h, --help     Show this usage message.
 *
 * Environment overrides:
 *   SETTLE         Default settle delay in ms when --settle is omitted (default: 2500).
 *   WBR_CHROME     Path to Chromium executable (default: /usr/bin/google-chrome).
 *   WBR_CACHE      Vite dep-optimization cache directory (default: system temp dir).
 */

// Unset proxy variables before loading Vite/Chromium so localhost traffic never hits a proxy.
for (const key of ['HTTP_PROXY', 'HTTPS_PROXY', 'http_proxy', 'https_proxy', 'ALL_PROXY', 'all_proxy']) {
  delete process.env[key];
}
process.env.NO_PROXY = '127.0.0.1,localhost';
process.env.no_proxy = '127.0.0.1,localhost';

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { builtInScenes } from '../packages/core/src/daily-scenes.ts';
import { rapierWasmPlugin } from './vite-rapier-wasm.mjs';

const STAGE_WIDTH = 346;
const STAGE_HEIGHT = 332;
const STAGE_DPR = 2;
const STAGE_SIZE_SUFFIX = `${STAGE_WIDTH}x${STAGE_HEIGHT}`;
const EXPECTED_IMAGE_WIDTH = STAGE_WIDTH * STAGE_DPR;
const EXPECTED_IMAGE_HEIGHT = STAGE_HEIGHT * STAGE_DPR;
const EXPECTED_THREE_VERSION = '0.170.0';
const EXPECTED_THREE_REVISION = '170';
const BLANK_THRESHOLD = 0.5;
const BLANK_RETRIES = 3;
const BLANK_RETRY_WAIT_MS = 4000;
const CHROME_PATH = process.env.WBR_CHROME ?? '/usr/bin/google-chrome';

const NAMED_SETS = Object.freeze({
  trees: [
    'clootie-well-rag',
    'lam-tsuen-wishing-tree',
    'german-jumping-jack',
    'tanzaku-tanabata',
    'romanian-martisor',
  ],
});

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const repoNodeModules = path.join(repoRoot, 'node_modules');
const harnessRoot = path.join(scriptDir, 'ritual-sheets', 'app');
const harnessEntry = path.join(harnessRoot, 'main.ts');
const packSheetsScript = path.join(scriptDir, 'ritual-sheets', 'pack-sheets.py');
const defaultOutDir = path.resolve(repoRoot, '..', 'cyber-bless-ritual-sheets-preview');

function printUsage(stream = process.stdout) {
  stream.write(
    [
      'Usage:',
      '  node scripts/capture-ritual-sheets.mjs [--out DIR] [--all] [--set NAME] [--list] [--settle MS] [ritual-id ...]',
      '  npm run preview:ritual-sheets -- [--out DIR] [--all] [--set NAME] [--list] [--settle MS] [ritual-id ...]',
      '',
      'Options:',
      `  --out DIR     Output root (default: ${defaultOutDir})`,
      '  --all         Capture all builtInScenes in catalog order',
      `  --set NAME    Capture a named set (${Object.keys(NAMED_SETS).join(', ')})`,
      '  --list        Print all ritual ids and Chinese titles, then exit',
      '  --settle MS   Settle time after ready in ms (default: 2500 or env SETTLE)',
      '  -h, --help    Show help',
      '',
    ].join('\n'),
  );
}

function parseArgs(argv) {
  const opts = {
    outDir: defaultOutDir,
    all: false,
    list: false,
    help: false,
    settleMs: Number(process.env.SETTLE ?? 2500),
    requestedIds: [],
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '-h' || arg === '--help') {
      opts.help = true;
    } else if (arg === '--list') {
      opts.list = true;
    } else if (arg === '--all') {
      opts.all = true;
    } else if (arg === '--out') {
      const value = argv[++i];
      if (!value) throw new Error('--out requires a directory path');
      opts.outDir = path.resolve(value);
    } else if (arg.startsWith('--out=')) {
      const value = arg.slice('--out='.length);
      if (!value) throw new Error('--out requires a directory path');
      opts.outDir = path.resolve(value);
    } else if (arg === '--set') {
      const name = argv[++i];
      if (!name) throw new Error('--set requires a set name');
      const setIds = NAMED_SETS[name];
      if (!setIds) {
        throw new Error(`Unknown set "${name}". Available sets: ${Object.keys(NAMED_SETS).join(', ')}`);
      }
      opts.requestedIds.push(...setIds);
    } else if (arg.startsWith('--set=')) {
      const name = arg.slice('--set='.length);
      const setIds = NAMED_SETS[name];
      if (!setIds) {
        throw new Error(`Unknown set "${name}". Available sets: ${Object.keys(NAMED_SETS).join(', ')}`);
      }
      opts.requestedIds.push(...setIds);
    } else if (arg === '--settle') {
      const raw = argv[++i];
      const ms = Number(raw);
      if (!raw || !Number.isFinite(ms) || ms < 0) {
        throw new Error(`Invalid --settle value: ${raw}`);
      }
      opts.settleMs = ms;
    } else if (arg.startsWith('--settle=')) {
      const raw = arg.slice('--settle='.length);
      const ms = Number(raw);
      if (!raw || !Number.isFinite(ms) || ms < 0) {
        throw new Error(`Invalid --settle value: ${raw}`);
      }
      opts.settleMs = ms;
    } else if (arg.startsWith('-')) {
      throw new Error(`Unknown option: ${arg}`);
    } else {
      opts.requestedIds.push(arg);
    }
  }

  if (!Number.isFinite(opts.settleMs) || opts.settleMs < 0) {
    throw new Error(`Invalid settle duration: ${opts.settleMs}`);
  }

  return opts;
}

function buildWbrAliases(targetRoot) {
  return [
    { find: '@src', replacement: targetRoot },
    { find: /^@wbr\/scenes\/(.+)$/, replacement: `${targetRoot}/packages/scenes/src/$1` },
    { find: '@wbr/scenes', replacement: `${targetRoot}/packages/scenes/src/index.ts` },
    { find: /^@wbr\/scene-runtime\/(.+)$/, replacement: `${targetRoot}/packages/scene-runtime/src/$1` },
    { find: '@wbr/scene-runtime', replacement: `${targetRoot}/packages/scene-runtime/src/index.ts` },
    { find: /^@wbr\/runtime\/(.+)$/, replacement: `${targetRoot}/packages/runtime/src/$1` },
    { find: '@wbr/runtime', replacement: `${targetRoot}/packages/runtime/src/index.ts` },
    { find: /^@wbr\/core\/(.+)$/, replacement: `${targetRoot}/packages/core/src/$1` },
    { find: '@wbr/core', replacement: `${targetRoot}/packages/core/src/index.ts` },
    { find: /^@wbr\/gestures\/(.+)$/, replacement: `${targetRoot}/packages/gestures/src/$1` },
    { find: '@wbr/gestures', replacement: `${targetRoot}/packages/gestures/src/index.ts` },
    { find: /^@wbr\/shared\/(.+)$/, replacement: `${targetRoot}/packages/shared/src/$1` },
    { find: '@wbr/shared', replacement: `${targetRoot}/packages/shared/src/index.ts` },
    { find: /^@wbr\/content\/(.+)$/, replacement: `${targetRoot}/packages/content/src/$1` },
    { find: '@wbr/content', replacement: `${targetRoot}/packages/content/src/index.ts` },
    { find: /^@wbr\/i18n\/(.+)$/, replacement: `${targetRoot}/packages/i18n/src/$1` },
    { find: '@wbr/i18n', replacement: `${targetRoot}/packages/i18n/src/index.ts` },
    { find: /^@wbr\/app\/(.+)$/, replacement: `${targetRoot}/packages/app/src/$1` },
    { find: '@wbr/app', replacement: `${targetRoot}/packages/app/src/App.tsx` },
  ];
}

function previewNodeModulesPlugin(targetRoot, entryFile) {
  const normalizedRoot = targetRoot.replaceAll('\\', '/');
  const forbiddenPrefix = '/workspace/node_modules/';
  return {
    name: 'preview-node-modules',
    async resolveId(source, importer, options) {
      if (
        !source ||
        source.startsWith('.') ||
        source.startsWith('/') ||
        source.startsWith('\0') ||
        source.startsWith('virtual:') ||
        source.startsWith('@wbr/') ||
        source.startsWith('@src')
      ) {
        return null;
      }
      if (importer && importer.replaceAll('\\', '/').startsWith(normalizedRoot)) {
        const resolved = await this.resolve(source, entryFile, { ...options, skipSelf: true });
        if (resolved?.id && resolved.id.replaceAll('\\', '/').startsWith(forbiddenPrefix)) {
          throw new Error(`Refusing to resolve "${source}" from forbidden node_modules: ${resolved.id}`);
        }
        return resolved;
      }
      return null;
    },
  };
}

function verifyRuntimeDependencies() {
  const threePkgPath = path.join(repoNodeModules, 'three', 'package.json');
  if (!fs.existsSync(threePkgPath)) {
    throw new Error(`Missing three package at ${threePkgPath}`);
  }
  const threePkg = JSON.parse(fs.readFileSync(threePkgPath, 'utf8'));
  if (threePkg.version !== EXPECTED_THREE_VERSION) {
    throw new Error(
      `Expected three@${EXPECTED_THREE_VERSION} in ${repoNodeModules}, found ${threePkg.version}`,
    );
  }
  if (!fs.existsSync(CHROME_PATH)) {
    throw new Error(`Chromium executable not found at ${CHROME_PATH} (set WBR_CHROME to override)`);
  }
  if (!fs.existsSync(harnessEntry)) {
    throw new Error(`Missing official-stage harness at ${harnessEntry}`);
  }
  if (!fs.existsSync(packSheetsScript)) {
    throw new Error(`Missing contact sheet packer at ${packSheetsScript}`);
  }
}

async function measureBlankShare(sharp, buffer) {
  const { data, info } = await sharp(buffer).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let blank = 0;
  for (let i = 0; i < data.length; i += 3) {
    if (data[i] === 205 && data[i + 1] === 241 && data[i + 2] === 230) {
      blank++;
    }
  }
  return {
    share: blank / (info.width * info.height),
    width: info.width,
    height: info.height,
  };
}

function packContactSheets({ sheetsDir, items }) {
  const payload = {
    sheetsDir,
    cols: 2,
    rows: 2,
    cellWidth: EXPECTED_IMAGE_WIDTH,
    cellHeight: EXPECTED_IMAGE_HEIGHT,
    bannerMeta: `${STAGE_SIZE_SUFFIX} @${STAGE_DPR}x (${EXPECTED_IMAGE_WIDTH}x${EXPECTED_IMAGE_HEIGHT})  ·  THREE r${EXPECTED_THREE_REVISION}`,
    items,
  };
  const proc = spawnSync('python3', ['-I', packSheetsScript], {
    input: JSON.stringify(payload),
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });
  if (proc.error) {
    throw new Error(`Failed to run pack-sheets.py: ${proc.error.message}`);
  }
  if (proc.status !== 0) {
    throw new Error(`pack-sheets.py failed (exit ${proc.status}): ${(proc.stderr || proc.stdout || '').trim()}`);
  }
  return JSON.parse(proc.stdout.trim() || '[]');
}

async function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`Error: ${err.message}`);
    printUsage(process.stderr);
    process.exit(2);
  }

  if (opts.help) {
    printUsage(process.stdout);
    return;
  }

  const catalogById = new Map(builtInScenes.map((entry) => [entry.id, entry]));

  if (opts.list) {
    for (const entry of builtInScenes) {
      console.log(`${entry.id}  ${entry.title}`);
    }
    return;
  }

  const targetIds = opts.all
    ? [...builtInScenes.map((entry) => entry.id), ...opts.requestedIds]
    : opts.requestedIds;

  if (targetIds.length === 0) {
    console.error('Error: Specify --all, --set NAME, or one or more ritual ids (use --list to inspect catalog).');
    printUsage(process.stderr);
    process.exit(2);
  }

  const unknownIds = targetIds.filter((id) => !catalogById.has(id));
  if (unknownIds.length > 0) {
    console.error(`Error: Unknown ritual id(s): ${unknownIds.join(', ')}`);
    console.error('Run with --list to see all available built-in ritual ids.');
    process.exit(1);
  }

  verifyRuntimeDependencies();

  const { createServer } = await import(pathToFileURL(path.join(repoNodeModules, 'vite/dist/node/index.js')).href);
  const { chromium } = await import(pathToFileURL(path.join(repoNodeModules, 'playwright/index.mjs')).href);
  const sharp = (await import(pathToFileURL(path.join(repoNodeModules, 'sharp/lib/index.js')).href)).default;

  const shotsDir = path.join(opts.outDir, 'shots');
  const sheetsDir = path.join(opts.outDir, 'sheets');
  fs.mkdirSync(shotsDir, { recursive: true });
  fs.mkdirSync(sheetsDir, { recursive: true });

  const cacheHash = createHash('sha256').update(repoRoot).digest('hex').slice(0, 12);
  const cacheDir = process.env.WBR_CACHE ?? path.join(os.tmpdir(), `wbr-ritual-sheets-vite-${cacheHash}`);
  const fsAllow = Array.from(
    new Set([
      repoRoot,
      fs.realpathSync(repoNodeModules),
      cacheDir,
      ...(repoRoot.startsWith('/workspace/') || repoRoot === '/workspace' ? ['/workspace'] : []),
    ]),
  );

  const server = await createServer({
    configFile: false,
    root: harnessRoot,
    cacheDir,
    publicDir: path.join(repoRoot, 'assets'),
    plugins: [rapierWasmPlugin(), previewNodeModulesPlugin(repoRoot, harnessEntry)],
    optimizeDeps: { exclude: ['@dimforge/rapier3d-simd'] },
    resolve: {
      alias: buildWbrAliases(repoRoot),
      dedupe: ['three'],
    },
    define: { 'process.env.EXPO_BASE_URL': JSON.stringify('/') },
    server: {
      host: '127.0.0.1',
      port: 0,
      fs: { allow: fsAllow },
      hmr: { overlay: false },
    },
    logLevel: 'warn',
  });

  await server.listen();
  const origin = server.resolvedUrls.local[0];

  const browser = await chromium.launch({
    headless: true,
    executablePath: CHROME_PATH,
    args: [
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--hide-scrollbars',
      '--disable-dev-shm-usage',
      '--no-sandbox',
      '--no-proxy-server',
    ],
  });

  const report = [];
  const sheetItems = [];
  const failures = [];
  const seenCounts = new Map();

  try {
    for (const id of targetIds) {
      const entry = catalogById.get(id);
      const count = (seenCounts.get(id) ?? 0) + 1;
      seenCounts.set(id, count);
      const shotFilename = count === 1 ? `${id}.png` : `${id}-${count}.png`;
      const shotPath = path.join(shotsDir, shotFilename);
      const query = `scene=${encodeURIComponent(id)}&progress=0&overlay=0`;
      const label = `${entry.title}  ${id}`;

      const page = await browser.newPage({
        viewport: { width: STAGE_WIDTH, height: STAGE_HEIGHT },
        deviceScaleFactor: STAGE_DPR,
      });
      const errors = [];
      page.on('response', (res) => {
        if (res.status() >= 400) {
          const msg = `HTTP ${res.status()} ${res.url()}`;
          console.log(id, msg.slice(0, 180));
          errors.push(msg);
        }
      });
      page.on('pageerror', (err) => {
        const msg = String(err);
        console.log(id, 'pageerror', msg.slice(0, 300));
        errors.push(msg);
      });
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          const text = msg.text();
          console.log(id, 'console:', text.slice(0, 200));
          errors.push(text);
        }
      });

      const started = Date.now();
      try {
        await page.goto(`${origin}?${query}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForFunction(() => window.__ready || window.__error, undefined, { timeout: 150000 });
        const initError = await page.evaluate(() => window.__error);
        if (initError) {
          throw new Error(String(initError));
        }

        await page
          .waitForFunction(
            () => {
              const c = document.querySelector('#stage canvas');
              if (!c) return true;
              const envReady = !c.dataset.environment || c.dataset.environmentReady === 'true';
              const treeReady = c.dataset.treeStatus !== 'loading';
              return envReady && treeReady;
            },
            undefined,
            { timeout: 120000 },
          )
          .catch(() => console.log(id, 'environment not ready in time'));

        if (opts.settleMs > 0) {
          await page.waitForTimeout(opts.settleMs);
        }

        const info = await page.evaluate(() => {
          const c = document.querySelector('#stage canvas');
          if (!c) return { threeRevision: window.__threeRevision };
          const r = c.getBoundingClientRect();
          return {
            ...c.dataset,
            cssW: r.width,
            cssH: r.height,
            pxW: c.width,
            pxH: c.height,
            threeRevision: window.__threeRevision,
          };
        });

        if (info.threeRevision !== EXPECTED_THREE_REVISION) {
          throw new Error(`THREE.REVISION was ${info.threeRevision}, expected ${EXPECTED_THREE_REVISION}`);
        }
        if (
          info.cssW !== STAGE_WIDTH ||
          info.cssH !== STAGE_HEIGHT ||
          info.pxW !== EXPECTED_IMAGE_WIDTH ||
          info.pxH !== EXPECTED_IMAGE_HEIGHT
        ) {
          console.log(id, 'SIZE NOTE', JSON.stringify({ cssW: info.cssW, cssH: info.cssH, pxW: info.pxW, pxH: info.pxH }));
        }

        let shot = await page.screenshot({ timeout: 90000 });
        let blank = await measureBlankShare(sharp, shot);
        for (let attempt = 0; attempt < BLANK_RETRIES && blank.share > BLANK_THRESHOLD; attempt++) {
          console.log(id, `blank frame (${(blank.share * 100).toFixed(1)}% mint), waiting`, attempt + 1);
          await page.waitForTimeout(BLANK_RETRY_WAIT_MS);
          shot = await page.screenshot({ timeout: 90000 });
          blank = await measureBlankShare(sharp, shot);
        }
        if (blank.share > BLANK_THRESHOLD) {
          throw new Error(`canvas stayed blank (${(blank.share * 100).toFixed(1)}% #cdf1e6)`);
        }

        fs.writeFileSync(shotPath, shot);
        const seconds = (Date.now() - started) / 1000;
        const record = {
          id,
          title: entry.title,
          query: `${query}@${STAGE_SIZE_SUFFIX}`,
          size: STAGE_SIZE_SUFFIX,
          file: shotPath,
          imageW: blank.width,
          imageH: blank.height,
          bytes: shot.length,
          blankShare: Number(blank.share.toFixed(4)),
          seconds: Number(seconds.toFixed(2)),
          errors,
          ...info,
        };
        report.push(record);
        sheetItems.push({ id, title: entry.title, label, path: shotPath, failed: false });
        console.log(
          id,
          `(${entry.title})`,
          `${seconds.toFixed(1)}s`,
          `${blank.width}x${blank.height}`,
          `THREE r${info.threeRevision}`,
          `blank=${(blank.share * 100).toFixed(1)}%`,
          info.environment ?? '',
          info.treeStatus ? `tree=${info.treeMethod ?? ''}/${info.treeStatus}` : '',
          errors.length ? `ERR(${errors.length})` : 'ok',
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const seconds = (Date.now() - started) / 1000;
        console.error(id, `(${entry.title})`, 'FAILED:', message.slice(0, 300));
        report.push({
          id,
          title: entry.title,
          query: `${query}@${STAGE_SIZE_SUFFIX}`,
          size: STAGE_SIZE_SUFFIX,
          seconds: Number(seconds.toFixed(2)),
          failed: message.slice(0, 300),
          errors,
        });
        failures.push({ id, title: entry.title, error: message.slice(0, 300) });
        sheetItems.push({ id, title: entry.title, label, path: null, failed: true, error: message.slice(0, 300) });
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
    await server.close();
  }

  const sheets = packContactSheets({ sheetsDir, items: sheetItems });
  const reportPath = path.join(opts.outDir, `capture-${Date.now()}.json`);
  const summary = {
    repoRoot,
    outDir: opts.outDir,
    shotsDir,
    sheetsDir,
    stage: {
      width: STAGE_WIDTH,
      height: STAGE_HEIGHT,
      deviceScaleFactor: STAGE_DPR,
      pixelWidth: EXPECTED_IMAGE_WIDTH,
      pixelHeight: EXPECTED_IMAGE_HEIGHT,
      sizeSuffix: `@${STAGE_SIZE_SUFFIX}`,
    },
    expectedThreeRevision: EXPECTED_THREE_REVISION,
    settleMs: opts.settleMs,
    requestedCount: targetIds.length,
    capturedCount: targetIds.length - failures.length,
    failedCount: failures.length,
    failures,
    sheets,
    report,
  };
  fs.writeFileSync(reportPath, JSON.stringify(summary, null, 2) + '\n');

  console.log('');
  console.log(`Captured ${summary.capturedCount}/${summary.requestedCount} rituals.`);
  for (const sheet of sheets) {
    console.log(`Sheet: ${sheet.file} (${sheet.width}x${sheet.height}, cells: ${sheet.cells.join(', ')})`);
  }
  console.log(`Report: ${reportPath}`);

  if (failures.length > 0) {
    console.error(`Failed rituals (${failures.length}): ${failures.map((f) => f.id).join(', ')}`);
    process.exitCode = 1;
  }
}

await main();
