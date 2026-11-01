import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import { scenePointer } from './browser-scene-pointer.mjs';

const ids = ['brat-bride-cloth','korean-sotdae','japanese-kadomatsu','pucara-rooftop-bulls','chinese-longevity-lock','alasita-miniature-house','scottish-first-footing','mochigase-nagashibina','shichigosan-chitose-ame','lanna-sand-pagoda','chinese-fu-paper','turkish-nazar-bead','japanese-hamaya','chinese-ruyi-scepter','romanian-martisor'];
const requested = process.argv.filter(arg => arg.startsWith('--scene=')).map(arg => arg.slice(8));
const selected = requested.length ? ids.filter(id => requested.includes(id)) : ids;
const automatic = process.argv.includes('--auto');
const base = process.env.WBR_URL || 'http://127.0.0.1:5199';
const out = path.resolve('artifacts/close-inspection-2026-10-29/browser');
fs.mkdirSync(out,{recursive:true});
// The verifier and server must share a loopback namespace on Windows.
const server = process.env.WBR_URL ? undefined : spawn(process.execPath,[path.resolve('node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port','5199','--strictPort'],{cwd:path.resolve('apps/cyber-bless'),windowsHide:true,stdio:['ignore','pipe','pipe']});
process.on('exit',() => server?.kill());
if (server) await new Promise((resolve,reject) => {
  let output=''; const timer=setTimeout(() => reject(Error(`Vite start timed out: ${output}`)),15000);
  server.stdout.on('data',chunk => { output+=chunk; if(output.includes('Local:')){clearTimeout(timer);resolve();} });
  server.stderr.on('data',chunk => { output+=chunk; });
  server.once('error',reject); server.once('exit',code => { clearTimeout(timer); reject(Error(`Vite exited ${code}: ${output}`)); });
});
const bundled = chromium.executablePath(), host = bundled.replace(/AppData[/\\]Local[/\\]Packages[/\\][^/\\]+[/\\]AC[/\\]/,'AppData/Local/');
const browser = await chromium.launch({headless:true,executablePath:fs.existsSync(bundled)?bundled:host,args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page = await browser.newPage({viewport:{width:390,height:844},hasTouch:true,locale:'zh-CN'});
const errors = [], results = [];
page.on('pageerror',error => errors.push(error.message));
await page.addInitScript(() => {
  const original = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function(kind,attributes) {
    return original.call(this,kind,/^webgl/.test(kind)?{...attributes,preserveDrawingBuffer:true}:attributes);
  };
});
const ready = state => page.waitForFunction(state => document.querySelector('.scene-overlay-host[data-close-inspection]')?.getAttribute('data-close-inspection')===state,state,{timeout:30000});
const measure = () => page.locator('.library-scene-stage canvas').evaluate(canvas => {
  const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
  const width = gl.drawingBufferWidth, height = gl.drawingBufferHeight, rgba = new Uint8Array(width*height*4);
  gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,rgba);
  let left=width,top=height,right=-1,bottom=-1,occupied=0;
  for(let y=0;y<height;y++) for(let x=0;x<width;x++) if(rgba[(y*width+x)*4+3]>32){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);occupied++;}
  return {width,height,left,top,right,bottom,occupied};
});
try {
  for (const id of selected) {
    await page.goto(`${base}/scene-review?scene=${id}&locale=zh-Hans`);
    await page.addStyleTag({content:'.scene-review-header{display:none!important}.scene-debug-toolbar{display:none!important}'});
    await ready('ready');
    const stage = page.locator('.library-scene-stage');
    const action = stage.locator('.scene-bow-tap').first();
    const initial = await stage.screenshot({path:path.join(out,`${id}-initial.png`)});
    assert.ok(initial.length>1000);
    await action.click(); await ready('viewing');
    const close = await measure();
    await stage.screenshot({path:path.join(out,`${id}-close.png`)});
    assert.ok(close.occupied>100,`${id}: close object renders`);
    // The rendering style may draw an opaque garden beyond the authored scene;
    // alpha bounds then cover the entire canvas. Per-vertex orbit bounds are
    // verified against the actual actors by the geometry regression tests.
    if (automatic) await ready('placement');
    else {
      const bounds = await stage.locator('canvas').boundingBox(), middle=[bounds.x+bounds.width*.5,bounds.y+bounds.height*.5];
      const input = await scenePointer(page,true);
      await input.down(middle); await input.move([middle[0]+70,middle[1]+12]); await input.up();
      assert.equal(await stage.locator('[data-close-inspection="viewing"]').count(),1,`${id}: manual input keeps inspection`);
      await stage.screenshot({path:path.join(out,`${id}-manual.png`)});
      await action.click(); await ready('placement');
    }
    await action.click(); await ready('done');
    assert.equal(await page.locator('.scene-load-error').count(),0);
    await stage.screenshot({path:path.join(out,`${id}-done.png`)});
    results.push({id,viewport:'390x844',close,manual:!automatic,automatic,completed:true});
    console.log(JSON.stringify(results.at(-1)));
  }
  assert.deepEqual(errors,[]);
  const filename = automatic ? 'report-automatic.json' : requested.length ? `report-${selected.join('+')}.json` : 'report.json';
  fs.writeFileSync(path.join(out,filename),JSON.stringify({results,errors},null,2)+'\n');
  console.log(JSON.stringify({checked:results.length,errors}));
} finally { await browser.close(); server?.kill(); }
