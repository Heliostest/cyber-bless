import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const base=process.env.WBR_URL||'http://127.0.0.1:5197';
const out=path.resolve(process.env.WBR_VISUAL_OUT||'artifacts/komorebi-defaults');await mkdir(out,{recursive:true});
const executablePath=[process.env.WBR_CHROME,chromium.executablePath(),'C:/Program Files/Google/Chrome/Application/chrome.exe'].find(file=>file&&existsSync(file));
const browser=await chromium.launch({executablePath,headless:true,args:['--enable-unsafe-swiftshader','--no-proxy-server']});
const report={scenes:[],errors:[]};
const moduleURL=file=>'/@fs/'+path.resolve(`packages/scene-runtime/src/${file}`).replaceAll('\\','/');
const samples=['woodfish','shinto-torii','furin-wind-chime','venetian-glass-bead','turkish-nazar-bead','sri-lankan-bodhi-puja','japanese-kadomatsu','tanzaku-tanabata','lam-tsuen-wishing-tree','diya-oil-lamp','yeondeunghoe','celtic-folk-spring','floating-lantern-loy-krathong','udo-undama','chinese-diabolo','german-nutcracker','brat-bride-cloth','scottish-first-footing','chinese-shadow-puppet','votive-candle-catholic','lantern'];
try {
  const page=await browser.newPage({viewport:{width:1100,height:900},deviceScaleFactor:1,locale:'zh-CN',reducedMotion:'reduce'});
  let treeRequests=[];
  page.on('request',request=>{if(request.url().includes('/environments/trees/komorebi/'))treeRequests.push(request.url());});
  page.on('pageerror',error=>report.errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')report.errors.push(message.text());});
  await page.goto(`${base}/scene-review?scene=woodfish`,{waitUntil:'domcontentloaded'});
  await page.locator('.scene-review-controls select option').first().waitFor({state:'attached',timeout:60000});
  const ids=process.argv.includes('--all')?await page.locator('.scene-review-controls select option').evaluateAll(nodes=>nodes.map(n=>n.value)):samples;
  assert.ok(ids.length>0,'The scene inventory must be loaded before auditing');
  if(process.argv.includes('--all')) {
    const expected=await page.evaluate(async url=>{const {builtInScenes}=await import(url);return builtInScenes.map(scene=>scene.id);},'/@fs/'+path.resolve('packages/core/src/daily-scenes.ts').replaceAll('\\','/'));
    assert.deepEqual(ids,expected,'Every bundled scene must be included in the audit');
  }
  for(const [index,id] of ids.entries()) {
    treeRequests=[];
    if(index || new URL(page.url()).searchParams.get('scene')!==id)await page.goto(`${base}/scene-review?scene=${id}`,{waitUntil:'domcontentloaded'});
    await page.addStyleTag({content:'.scene-review-header{position:static!important}'});
    const canvas=page.locator('canvas[data-environment-ready="true"]').first();await canvas.waitFor({timeout:90000});
    // The outdoor environment can be ready before an asynchronous subject model.
    await page.waitForFunction(()=>document.querySelector('canvas[data-environment]')?.closest('.library-scene-stage')?.getAttribute('data-ready')==='true',undefined,{timeout:90000});
    await page.waitForFunction(()=>document.querySelector('canvas[data-environment]')?.dataset.treeStatus!=='loading');
    const initial=await canvas.evaluate(node=>({...node.dataset}));
    assert.equal(initial.environmentTone,'komorebi',`${id}: default tone`);
    if(initial.grassMethod)assert.equal(initial.grassMethod,'komorebi',`${id}: default grass`);
    const recommendation=await page.evaluate(async ({url,id})=>{const {getSceneTreeDefault}=await import(url);return getSceneTreeDefault(id);},{url:moduleURL('tree-profiles.ts'),id});
    if(initial.treeMethod)assert.equal(initial.treeMethod,recommendation==='original'?'original':'scene',`${id}: scene default trees`);
    assert.deepEqual(treeRequests,[],`${id}: optional Komorebi trees must not load by default`);
    const optionalKomorebiLoadsOnEntry=treeRequests.length;
    const actual=await page.evaluate(async ({url,id})=>{const {debugStyles}=await import(url);return debugStyles.getSnapshot().find(e=>e.id===id)?.actual;},{url:moduleURL('debug-styles.ts'),id});
    assert.equal(actual,'toon-soft',`${id}: no shader fallback`);
    await canvas.screenshot({path:path.join(out,`${id}.png`)});
    if(index===0) {
      await page.evaluate(async url=>{
        const code=await(await fetch(url)).text();const THREE=await import(code.match(/from\s+['"]([^'"]*three[^'"]*)['"]/)[1]);
        const before=THREE.InstancedMesh.prototype.onBeforeRender;
        THREE.InstancedMesh.prototype.onBeforeRender=function(renderer,scene,camera,...args){if(scene.getObjectByName('cozy-environment'))window.defaultView={scene,camera,renderer};return before.call(this,renderer,scene,camera,...args);};
      },moduleURL('imported-trees.ts'));
      const saved=await page.evaluate(()=>JSON.stringify(localStorage));
      await page.locator('[data-audio-console-toggle]').click();
      await page.locator('.grass-debug-controls select').selectOption('original');
      await page.locator('.environment-tone-controls select').selectOption('tiny-delivery');
      await page.locator('select[data-tree-scene]').selectOption('komorebi');
      await page.waitForFunction(()=>{const node=document.querySelector('canvas[data-environment]');return node?.dataset.treeStatus==='ready'&&node.dataset.treeMethod==='komorebi';});
      await canvas.screenshot({path:path.join(out,`${id}-optional-komorebi.png`)});
      const capture=await page.evaluate(async url=>{
        const {captureSceneImage}=await import(url),canvas=document.querySelector('canvas[data-environment]'),encode=canvas.toDataURL;
        const beforeBackground=window.defaultView.scene.background.uuid;let during;
        const state=()=>{const scene=window.defaultView.scene;return{trees:scene.getObjectByName('recommended-environment-trees').visible,originalTrees:scene.getObjectByName('stylized-trees')?.visible,previewTrees:scene.getObjectByName('alternative-environment-trees').visible,grass:scene.getObjectByName('komorebi-meadow').visible,background:scene.background.uuid};};
        canvas.toDataURL=function(...args){during=state();return encode.apply(this,args);};
        try{const image=captureSceneImage(canvas);return{encoded:image?.startsWith('data:image/png'),during,beforeBackground,after:state()};}finally{canvas.toDataURL=encode;}
      },moduleURL('scene-capture.ts'));
      assert.equal(capture.encoded,true);assert.equal(capture.during.trees,true);assert.equal(capture.during.grass,true);assert.notEqual(capture.during.background,capture.beforeBackground);
      assert.equal(capture.during.previewTrees,false);assert.equal(capture.after.previewTrees,true);
      if(recommendation==='original'){assert.equal(capture.during.originalTrees,true);assert.equal(capture.after.originalTrees,false);}
      assert.equal(capture.after.trees,false);assert.equal(capture.after.grass,false);assert.equal(capture.after.background,capture.beforeBackground);report.capture=capture;
      await page.locator('.grass-debug-controls select').selectOption('komorebi');await page.locator('.environment-tone-controls select').selectOption('komorebi');await page.locator('[data-tree-reset]').click();
      assert.equal(await page.locator('select[data-tree-scene]').inputValue(),'scene');
      await page.locator('[data-audio-console-toggle]').click();assert.equal(await page.evaluate(()=>JSON.stringify(localStorage)),saved);
    }
    if(samples.includes(id)) {
      await page.setViewportSize({width:390,height:844});await canvas.screenshot({path:path.join(out,`${id}-mobile.png`)});
      await page.setViewportSize({width:1100,height:900});
    }
    report.scenes.push({id,tone:initial.environmentTone,grass:initial.grassMethod??null,trees:initial.treeMethod??null,recommendation,optionalKomorebiLoadsOnEntry,style:actual,mobile:samples.includes(id)});
    console.log(`${index+1}/${ids.length} ${id}`);
    await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
  }
  assert.deepEqual(report.errors,[]);
}finally{await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');await browser.close();}
console.log(JSON.stringify({scenes:report.scenes.length,errors:report.errors},null,2));
