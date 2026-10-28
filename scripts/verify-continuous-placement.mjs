import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';
import sharp from 'sharp';

// Real host Chromium input and WebGL, never a mocked renderer or rewritten scene.
// --scene=<id> selects fixtures; --retry keeps earlier failures in report.json.
// By default the two scenes still undergoing implementation are left for a later run.
const root = process.cwd().replaceAll('\\', '/');
const base = new URL(process.env.WBR_URL || 'http://127.0.0.1:5182');
const out = path.resolve(root, 'artifacts/continuous-placement-2026-10-28');
await mkdir(out, { recursive: true });
const all = [
  ...'alasita-miniature-house brat-bride-cloth chinese-fu-paper chinese-longevity-lock chinese-ruyi-scepter japanese-hamaya japanese-kadomatsu korean-sotdae lanna-sand-pagoda mochigase-nagashibina romanian-martisor pucara-rooftop-bulls shichigosan-chitose-ame turkish-nazar-bead scottish-first-footing'.split(' ').map(id => ({ id, kind: 'pure' })),
  ...'persian-esfand thai-songkran-elders tibetan-khata-greeting bulgarian-survakane greek-new-year-pomegranate greek-vasilopita'.split(' ').map(id => ({ id, kind: 'carry-first' })),
  ...'balinese-canang-sari chinese-steelyard'.split(' ').map(id => ({ id, kind: 'carry-last', constrained:true })),
  { id:'kameido-usokae',kind:'carry-last' },
  { id:'udo-undama',kind:'carry-first' }, { id:'japanese-wagasa',kind:'umbrella' },
  { id: 'tibetan-prayer-flags', kind: 'flags' }, { id: 'czech-bead-star', kind: 'star' },
];
const selected = process.argv.filter(a => a.startsWith('--scene=')).map(a => a.slice(8));
const previous = existsSync(path.join(out, 'report.json')) ? JSON.parse(await readFile(path.join(out, 'report.json'), 'utf8')) : { attempts: [] };
const retry = process.argv.includes('--retry');
const retryIds = [...new Set((previous.attempts.at(-1)?.results || []).filter(r => r.error).map(r => r.id))];
const ids = selected.length ? selected : retry && retryIds.length ? retryIds : all.filter(f => process.argv.includes('--all') || !['scottish-first-footing', 'tibetan-prayer-flags','udo-undama','japanese-wagasa'].includes(f.id)).map(f => f.id);
const attempt = { number: previous.attempts.length + 1, capturedAt: new Date().toISOString(), base: base.href, results: [], ui: null, errors: [], shaderErrors: [],
  inputModes: 'Real reduced-motion setting for keyboard checkpoint checks; ordinary motion for old0 natural pointer movement/inspection and later substantive actions. App viewport uses its actual reduced-motion preference.',
  limitations: 'Desktop headless Chromium with SwiftShader; direct real scenes at desktop dimensions and a 390×844 App viewport. No native mobile performance, frame-rate, physical-device or cultural-fact certification.' };
