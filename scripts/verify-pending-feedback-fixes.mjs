import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {scenePointer} from './browser-scene-pointer.mjs';

const base=process.env.WBR_URL||'http://127.0.0.1:5175', out='artifacts/test-feedback';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true}),results=[];
try {
  for(const [width,touch,reduced] of process.env.WBR_ROTATION_ONLY?[]:[[440,true,false],[320,true,true],[1280,false,false]]) {
    const page=await browser.newPage({viewport:{width,height:960},hasTouch:touch,isMobile:touch,reducedMotion:reduced?'reduce':'no-preference'});
    page.setDefaultTimeout(15000);
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    console.log(`Checking cloth: ${width}px, touch=${touch}, reduced=${reduced}`);
    // Read-only test observation at renderer creation; renderer output, scene
    // state, controls and animation clock remain the production implementation.
    await page.route('**/debug-render-style.ts',async route=>{
      const response=await route.fetch(),source=await response.text();
      const observed=source.replace('let disposed = false','globalThis.feedbackView = { scene, camera }; let disposed = false');
      assert.notEqual(observed,source,'render registration must be observable');
      await route.fulfill({response,body:observed});
    });
    await page.goto(`${base}/scene-review?scene=brat-bride-cloth`);
    await page.locator('.library-scene-stage[data-ready="true"]').waitFor();
    await page.waitForFunction(()=>window.feedbackView?.scene.getObjectByName('brat-cloth'));
    const pointer=await scenePointer(page,touch);
    const project=async(x,z)=>page.evaluate(([x,z])=>{
      const {scene,camera}=window.feedbackView,cloth=scene.getObjectByName('brat-cloth');scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);
      const p=cloth.localToWorld(cloth.position.clone().set(x,.015,z)).project(camera),r=document.querySelector('.library-scene-stage canvas').getBoundingClientRect();
      return [r.left+(p.x+1)*r.width/2,r.top+(1-p.y)*r.height/2];
    },[x,z]);
    const cue=async role=>page.locator(`[data-cue-role="${role}"]:not([hidden])`).first().evaluate(el=>{
      const rect=el.parentElement.getBoundingClientRect();return [rect.left+Number(el.dataset.x),rect.top+Number(el.dataset.y)];
    });
    assert.equal(await page.locator('[data-close-inspection]').count(),0);
    const from=await cue('source'),to=await cue('target');
    await pointer.down(from);await pointer.move(to);await pointer.up();
    await page.locator('[data-cloth-phase="smoothing"]').waitFor();
    assert.match(await page.locator('.scene-progress').textContent(),/已完成\s*0\s*\/\s*3/);
    await page.screenshot({path:`${out}/cloth-close-${width}.png`,fullPage:true});
    const before=await page.evaluate(()=>Array.from(window.feedbackView.scene.getObjectByName('brat-cloth').geometry.attributes.position.array));
    for(const [index,z] of [-.24,0,.24].entries()) {
      const a=await project(index===1?.76:-.76,z),b=await project(index===1?-.76:.76,z);
      await pointer.down(a);await pointer.move(b,20);await pointer.up();
    }
    await page.locator('[data-cloth-phase="done"]').waitFor();
    assert.match(await page.locator('.scene-progress').textContent(),/已完成\s*3\s*\/\s*3/);
    const after=await page.evaluate(()=>Array.from(window.feedbackView.scene.getObjectByName('brat-cloth').geometry.attributes.position.array));
    assert.notDeepEqual(after,before);
    await page.screenshot({path:`${out}/cloth-smoothed-${width}.png`,fullPage:true});
    assert.deepEqual(errors,[]);results.push({scene:'brat-bride-cloth',width,touch,reduced,placementWithoutInspection:true,completionAfterSmoothing:true});
    await page.close();
  }
  const page=await browser.newPage({viewport:{width:440,height:960},hasTouch:true,isMobile:true,reducedMotion:'reduce'});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));page.setDefaultTimeout(15000);
  await page.route('**/debug-render-style.ts',async route=>{
    const response=await route.fetch(),source=await response.text();
    const observed=source.replace('let disposed = false','globalThis.feedbackView = { scene, camera }; let disposed = false');
    assert.notEqual(observed,source);await route.fulfill({response,body:observed});
  });
  await page.goto(`${base}/scene-review?scene=korean-sotdae`);
  await page.locator('.library-scene-stage[data-ready="true"]').waitFor();
  const pointer=await scenePointer(page,true);
  const pickup=await page.locator('[data-cue-role="source"]:not([hidden])').first().evaluate(el=>{const r=el.parentElement.getBoundingClientRect();return [r.left+Number(el.dataset.x),r.top+Number(el.dataset.y)]});
  await pointer.down(pickup);await pointer.up();await page.locator('[data-close-inspection="viewing"]').waitFor();
  for(const [dx,dy] of [[32,0],[-32,0],[0,22],[0,-22]]) {
    const before=await page.evaluate(async()=>{
      const url=performance.getEntriesByType('resource').map(e=>e.name).find(n=>/\/three\.js\?/.test(n));
      const {Box3,Vector3}=await import(url),{scene,camera}=window.feedbackView;
      const center=new Box3().setFromObject(scene.getObjectByName('sotdae-pole'),true).getCenter(new Vector3());
      window.feedbackSurface=center.clone().add(camera.position.clone().sub(center).normalize().multiplyScalar(.2));
      const surface=window.feedbackSurface.clone().project(camera),p=center.clone().project(camera),r=document.querySelector('.library-scene-stage canvas').getBoundingClientRect();
      return {surface:surface.toArray(),point:[r.left+(p.x+1)*r.width/2,r.top+(1-p.y)*r.height/2]};
    });
    await pointer.down(before.point);await pointer.move([before.point[0]+dx,before.point[1]+dy]);await pointer.up();
    const after=await page.evaluate(()=>window.feedbackSurface.clone().project(window.feedbackView.camera).toArray());
    if(dx)assert.ok((after[0]-before.surface[0])*dx>0,'viewed surface follows horizontal finger');
    if(dy)assert.ok((before.surface[1]-after[1])*dy>0,'viewed surface follows vertical finger');
  }
  assert.deepEqual(errors,[]);await page.screenshot({path:`${out}/sotdae-turn-direction.png`,fullPage:true});
  results.push({scene:'korean-sotdae',width:440,touch:true,manualScreenProjectionDirections:4});await page.close();
  const receipt=process.env.WBR_ROTATION_ONLY?'pending-fixes-rotation-browser':'pending-fixes-browser';
  await writeFile(`${out}/${receipt}.json`,JSON.stringify({checkedAt:new Date().toISOString(),results},null,2)+'\n');
  console.log(JSON.stringify(results,null,2));
}finally{await browser.close()}
