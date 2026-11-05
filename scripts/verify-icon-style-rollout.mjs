import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const phase = process.argv.includes('--baseline') ? 'before' : 'after';
const width = Number(process.argv.find(arg => arg.startsWith('--width='))?.slice(8) || 390);
const world = process.argv.includes('--world'), night = process.argv.includes('--night');
const interactions = process.argv.includes('--interactions');
const selected = process.argv.find(arg => arg.startsWith('--ids='))?.slice(6).split(',');
const run = process.argv.find(arg => arg.startsWith('--run='))?.slice(6).replace(/[^a-zA-Z0-9-]/g, '');
const reportName = run ? `report-${run}.json` : 'report.json';
const origin = 'http://icon-style.local', bundle = path.resolve('artifacts/icon-style-rollout', phase);
const out = path.join(bundle, `${interactions ? 'interactions' : world ? 'world' : night ? 'night' : 'objects'}-${width}`);
await mkdir(out, { recursive: true });
const bundled = chromium.executablePath(), fallback = bundled.replace(/AppData[/\\]Local[/\\]Packages[/\\][^/\\]+[/\\]AC[/\\]/, 'AppData/Local/');
const browser = await chromium.launch({ executablePath: existsSync(bundled) ? bundled : fallback, headless: true, args: ['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width, height: width }, deviceScaleFactor: 1 });
const errors = [], results = []; let currentId = '';
page.on('pageerror', error => errors.push({ id: currentId, message: error.message }));
page.on('console', message => { if (message.type() === 'error') errors.push({ id: currentId, message: message.text() }); });
await page.route('**/*', async route => {
  const url = new URL(route.request().url());
  if (url.origin !== origin) { errors.push({ id: currentId, message: `Unexpected external request ${url.origin}` }); return route.abort(); }
  const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '');
  const local = path.resolve(bundle, relative), publicFile = path.resolve('apps/cyber-bless/public', relative);
  if (!local.startsWith(bundle + path.sep) || !publicFile.startsWith(path.resolve('apps/cyber-bless/public') + path.sep)) return route.abort();
  const target = existsSync(local) ? local : publicFile;
  const contentType = { '.html': 'text/html', '.js': 'application/javascript', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2' }[path.extname(target)] || 'application/octet-stream';
  try { await route.fulfill({ body: await readFile(target), contentType }); }
  catch { errors.push({ id: currentId, message: `Missing file ${relative}` }); await route.fulfill({ status: 404, body: 'Missing local asset' }); }
});
await page.addInitScript(() => {
  const contexts = window.auditContexts = [], getContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function(type, ...args) {
    const result = getContext.call(this, type, ...args);
    if (result && type.startsWith('webgl') && !contexts.includes(result)) contexts.push(result);
    return result;
  };
});
try {
  await page.goto(`${origin}/index.html`);
  await page.waitForFunction(() => window.iconAudit).catch(error => { console.log(JSON.stringify(errors)); throw error; });
  const entries = await page.evaluate(() => window.iconAudit.entries);
  await writeFile(path.join(bundle, 'entries.json'), JSON.stringify(entries, null, 2));
  const targets = entries.filter(entry => (!selected || selected.includes(entry.id)) && (selected || process.argv.includes('--all') || entry.visible));
  for (const entry of targets) {
    currentId = entry.id;
    const startErrors = errors.length;
    try {
      const state = await page.evaluate(({ id, world, night, interactions }) => window.iconAudit.mount(id, { world, stage: night ? 'night' : 'day',progress:interactions?0:1 }), { id: entry.id, world, night, interactions });
      if (process.argv.includes('--styles')) await page.evaluate(id => window.iconAudit.styles(id), entry.id);
      const data = await page.evaluate(() => window.iconAudit.capture());
      if (!data?.startsWith('data:image/png;base64,')) throw Error('Missing real canvas capture');
      const image = Buffer.from(data.split(',')[1], 'base64');
      const stats = await sharp(image).stats();
      if (stats.channels.slice(0, 3).every(channel => channel.stdev < 1)) throw Error('Empty/black capture');
      await sharp(image).flatten({ background: '#f5eddf' }).png().toFile(path.join(out, `${entry.id}.png`));
      if (interactions) {
        const point = role => page.locator(`[data-cue-role="${role}"]`).first().evaluate(node => [Number(node.dataset.x),Number(node.dataset.y)]);
        if (entry.id==='woodfish') { await page.locator('.woodfish-hit').click(); await page.waitForFunction(()=>window.iconAudit.progress().length>0); }
        else {
          const from=await point('source');
          if(entry.id==='shrine-suzu-bell'){await page.mouse.move(...from);await page.mouse.down();await page.mouse.move(from[0],from[1]+65,{steps:12});await page.mouse.up()}
          else await page.mouse.click(...from);
          await page.evaluate(()=>window.iconAudit.advance(3));
          if(!await page.evaluate(()=>window.iconAudit.progress().length))throw Error(`Physical gesture did not advance ${entry.id}`);
          if(entry.id==='omamori-cycle'){
            await page.evaluate(()=>window.iconAudit.advance(0));const start=await point('source'),end=await point('target');
            await page.mouse.move(...start);await page.mouse.down();await page.mouse.move(...end,{steps:24});await page.mouse.up();await page.evaluate(()=>window.iconAudit.advance(1));
            if(!await page.evaluate(()=>window.iconAudit.progress().includes(2)))throw Error('Pouch placement did not complete');
          }
        }
        state.physicalInteraction=true;state.progressEvents=await page.evaluate(()=>window.iconAudit.progress());
      }
      await page.evaluate(() => window.iconAudit.dispose());
      await page.waitForFunction(() => window.auditContexts.every(context => context.isContextLost()), null, { timeout: 10000 });
      results.push({ ...entry, ...state, width, world, night, errorCount: errors.length - startErrors, contextsReleased: true });
    } catch (error) {
      results.push({ ...entry, error: String(error) });
      await page.evaluate(() => { try { window.iconAudit.dispose(); } catch {} });
    }
    await writeFile(path.join(out, reportName), JSON.stringify({ phase, width, world, night, browser: await browser.version(), results, errors, limitations: 'Real scene modules and bundled assets; desktop Chromium/SwiftShader at DPR1. Object hosts omit the surrounding world; representative world/night runs are separate. No phone GPU performance claim.' }, null, 2));
    if (results.length % 10 === 0 || results.at(-1).error) console.log(`${phase}: ${results.length}/${targets.length} scenes${results.at(-1).error ? ' ERROR ' + results.at(-1).error : ''}`);
  }
  const failures = results.filter(result => result.error || result.errorCount);
  console.log(JSON.stringify({ phase, scenes: results.length, failures: failures.length, browserErrors: errors.length }));
  if (failures.length || errors.length) throw Error(`Scene audit failed: ${failures.length} states, ${errors.length} browser errors`);
} finally { await browser.close(); }