previous.attempts.push(attempt);
attempt.sourceHashes=Object.fromEntries(await Promise.all([...ids.flatMap(id=>[`packages/scenes/src/${id}/scene.ts`,`packages/scenes/src/${id}/model.ts`].filter(file=>existsSync(path.join(root,file)))),'packages/scenes/src/free-placement-pointer.ts','packages/scenes/src/pose-placement.ts','packages/scenes/src/placement-inspection.ts'].map(async file=>[file,createHash('sha256').update(await readFile(path.join(root,file))).digest('hex')])));
const save = () => writeFile(path.join(out, 'report.json'), JSON.stringify(previous, null, 2) + '\n');
await save();
const bundled = chromium.executablePath(), host = bundled.replace(/AppData[/\\]Local[/\\]Packages[/\\][^/\\]+[/\\]AC[/\\]/, 'AppData/Local/');
const browser = await chromium.launch({ headless: true, executablePath: process.env.WBR_BROWSER_PATH || (existsSync(bundled) ? bundled : host),
  args: ['--no-proxy-server', '--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
attempt.browser = await browser.version();

function installGL() {
  window.__carryGL = { contexts: new Map(), failures: [], current: null };
  const get = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function(kind, attributes) {
    const gl = get.call(this, kind, /^webgl/.test(kind) ? { ...attributes, preserveDrawingBuffer: true } : attributes);
    if (gl && /^webgl/.test(kind) && !window.__carryGL.contexts.has(this)) {
      const programs = []; window.__carryGL.contexts.set(this, { gl, programs });
      const link = gl.linkProgram.bind(gl);
      gl.linkProgram = program => { link(program); programs.push(program); if (!gl.getProgramParameter(program, gl.LINK_STATUS)) window.__carryGL.failures.push({ current: window.__carryGL.current, log: gl.getProgramInfoLog(program), shaders: (gl.getAttachedShaders(program) || []).map(s => gl.getShaderInfoLog(s)) }); };
    }
    return gl;
  };
}
function observe(page, scope) {
  page.on('pageerror', e => { attempt.errors.push({scope,type:'pageerror',message:e.message}); console.error('PAGEERROR',scope,e.message); });
  page.on('console', m => { if(m.type()==='error'){attempt.errors.push({scope,type:'console',message:m.text()}); console.error('CONSOLE',scope,m.text().slice(0,300));} });
}
async function probe(page) {
  await page.evaluate(async root => {
    window.process ??= {env:{EXPO_BASE_URL:'/'}};
    const file = name => `/@fs/${root}/${name}`;
    const runtime = file('packages/scene-runtime/src/render-style.ts');
    const source = await (await fetch(runtime)).text();
    const THREE = await import(source.match(/from\s+["']([^"']*three[^"']*)["']/)[1]);
    const { loadScene } = await import(file('packages/scenes/src/registry.ts'));
    const shared = await import(file('packages/shared/src/index.ts')), gestures = await import(file('packages/gestures/src/index.ts'));
    const p = window.__carry = { THREE, loadScene, shared, gestures, scenes:new Set(), cameras:new Set(), instance:null, callbacks:[], complete:0, active:true };
    const add=THREE.Object3D.prototype.add;
    THREE.Object3D.prototype.add=function(...items){if(this.isScene)p.scenes.add(this);for(const item of items)if(item?.isScene)p.scenes.add(item);return add.apply(this,items);};
    const projection=THREE.PerspectiveCamera.prototype.updateProjectionMatrix;
    THREE.PerspectiveCamera.prototype.updateProjectionMatrix=function(...args){p.cameras.add(this);return projection.apply(this,args);};
    p.bind = (canvas, name) => {
      p.canvas=canvas;
      const candidates=[...p.scenes].filter(scene=>{let has=false;scene.traverse(o=>{if(o.userData.interactionCues?.length&&(!name||scene.getObjectByName(name)))has=true;});return has;});
      if(!candidates.length)throw Error('No real scene with interactionCues captured');
      p.scene=candidates.at(-1);
      p.camera=[...p.cameras].filter(c=>c.fov>=30&&c.fov<=45).at(-1);
      if(!p.camera)throw Error('No real main PerspectiveCamera captured');
      p.scene.updateMatrixWorld(true);p.camera.updateMatrixWorld(true);
    };
    p.tick = (count=1) => {for(let n=0;n<count;n++)p.instance?.update(1/20);p.scene?.updateMatrixWorld(true);p.camera?.updateMatrixWorld(true);};
    p.project = value => {const v=value.clone().project(p.camera),r=p.canvas.getBoundingClientRect();return{x:r.left+(v.x+1)*r.width/2,y:r.top+(1-v.y)*r.height/2,z:v.z};};
    p.cues = () => {const result=[];p.scene.updateMatrixWorld(true);p.camera.updateMatrixWorld(true);p.scene.traverse(object=>{for(const cue of object.userData.interactionCues||[])if(cue.enabled()){const world=object.localToWorld(new THREE.Vector3(...(cue.anchor||[0,0,0])));const dest=typeof cue.destination==='function'?cue.destination():cue.destination?.getWorldPosition(new THREE.Vector3());result.push({object,cue,world,dest});}});return result;};
    p.info = () => p.cues().map(({object,cue,world,dest})=>({name:object.name,kind:cue.kind,label:cue.label,anchor:p.project(world),destination:dest?p.project(dest):null,world:world.toArray(),destWorld:dest?.toArray(),direction:cue.direction}));
    p.transforms = () => {const result={};p.scene.traverse(o=>{result[o.uuid]={name:o.name,position:o.position.toArray(),quaternion:o.quaternion.toArray(),worldQuaternion:o.getWorldQuaternion(new THREE.Quaternion()).toArray(),scale:o.scale.toArray()};});return result;};
    p.hit = () => {
      const entry=p.cues()[p.cueIndex||0];if(!entry)throw Error('No enabled cue');
      const center=p.project(entry.world),r=p.canvas.getBoundingClientRect(),ray=new THREE.Raycaster(),meshes=[];
      p.scene.traverseVisible(o=>{if(!o.isMesh)return;const mats=Array.isArray(o.material)?o.material:[o.material];if(mats.some(m=>m.visible&&(!m.transparent||m.opacity>=.5)))meshes.push(o);});
      const belongs=(o,parent)=>{for(let n=o;n;n=n.parent)if(n===parent)return true;return false;};
      const candidates=[{x:center.x,y:center.y}];for(const radius of [3,7,12,18,26,36])for(let n=0;n<12;n++)candidates.push({x:center.x+Math.cos(n*Math.PI/6)*radius,y:center.y+Math.sin(n*Math.PI/6)*radius});
      for(const point of candidates){if(point.x<r.left||point.x>r.right||point.y<r.top||point.y>r.bottom)continue;ray.setFromCamera(new THREE.Vector2((point.x-r.left)/r.width*2-1,1-(point.y-r.top)/r.height*2),p.camera);const first=ray.intersectObjects(meshes,false)[0];if(first&&belongs(first.object,entry.object))return{...point,hit:first.object.name,anchor:center};}
      // An anchor on a small child may be occluded by the same movable object;
      // keep the natural cue location and let actual scene input accept/reject it.
      return{...center,hit:null,anchor:center};
    };
    p.state = () => ({callbacks:[...p.callbacks],complete:p.complete,cues:p.info(),transforms:p.transforms(),hint:p.canvas.parentElement.querySelector('.scene-hint')?.textContent,button:p.canvas.parentElement.querySelector('.scene-bow-tap')?.textContent});
    p.pixels = () => {const e=window.__carryGL.contexts.get(p.canvas);if(!e)throw Error('No actual GL context');const {gl,programs}=e,w=gl.drawingBufferWidth,h=gl.drawingBufferHeight,a=new Uint8Array(w*h*4);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,a);let visible=0,sum=0,square=0;for(let i=0;i<a.length;i+=4)if(a[i+3]>8){visible++;const v=(a[i]+a[i+1]+a[i+2])/3;sum+=v;square+=v*v;}const debug=gl.getExtension('WEBGL_debug_renderer_info');return{threeRevision:THREE.REVISION,renderer:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),width:w,height:h,visible,mean:sum/visible,variance:square/visible-(sum/visible)**2,invalidPrograms:programs.filter(v=>gl.isProgram(v)&&!gl.getProgramParameter(v,gl.LINK_STATUS)).length};};
  },root);
}
async function mount(page, fixture, initial) {
  await page.evaluate(async ({fixture,initial})=>{
    const p=window.__carry;p.instance?.dispose();p.scenes.clear();p.cameras.clear();p.callbacks=[];p.complete=0;p.active=true;p.reduced=initial>0;p.id=fixture.id;p.cueIndex=0;
    const stage=document.querySelector('#stage');stage.innerHTML='<canvas></canvas><div class="overlay"></div>';
    const canvas=stage.querySelector('canvas'),overlay=stage.querySelector('.overlay');
    overlay.addEventListener('scene:complete',()=>p.complete++);
    window.__carryGL.current={id:fixture.id,initial};
    const mod=await p.loadScene(fixture.id);
    p.instance=mod.create({canvas,overlay,shared:p.shared,gestures:p.gestures,sceneId:fixture.id,initialProgress:initial,isActive:()=>p.active,isReducedMotion:()=>p.reduced,isSoundEnabled:()=>false,deferWishWriting:true,stage:'day',onProgress:n=>p.callbacks.push(n)});
    p.instance.start();p.bind(canvas);p.tick(2);
  },{fixture,initial});
  await page.waitForTimeout(100);
  await page.evaluate(()=>window.__carry.tick(2));
  await page.waitForFunction(()=>!window.__carry.canvas.dataset.environment||window.__carry.canvas.dataset.environmentReady==='true',undefined,{timeout:90000});
  const state=await page.evaluate(()=>window.__carry.state());assert.deepEqual(state.callbacks,[],'checkpoint restoration is silent');assert.equal(state.complete,0,'checkpoint restoration never completes');return state;
}
const changes = (before,after) => Object.entries(after).flatMap(([id,value])=>{const old=before[id];if(!old)return[];const distance=Math.hypot(...value.position.map((n,i)=>n-old.position[i]));const angle=2*Math.acos(Math.min(1,Math.abs(value.quaternion.reduce((s,n,i)=>s+n*old.quaternion[i],0))));return distance>1e-6||angle>1e-6?[{id,name:value.name,distance,angle,from:old,to:value}]:[];});
const state = page => page.evaluate(()=>window.__carry.state());
async function tick(page,n=2){await page.evaluate(n=>{const p=window.__carry;p.tick(n);if(n>1){const button=p.canvas.parentElement.querySelector('.scene-bow-tap');let extra=0;while(button?.disabled&&!button.hidden&&extra++<180)p.tick(1);if(extra>=180)throw Error('Actual scene remains busy after 10 seconds of simulated frame time');}},n);await page.waitForTimeout(20);}
async function shot(page,name){const file=`attempt-${attempt.number}-${name}.png`;await page.locator('canvas').first().screenshot({path:path.join(out,file)});return file;}
async function keyAction(page){const btn=page.locator('.scene-bow-tap');await btn.focus();await btn.press('Enter');await tick(page);}
async function dragGoal(page, record, label) {
  const cue=(await state(page)).cues[await page.evaluate(()=>window.__carry.cueIndex||0)];if(!cue)throw Error(`${label}: missing cue`);
  const hit=await page.evaluate(()=>window.__carry.hit());
  const dx=cue.destination?cue.destination.x-cue.anchor.x:(cue.direction?.[0]??0)*95;
  const dy=cue.destination?cue.destination.y-cue.anchor.y:(cue.direction?.[1]??-1)*95;
  const route=await page.evaluate(()=>{
    const p=window.__carry;if(p.id!=='scottish-first-footing')return null;
    const T=p.THREE,coal=p.scene.getObjectByName('first-foot-coal'),entry=p.cues()[0],position=coal.getWorldPosition(new T.Vector3()),offset=entry.world.clone().sub(position);
    const coalBox=new T.Box3().setFromObject(coal),door=new T.Box3().setFromObject(p.scene.getObjectByName('door-post-left')),hearth=new T.Box3().setFromObject(p.scene.getObjectByName('hearth-right'));
    // The yawed lump needs its real depth clearance between the jamb and the
    // hearth side. A canonical unrotated centerline can clip a rotated corner.
    const lower=hearth.max.z-(coalBox.min.z-position.z)+.001,upper=door.min.z-(coalBox.max.z-position.z)-.001;
    if(lower>upper)throw Error('Inspected coal is too wide for the measured doorway/hearth corridor');
    const passageZ=(lower+upper)/2;
    return[[.45,.5,.85],[.45,.5,.40],[.45,.5,passageZ],[-.75,.5,passageZ],[-.75,.5,-.65]].map(point=>{const world=new T.Vector3(...point);coal.parent.localToWorld(world);world.add(offset);return{world:world.toArray(),screen:p.project(world),passageClearance:[lower,upper]};});
  });
  await page.mouse.move(hit.x,hit.y);await page.mouse.down();
  if(route)for(const point of route)await page.mouse.move(point.screen.x+hit.x-cue.anchor.x,point.screen.y+hit.y-cue.anchor.y,{steps:12});
  else await page.mouse.move(hit.x+dx,hit.y+dy,{steps:16});
  await page.mouse.up();await tick(page);
  const after=await state(page);record.push({kind:label,hit,cue,route,after:after.callbacks,complete:after.complete});return after;
}
async function inspectCarry(page, record, label, capture=false) {
  const original=await state(page),cue=original.cues[0],pick=await page.evaluate(()=>window.__carry.hit());
  const dx=(cue.destination?.x??cue.anchor.x+1)-cue.anchor.x,dy=(cue.destination?.y??cue.anchor.y)-cue.anchor.y;
  // Lift upwards into view rather than pushing a flat ornament below its rest.
  const liftX=Math.hypot(dx,dy+45)<30?-45:0,liftY=-45;
  await page.mouse.move(pick.x,pick.y);await page.mouse.down();await page.mouse.move(pick.x+liftX,pick.y+liftY,{steps:7});await page.mouse.up();await tick(page,1);
  const before=await state(page);assert.deepEqual(before.callbacks,original.callbacks,`${label}: intermediate pickup release never advances`);assert.ok(changes(original.transforms,before.transforms).some(d=>d.distance>.001),`${label}: the actual object was picked up and moved`);
  record.push({kind:'picked-up-and-parked',callbacks:before.callbacks,image:capture?await shot(page,`${label}-picked-up`):null});
  const hit=await page.evaluate(()=>window.__carry.hit());
  // Shift+native mouse drag only rotates, even if the cursor crosses a goal.
  await page.keyboard.down('Shift');await page.mouse.move(hit.x,hit.y);await page.mouse.down();await page.mouse.move(hit.x+35,hit.y+14,{steps:8});await page.mouse.up();await page.keyboard.up('Shift');
  await tick(page,1);const rotated=await state(page),delta=changes(before.transforms,rotated.transforms);
  assert.deepEqual(rotated.callbacks,before.callbacks,`${label}: rotation cannot advance`);assert.equal(rotated.complete,before.complete,`${label}: rotation cannot complete`);
  assert.ok(delta.some(d=>d.angle>.01),`${label}: actual object quaternion changes`);
  if(['persian-esfand','thai-songkran-elders','tibetan-khata-greeting'].includes(label)){
    const name={'persian-esfand':'esfand-pan-root','thai-songkran-elders':'songkran-cup-root','tibetan-khata-greeting':'khata-scarf'}[label];
    const change=delta.find(d=>d.name===name);assert.ok(change,`${label}: held support rotates`);
    const yaw=await page.evaluate(({a,b})=>{const T=window.__carry.THREE,q=new T.Quaternion().fromArray(b).multiply(new T.Quaternion().fromArray(a).invert());return q.toArray();},{a:change.from.worldQuaternion,b:change.to.worldQuaternion});
    assert.ok(Math.abs(yaw[0])<1e-6&&Math.abs(yaw[2])<1e-6,`${label}: constrained inspection stays horizontal`);record.push({kind:'horizontal-inspection',deltaWorldQuaternion:yaw});
  }
  const image=capture?await shot(page,`${label}-inspection`):null;
  // A release retains the view, and a new native pointer grab can reach the goal.
  await tick(page,1);const parked=await state(page);assert.ok(changes(before.transforms,parked.transforms).some(d=>d.angle>.01),`${label}: inspection release retains view`);
  record.push({kind:'shift-inspect-release',callbacks:rotated.callbacks,changes:delta,image});
  // The scene has no pointer owner now. Esc must still recover the canonical
  // pose, rather than treating the previously rotated pose as a new home.
  const primary=delta.filter(d=>d.angle>.01).sort((a,b)=>b.angle-a.angle)[0];
  const button=page.locator('.scene-bow-tap');await button.focus();await button.press('Escape');await tick(page,1);
  const reset=await state(page);assert.deepEqual(reset.callbacks,original.callbacks,`${label}: Esc never advances`);
  const canonical=original.transforms[primary.id],restored=reset.transforms[primary.id];
  assert.ok(Math.hypot(...restored.position.map((v,i)=>v-canonical.position[i]))<1e-5,`${label}: ownerless Esc restores canonical position`);
  assert.ok(Math.abs(restored.quaternion.reduce((sum,v,i)=>sum+v*canonical.quaternion[i],0))>1-1e-8,`${label}: ownerless Esc restores canonical orientation`);
  await button.press('ArrowRight');await tick(page,1);const keyView=await state(page);assert.deepEqual(keyView.callbacks,original.callbacks,`${label}: fresh keyboard view never advances`);assert.ok(changes(reset.transforms,keyView.transforms).some(d=>d.angle>.01),`${label}: keyboard inspection rotates the actual object`);
  record.push({kind:'ownerless-escape-then-keyboard-view',callbacks:keyView.callbacks,canonicalRoot:primary.name});
  if(label==='scottish-first-footing'){await button.press('ArrowLeft');await tick(page,1);assert.deepEqual((await state(page)).callbacks,original.callbacks,'turning coal to fit the physical doorway never advances');record.push({kind:'fit-coal-orientation-to-doorway',note:'Yawed coal can exceed the measured corridor depth; a real counter-turn fits it between jamb and hearth side.'});}
  return dragGoal(page,record,'regrab-place');
}
async function constrainedCarry(page,record,label){const before=await state(page),hit=await page.evaluate(()=>window.__carry.hit());await page.mouse.move(hit.x,hit.y);await page.mouse.down();await page.mouse.move(hit.x,hit.y-45,{steps:7});await page.mouse.up();await tick(page,1);const parked=await state(page),moved=changes(before.transforms,parked.transforms);assert.deepEqual(parked.callbacks,before.callbacks,'constrained intermediate release never advances');assert.ok(moved.some(d=>d.distance>.001),'constrained carry actually moves');assert.ok(!moved.some(d=>d.angle>.001),'constrained carry preserves the authored orientation');record.push({kind:'constrained-pickup-and-park',callbacks:parked.callbacks,note:label==='balinese-canang-sari'?'Offering directions stay fixed.':'The balance mechanism stays upright.'});await page.evaluate(()=>{const p=window.__carry;p.active=false;p.tick(1);p.active=true;p.tick(1);});const reset=await state(page);assert.deepEqual(reset.callbacks,before.callbacks,'ownerless host pause stays silent');for(const d of moved.filter(d=>d.distance>.001)){const old=before.transforms[d.id],current=reset.transforms[d.id];assert.ok(Math.hypot(...current.position.map((v,i)=>v-old.position[i]))<1e-5,'ownerless constrained carry restores canonical position');}record.push({kind:'constrained-ownerless-pause-restore',callbacks:reset.callbacks});const again=await page.evaluate(()=>window.__carry.hit());await page.mouse.move(again.x,again.y);await page.mouse.down();await page.mouse.move(again.x,again.y-45,{steps:7});await page.mouse.up();await tick(page,1);assert.deepEqual((await state(page)).callbacks,before.callbacks,'a fresh lift after interruption remains uncommitted');return dragGoal(page,record,'constrained-regrab-place');}
const expected=(fixture,initial)=>fixture.kind==='pure'?[3]:fixture.kind==='carry-first'?(initial<2?[2,3]:[3]):fixture.kind==='carry-last'||fixture.kind==='flags'?(initial===0?[1,3]:[3]):fixture.kind==='umbrella'?[...(initial===0?[2]:[]),3]:initial===0?[2,3]:[3];
const captures=new Set(['turkish-nazar-bead','romanian-martisor','persian-esfand','chinese-fu-paper','tibetan-khata-greeting','czech-bead-star']);
async function fixtureCase(page,fixture,initial){
  const result={id:fixture.id,kind:fixture.kind,initial,events:[],expected:expected(fixture,initial)};
  try{
    let restored=await mount(page,fixture,initial);result.restored={callbacks:restored.callbacks,complete:restored.complete,cues:restored.cues,button:restored.button};
    if(initial===0){
      result.keyboardZero=[];
      await page.evaluate(()=>{window.__carry.reduced=true;});
      for(let n=0;n<result.expected.length;n++){await keyAction(page);const after=await state(page);assert.deepEqual(after.callbacks,result.expected.slice(0,n+1),'keyboard old0 follows only actual interaction nodes');result.keyboardZero.push({callbacks:after.callbacks,complete:after.complete,cues:after.cues});}
      assert.equal((await state(page)).complete,1,'keyboard old0 completes once');restored=await mount(page,fixture,initial);
    }
    if(initial===0&&captures.has(fixture.id))result.startImage=await shot(page,`${fixture.id}-start`);
    if(initial===0&&fixture.kind!=='flags'&&fixture.kind!=='star'&&fixture.kind!=='umbrella'){
      if(fixture.kind==='carry-last'){
        const first=await dragGoal(page,result.events,'distinct-first-action');assert.deepEqual(first.callbacks,[1],'distinct first action remains checkpoint 1');assert.equal(first.complete,0);
      }
      const placed=fixture.constrained?await constrainedCarry(page,result.events,fixture.id):await inspectCarry(page,result.events,fixture.id,captures.has(fixture.id));
      if(fixture.kind==='carry-first'){assert.deepEqual(placed.callbacks,[2],'continuous carry stops before substantive final action');assert.equal(placed.complete,0,'carry alone never completes a partial ritual');assert.ok(placed.cues.length,'substantive final cue remains');result.substantiveBefore=placed.cues;await dragGoal(page,result.events,'substantive-final-action');}
      if(fixture.id==='turkish-nazar-bead')result.touch=await blueCircle(page,result);
    }else if(initial===0&&fixture.kind==='umbrella'){
      const opened=await dragGoal(page,result.events,'open-umbrella');assert.deepEqual(opened.callbacks,[2],'opening jumps directly to optional viewing checkpoint 2');assert.equal(opened.complete,0);
      const hit=await page.evaluate(()=>window.__carry.hit()),before=await state(page);await page.keyboard.down('Shift');await page.mouse.move(hit.x,hit.y);await page.mouse.down();await page.mouse.move(hit.x+45,hit.y+20,{steps:8});await page.mouse.up();await page.keyboard.up('Shift');await tick(page,1);const viewed=await state(page);assert.deepEqual(viewed.callbacks,[2],'optional umbrella yaw never reports progress');assert.ok(changes(before.transforms,viewed.transforms).some(d=>d.angle>.01),'actual opened canopy turns');result.events.push({kind:'optional-umbrella-yaw',callbacks:viewed.callbacks});
      await page.evaluate(()=>{window.__carry.cueIndex=1;});await dragGoal(page,result.events,'close-umbrella');
    }else if(initial===0&&fixture.kind==='flags'){
      const left=await dragGoal(page,result.events,'left-end-carry');assert.deepEqual(left.callbacks,[1],'first endpoint alone remains incomplete');assert.equal(left.complete,0);assert.ok(left.cues.length,'the separate right endpoint remains available');
      await dragGoal(page,result.events,'right-end-carry');
    }else if(initial===0&&fixture.kind==='star'){
      const assembled=await dragGoal(page,result.events,'assemble');assert.deepEqual(assembled.callbacks,[2],'assembly jumps to viewing checkpoint 2');
      const hit=await page.evaluate(()=>window.__carry.hit());const before=await state(page);await page.mouse.move(hit.x,hit.y);await page.mouse.down();await page.mouse.move(hit.x+80,hit.y,{steps:10});await page.mouse.up();await tick(page,1);assert.deepEqual((await state(page)).callbacks,before.callbacks,'free star viewing cannot finish');result.events.push({kind:'free-star-view',image:await shot(page,`${fixture.id}-inspection`)});
      const again=await page.evaluate(()=>window.__carry.hit());await page.mouse.click(again.x,again.y);await tick(page);
    }else{
      const btn=page.locator('.scene-bow-tap');await btn.focus();
      if(fixture.kind!=='flags'&&fixture.kind!=='star'){
        const before=await state(page);await btn.press('ArrowRight');await tick(page,1);assert.deepEqual((await state(page)).callbacks,before.callbacks,'keyboard inspection never advances');
      }
      for(let n=0;n<result.expected.length;n++){await keyAction(page);const after=await state(page);result.events.push({kind:'keyboard-enter',callbacks:after.callbacks,complete:after.complete,cues:after.cues});}
    }
    const final=await state(page);assert.deepEqual(final.callbacks,result.expected,'only actual new interaction nodes report progress');assert.equal(final.complete,1,'exactly one completion after the actual final action');result.actual=final.callbacks;result.complete=final.complete;result.pixels=await page.evaluate(()=>window.__carry.pixels());assert.ok(result.pixels.visible>300,'real nonblank scene pixels');assert.ok(result.pixels.variance>3,'real scene has spatial detail');assert.equal(result.pixels.invalidPrograms,0);
    if(initial===0&&captures.has(fixture.id))result.finalImage=await shot(page,`${fixture.id}-final`);
    console.log('PASS',fixture.id,initial,JSON.stringify(final.callbacks));
  }catch(error){result.error=error.message;result.stack=error.stack;result.failureState=await state(page).catch(()=>null);result.failureImage=await shot(page,`${fixture.id}-${initial}-failure`).catch(()=>null);console.error('FAIL',fixture.id,initial,error.message);}
  attempt.results.push(result);await save();return result;
}
async function blueCircle(page,result){
  // Mount a fresh object after the generic drag test so both complete circles
  // precede a real final hang, without changing or rewinding any scene state.
  const fixture={id:'turkish-nazar-bead',kind:'pure'};await mount(page,fixture,0);
  const evidence={mouse:[],touch:[]};
  let hit=await page.evaluate(()=>window.__carry.hit());
  const before=await state(page);await page.mouse.move(hit.x,hit.y);await page.mouse.down();await page.mouse.move(hit.x,hit.y-35,{steps:6});await page.mouse.up();await tick(page,1);
  assert.deepEqual((await state(page)).callbacks,[],'lifting to an intermediate place remains uncommitted');evidence.liftImage=await shot(page,'turkish-nazar-bead-picked-up');
  hit=await page.evaluate(()=>window.__carry.hit());await page.keyboard.down('Shift');await page.mouse.move(hit.x,hit.y);await page.mouse.down();
  const full=2*Math.PI/.012;for(let n=1;n<=4;n++){await page.mouse.move(hit.x+full*n/4,hit.y,{steps:12});await tick(page,1);const s=await state(page);assert.deepEqual(s.callbacks,[]);const charm=Object.values(s.transforms).find(t=>t.name==='nazar-charm');evidence.mouse.push({quarter:n,quaternion:charm.quaternion,image:await shot(page,`turkish-nazar-bead-mouse-quarter-${n}`)});}
  await page.mouse.up();await page.keyboard.up('Shift');await tick(page,1);assert.deepEqual((await state(page)).callbacks,[]);
  hit=await page.evaluate(()=>window.__carry.hit());
  const cdp=await page.context().newCDPSession(page),touch=(x,y,id)=>({x,y,id,radiusX:1,radiusY:1,force:1});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[touch(hit.x-2,hit.y,1)]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[touch(hit.x-2,hit.y,1),touch(hit.x+2,hit.y,2)]});
  for(let n=1;n<=32;n++){const x=hit.x+full*n/32;await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[touch(x-2,hit.y,1),touch(x+2,hit.y,2)]});if(n%8===0){await tick(page,1);const s=await state(page);assert.deepEqual(s.callbacks,[],'two-finger full circle never reports progress');const charm=Object.values(s.transforms).find(t=>t.name==='nazar-charm');evidence.touch.push({quarter:n/8,quaternion:charm.quaternion,image:await shot(page,`turkish-nazar-bead-touch-quarter-${n/8}`)});}}
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[touch(hit.x+full-2,hit.y,1)]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();await tick(page,1);assert.deepEqual((await state(page)).callbacks,[],'inspection release never hangs');
  for(const input of ['mouse','touch']){
    let q=[0,0,0,1],travel=0;for(const sample of evidence[input]){const dot=Math.abs(q.reduce((s,n,i)=>s+n*sample.quaternion[i],0));travel+=2*Math.acos(Math.min(1,dot));q=sample.quaternion;}
    assert.ok(Math.abs(travel-2*Math.PI)<.005,`${input}: actual quarter-turn samples cover a complete optional circle`);evidence[`${input}AngularTravelRadians`]=travel;
    assert.ok(Math.abs(q[3])>.99999,`${input}: full circle returns to the original viewing orientation`);
  }
  const final=await dragGoal(page,result.events,'after-two-full-circles-regrab-hang');assert.deepEqual(final.callbacks,[3]);assert.equal(final.complete,1);
  evidence.geometry=await page.evaluate(()=>{const p=window.__carry,T=p.THREE,charm=p.scene.getObjectByName('nazar-charm'),bail=p.scene.getObjectByName('nazar-hanger-loop'),peg=p.scene.getObjectByName('nazar-peg');let top=-Infinity;for(let n=0;n<=512;n++)top=Math.max(top,bail.geometry.parameters.path.getPoint(n/512).y);const inner=charm.localToWorld(new T.Vector3(0,top-bail.geometry.parameters.radius,0));const pegBox=new T.Box3().setFromObject(peg);return{charmPosition:charm.getWorldPosition(new T.Vector3()).toArray(),charmQuaternion:charm.getWorldQuaternion(new T.Quaternion()).toArray(),bailInnerTop:inner.toArray(),pegTop:pegBox.max.y,pegSpan:[pegBox.min.x,pegBox.max.x],supportGap:inner.y-pegBox.max.y,loopWithinPegSpan:inner.x>=pegBox.min.x&&inner.x<=pegBox.max.x};});
  assert.ok(Math.abs(evidence.geometry.supportGap)<.003,'actual loop inner surface contacts actual peg top');assert.ok(evidence.geometry.loopWithinPegSpan,'peg passes through the actual bail span');evidence.finalImage=await shot(page,'turkish-nazar-bead-circles-then-hung');return evidence;
}

async function appUI(){
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,hasTouch:true,isMobile:true,locale:'zh-CN'});await context.addInitScript(installGL);
  await context.addInitScript(origin=>{if(location.origin===origin)localStorage.setItem('cyber-bless:personal:v1',JSON.stringify({version:1,sceneRecords:[],wishes:[],activeSession:null,sessions:[],collectibles:[],ledger:[],settings:{sound:false,haptics:false,reducedMotion:true}}));},base.origin);
  const page=await context.newPage();observe(page,'app');const result={viewport:{width:390,height:844}};
  try{await page.goto(base.href,{waitUntil:'domcontentloaded'});await page.locator('.app-shell[data-page="today"]').waitFor();await probe(page);await page.getByRole('button',{name:'我的',exact:true}).tap();await page.getByRole('button',{name:'场景目录',exact:true}).tap();await page.locator('.scene-search input').fill('turkish-nazar-bead');const card=page.locator('.scene-card[data-scene="turkish-nazar-bead"]');
    if(!await card.count()){result.catalogHidden=true;result.note='The ID is not a visible catalog entry; actual direct-scene pointer and touch cases are the interaction evidence.';}
    else{await card.tap();const stage=page.locator('.library-scene-stage[data-scene="turkish-nazar-bead"][data-ready="true"]');await stage.waitFor({timeout:90000});await page.waitForTimeout(400);await page.evaluate(()=>{const p=window.__carry;p.bind(document.querySelector('.library-scene-stage[data-scene="turkish-nazar-bead"] canvas'),'nazar-charm');});
      const help=page.locator('.scene-inspection-help');await help.waitFor({state:'visible'});assert.equal(await help.textContent(),'双指拖动可转看；鼠标用右键或 Shift 拖动。');const helpBox=await help.boundingBox();assert.ok(helpBox&&helpBox.x>=0&&helpBox.x+helpBox.width<=391&&helpBox.y+helpBox.height<=845,'mobile-sized visible inspection help fits inside the viewport');result.visibleHelp={text:await help.textContent(),bounds:helpBox};
      const before=await state(page),hit=await page.evaluate(()=>window.__carry.hit());result.initialHint=before.hint;await page.mouse.move(hit.x,hit.y);await page.mouse.down({button:'right'});await page.mouse.move(hit.x+50,hit.y,{steps:8});await page.mouse.up({button:'right'});await page.waitForTimeout(100);const after=await state(page);assert.ok(changes(before.transforms,after.transforms).some(d=>d.angle>.01),'App catalog right-drag changes actual bead view');assert.ok(after.cues.length,'App inspection remains interactive');result.inspectionImage=`attempt-${attempt.number}-app-blue-inspection.png`;await page.screenshot({path:path.join(out,result.inspectionImage)});
      const cue=after.cues[0],pick=await page.evaluate(()=>window.__carry.hit());await page.mouse.move(pick.x,pick.y);await page.mouse.down();await page.mouse.move(pick.x+cue.destination.x-cue.anchor.x,pick.y+cue.destination.y-cue.anchor.y,{steps:18});await page.mouse.up();await page.waitForTimeout(350);const final=await state(page);assert.equal(final.cues.length,0,'App drag completes directly without three mandatory stops');assert.match(final.hint,/已悬好/);result.finalHint=final.hint;result.completed=true;result.finalImage=`attempt-${attempt.number}-app-blue-hung.png`;await page.screenshot({path:path.join(out,result.finalImage)});result.pixels=await page.evaluate(()=>window.__carry.pixels());
    }
  }catch(error){result.error=error.message;result.stack=error.stack;result.failureImage=`attempt-${attempt.number}-app-failure.png`;await page.screenshot({path:path.join(out,result.failureImage)}).catch(()=>{});console.error('APP FAIL',error.message);}finally{attempt.ui=result;attempt.shaderErrors.push(...await page.evaluate(()=>window.__carryGL?.failures||[]).catch(()=>[]));await context.close();await save();}return result;
}
async function englishLayout(){
  const context=await browser.newContext({viewport:{width:320,height:568},deviceScaleFactor:1,hasTouch:true,isMobile:true,locale:'en-US'});await context.addInitScript(installGL);
  await context.addInitScript(origin=>{if(location.origin===origin)localStorage.setItem('cyber-bless:personal:v1',JSON.stringify({version:1,sceneRecords:[],wishes:[],activeSession:null,sessions:[],collectibles:[],ledger:[],settings:{sound:false,haptics:false,reducedMotion:true,locale:'en'}}));},base.origin);
  const page=await context.newPage();observe(page,'english-app-layout');const result={locale:'en',viewport:{width:320,height:568}};
  const scrolls=()=>page.evaluate(()=>[document.scrollingElement,...document.querySelectorAll('*')].filter((n,i,a)=>n&&a.indexOf(n)===i&&n.scrollHeight>n.clientHeight+1&&n.clientHeight>100).map(n=>({name:n.tagName+'.'+n.className,top:n.scrollTop,height:n.clientHeight,scrollHeight:n.scrollHeight})));
  try{
    await page.goto(base.href,{waitUntil:'domcontentloaded'});await page.locator('.app-shell[data-page="today"]').waitFor();await probe(page);await page.locator('.bottom-nav [data-tab="me"]').tap();await page.getByRole('button',{name:'Scene catalog',exact:true}).tap();await page.locator('.scene-search input').fill('turkish-nazar-bead');await page.locator('.scene-card[data-scene="turkish-nazar-bead"]').tap();await page.locator('.library-scene-stage[data-scene="turkish-nazar-bead"][data-ready="true"]').waitFor({timeout:90000});await page.waitForTimeout(350);
    await page.evaluate(()=>{const p=window.__carry;p.bind(document.querySelector('.library-scene-stage[data-scene="turkish-nazar-bead"] canvas'),'nazar-charm');});
    const help=page.locator('.scene-inspection-help');await help.waitFor({state:'visible'});const text=await help.textContent();assert.equal(text,'Drag with two fingers to turn and inspect. With a mouse, drag with the right button or hold Shift.');
    const canvas=page.locator('.library-scene-stage canvas'),canvasBox=await canvas.boundingBox(),helpBefore=await help.boundingBox();assert.ok(helpBefore.y>=canvasBox.y+canvasBox.height-1,'English helper is below the actual canvas');
    const initial=await scrolls();await page.mouse.move(310,390);await page.mouse.wheel(0,1000);await page.waitForTimeout(150);const wheel=await scrolls();
    const cdp=await context.newCDPSession(page),swipe=async(from,to)=>{const touch=y=>({x:310,y,id:1,radiusX:1,radiusY:1,force:1});await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[touch(from)]});for(let n=1;n<=12;n++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[touch(from+(to-from)*n/12)]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(250);};
    await swipe(480,150);const down=await scrolls();await swipe(150,480);const up=await scrolls();await cdp.detach();result.scroll={initial,wheel,down,up,gesture:'native CDP touch on the page margin outside the object canvas'};result.documentMetrics=await page.evaluate(()=>({height:document.documentElement.scrollHeight,clientHeight:document.documentElement.clientHeight,innerHeight,bodyHeight:document.body.scrollHeight,scrollY}));assert.ok(down.some((s,i)=>s.top>(initial[i]?.top??0)+1),'small English layout scrolls down');assert.ok(down.some((s,i)=>s.top>(up[i]?.top??0)+1),'small English layout scrolls back up');
    await help.scrollIntoViewIfNeeded();const helpBox=await help.boundingBox();assert.ok(helpBox.x>=0&&helpBox.x+helpBox.width<=321&&helpBox.y>=-1&&helpBox.y+helpBox.height<=569,'English helper fits when scrolled into view');result.helpImage=`attempt-${attempt.number}-app-english-320-help.png`;await page.screenshot({path:path.join(out,result.helpImage)});
    const action=page.locator('.library-scene-stage .scene-bow-tap');await action.scrollIntoViewIfNeeded();const actionBox=await action.boundingBox();assert.ok(actionBox.width>=44&&actionBox.height>=44,'auxiliary touch target is at least 44 by 44');assert.ok(actionBox.x>=0&&actionBox.x+actionBox.width<=321,'auxiliary button does not overflow horizontally');result.actionImage=`attempt-${attempt.number}-app-english-320-action.png`;await page.screenshot({path:path.join(out,result.actionImage)});
    const overflow=await page.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth,body:document.body.scrollWidth}));assert.ok(overflow.document<=321&&overflow.body<=321,'English mobile-sized page has no horizontal overflow');
    result.visibleHelp={text,bounds:helpBox,canvasBounds:canvasBox};result.actionBounds=actionBox;result.overflow=overflow;result.pixels=await page.evaluate(()=>window.__carry.pixels());result.passed=true;
  }catch(error){result.error=error.message;result.stack=error.stack;result.failureImage=`attempt-${attempt.number}-app-english-failure.png`;await page.screenshot({path:path.join(out,result.failureImage)}).catch(()=>{});console.error('ENGLISH APP FAIL',error.message);}finally{attempt.uiEnglish=result;attempt.shaderErrors.push(...await page.evaluate(()=>window.__carryGL?.failures||[]).catch(()=>[]));await context.close();await save();}return result;
}
async function contactSheet(){const representatives=['chinese-fu-paper','romanian-martisor','persian-esfand','tibetan-khata-greeting','czech-bead-star','turkish-nazar-bead'];const cells=[];let line=0;for(const id of representatives){const row=[...previous.attempts].reverse().flatMap(a=>a.results).find(r=>r.id===id&&r.initial===0);if(!row||row.error)continue;const images=[row.events.find(e=>e.kind==='picked-up-and-parked')?.image||row.touch?.liftImage||row.startImage,row.events.find(e=>e.kind==='shift-inspect-release'||e.kind==='free-star-view')?.image,row.touch?.finalImage||row.finalImage];for(let column=0;column<images.length;column++){if(!images[column])continue;const image=await sharp(path.join(out,images[column])).resize(320,320,{fit:'contain',background:'#e8dfcc'}).extend({bottom:38,background:'#e8dfcc'}).composite([{input:Buffer.from(`<svg width="320" height="38"><text x="7" y="18" font-size="11">${id}</text><text x="7" y="32" font-size="11">${['pick up','inspect','placed'][column]}</text></svg>`),top:320,left:0}]).png().toBuffer();cells.push({input:image,left:column*320,top:line*358});}line++;}if(cells.length)await sharp({create:{width:960,height:line*358,channels:3,background:'#e8dfcc'}}).composite(cells).png().toFile(path.join(out,'contact-sheet.png'));}

try{
  const context=await browser.newContext({viewport:{width:1040,height:800},deviceScaleFactor:1,hasTouch:true});await context.addInitScript(installGL);const page=await context.newPage();observe(page,'direct');
  await page.route('**/continuous-placement-verification',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><head><style>html,body{margin:0;background:#e8dfcc;font-family:sans-serif}#stage{width:580px;height:580px;position:relative}canvas{width:580px;height:580px;display:block}.overlay{position:absolute;inset:0;pointer-events:none}.scene-hit-layer{position:absolute;inset:0;pointer-events:auto;touch-action:none}.scene-title{position:absolute;left:12px;top:8px;pointer-events:none}.scene-hint{position:absolute;top:590px;left:12px;width:550px;line-height:1.5}.scene-step-dots{position:absolute;top:650px}.scene-bow-tap{position:absolute;top:690px;left:12px;pointer-events:auto;min-height:44px}.scene-object-cues{pointer-events:none;position:absolute;inset:0}.scene-cue-guides{display:none}</style></head><body><div id="stage"></div></body></html>'}));
  await page.goto(`${base.origin}/continuous-placement-verification`);await probe(page);
  if(!process.argv.includes('--ui-only'))for(const fixture of all.filter(f=>ids.includes(f.id)))for(const initial of [0,1,2])await fixtureCase(page,fixture,initial);
  attempt.shaderErrors.push(...await page.evaluate(()=>window.__carryGL.failures));await page.evaluate(()=>window.__carry.instance?.dispose());await context.close();
  if(ids.includes('turkish-nazar-bead')&&!process.argv.includes('--no-ui'))await appUI();
  if(process.argv.includes('--english-ui'))await englishLayout();
  await contactSheet();await save();
  const bad=attempt.results.filter(r=>r.error);console.log(JSON.stringify({attempt:attempt.number,cases:attempt.results.length,passed:attempt.results.length-bad.length,failed:bad.map(r=>[r.id,r.initial,r.error]),app:attempt.ui,shaderErrors:attempt.shaderErrors.length,pageErrors:attempt.errors.length},null,2));
  attempt.finishedAt=new Date().toISOString();attempt.status=bad.length||attempt.ui?.error||attempt.uiEnglish?.error||attempt.shaderErrors.length||attempt.errors.length?'failed':'passed';
  if(bad.length||attempt.ui?.error||attempt.uiEnglish?.error||attempt.shaderErrors.length||attempt.errors.length)process.exitCode=1;
}finally{await save();await browser.close();}
