import { chromium } from 'playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

// Actual Chromium/WebGL verification. No mock Three renderer or source rewriting.
const root = process.cwd().replaceAll('\\', '/');
const base = process.env.WBR_URL || 'http://127.0.0.1:5173';
const out = path.resolve(root, process.env.OPTICS_OUT || 'artifacts/ritual-optics');
await mkdir(out, { recursive: true });
const source = await readFile(path.join(root, 'docs/research/2026-10-28-open-source-optics-materials.md'), 'utf8');
const mapping = source.split('## 对应全部 45 个候选场景')[1].split('## 接入前必须明确')[0];
const ids = [...mapping.matchAll(/\|[^\n]*\/ `([^`]+)`/g)].map(m => m[1]);
if (ids.length !== 45 || new Set(ids).size !== 45) throw Error(`Expected 45 unique scene IDs, got ${ids.length}`);
const representative = new Set(['furin-wind-chime', 'nanakusa-gayu', 'lantern', 'japanese-wagasa', 'yeondeunghoe', 'tibetan-prayer-flags', 'votive-candle-catholic', 'bai-indigo-cloth', 'rosh-hashanah-apple-honey', 'tibetan-water-bowls']);
const subset = process.argv.filter(arg=>arg.startsWith('--scene=')).map(arg=>arg.slice(8));
const sceneIds = subset.length ? ids.filter(id=>subset.includes(id)) : ids;
const completionProgress = id => id === 'tibetan-water-bowls' ? 9 : 3;
const bundledBrowser = chromium.executablePath();
const hostBrowser = bundledBrowser.replace(/AppData[/\\]Local[/\\]Packages[/\\][^/\\]+[/\\]AC[/\\]/, 'AppData/Local/');
const browser = await chromium.launch({ headless: true, executablePath: process.env.OPTICS_BROWSER_PATH || (existsSync(bundledBrowser) ? bundledBrowser : hostBrowser), args: ['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 720, height: 800 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', error => { errors.push({ type: 'pageerror', message: error.message }); console.error('PAGEERROR', error.message); });
page.on('console', msg => { if (msg.type() === 'error') { errors.push({ type: 'console', message: msg.text() }); console.error('CONSOLE', msg.text().slice(0, 400)); } });
await page.route('**/optics-verification', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head><style>body{margin:0;background:#e8dfcc;font-family:sans-serif}#stage{width:720px;height:720px;position:relative}canvas{width:100%;height:100%;display:block}.overlay{position:absolute;inset:0}.scene-object-cues{position:absolute;inset:0;pointer-events:none}</style></head><body><div id="stage"><canvas></canvas><div class="overlay"></div><div class="scene-object-cues"></div></div></body></html>' }));
await page.goto(`${base}/optics-verification`);
await page.evaluate(async root => {
  // Match the web host's EXPO_BASE_URL replacement for direct /@fs imports.
  window.process = { env: { EXPO_BASE_URL: '/' } };
  const file = p => `/@fs/${root}/${p}`;
  const styleURL = file('packages/scene-runtime/src/render-style.ts');
  const viteSource = await (await fetch(styleURL)).text();
  const threeURL = viteSource.match(/from\s+["']([^"']*three[^"']*)["']/)[1];
  const THREE = await import(threeURL);
  const { createRenderStyle } = await import(styleURL);
  const { createToonSurfaces } = await import(file('packages/scene-runtime/src/toon-surfaces.ts'));
  const { createRitualMaterial } = await import(file('packages/scene-runtime/src/ritual-optics.ts'));
  const { debugStyles } = await import(file('packages/scene-runtime/src/debug-styles.ts'));
  const { loadScene } = await import(file('packages/scenes/src/registry.ts'));
  const shared = await import(file('packages/shared/src/index.ts'));
  const gestures = await import(file('packages/gestures/src/index.ts'));
  debugStyles.enable();
  const probe = window.opticsProbe = { THREE, createRenderStyle, createToonSurfaces, createRitualMaterial, debugStyles, loadScene, shared, gestures, failures: [], renderers: new Set(), current: null };
  const instrument = renderer => {
    if (probe.renderers.has(renderer)) return;
    probe.renderers.add(renderer);
    let assigned = renderer.debug.onShaderError;
    const capture = (gl, program, vertex, fragment) => {
      const failure = { test: probe.current, program: gl.getProgramInfoLog(program), vertex: gl.getShaderInfoLog(vertex), fragment: gl.getShaderInfoLog(fragment), vertexSource: gl.getShaderSource(vertex), fragmentSource: gl.getShaderSource(fragment) };
      probe.failures.push(failure);
      console.error('OPTICS_SHADER_FAILURE', JSON.stringify({ test: failure.test, program: failure.program, vertex: failure.vertex, fragment: failure.fragment }));
      assigned?.(gl, program, vertex, fragment);
    };
    Object.defineProperty(renderer.debug, 'onShaderError', { configurable: true, get: () => capture, set: next => { if (next !== capture) assigned = next; } });
  };
  const render = THREE.WebGLRenderer.prototype.render;
  THREE.WebGLRenderer.prototype.render = function(...args) { instrument(this); return render.apply(this, args); };
  probe.instrument = instrument;
  // Three installs render on each instance, so scene-owned renderers cannot be
  // observed through WebGLRenderer.prototype. Capture their real GL contexts.
  probe.contexts = new Map();
  const getContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function(kind,attributes) {
    const gl = getContext.call(this,kind, /^webgl/.test(kind) ? {...attributes,preserveDrawingBuffer:true} : attributes);
    if(gl && /^webgl/.test(kind) && !probe.contexts.has(this)) {
      const programs=[]; probe.contexts.set(this,{gl,programs});
      const link=gl.linkProgram.bind(gl);
      gl.linkProgram=function(program){
        link(program); programs.push(program);
        if(!gl.getProgramParameter(program,gl.LINK_STATUS)) {
          const shaders=gl.getAttachedShaders(program)||[];
          const failure={test:probe.current,program:gl.getProgramInfoLog(program),shaders:shaders.map(s=>({log:gl.getShaderInfoLog(s),source:gl.getShaderSource(s)}))};
          probe.failures.push(failure); console.error('OPTICS_GL_LINK_FAILURE',JSON.stringify({test:failure.test,program:failure.program,logs:failure.shaders.map(s=>s.log)}));
        }
      };
    }
    return gl;
  };
  probe.pixels = renderer => {
    const gl = renderer.getContext(), w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
    const rgba = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, rgba);
    let occupied = 0, black = 0, colorful = 0;
    for (let i = 0; i < rgba.length; i += 4) {
      if (rgba[i+3] > 8) { occupied++; if (rgba[i]+rgba[i+1]+rgba[i+2] < 12) black++; else colorful++; }
    }
    const invalidPrograms = (renderer.info.programs || []).filter(p => !gl.getProgramParameter(p.program, gl.LINK_STATUS)).map(p => p.name);
    return { width: w, height: h, occupied, black, colorful, invalidPrograms };
  };
  probe.scenePixels = canvas => {
    const context=probe.contexts.get(canvas);
    if(!context) throw Error('Scene never created a WebGL context');
    return probe.pixels({getContext:()=>context.gl,info:{programs:context.programs.filter(program=>context.gl.isProgram(program)).map(program=>({program,name:'scene-program'}))}});
  };
}, root);
const partialRun = process.argv.includes('--scenes-only') || process.argv.includes('--profiles-only') || subset.length;
const previousReport = partialRun && existsSync(path.join(out,'report.json')) ? JSON.parse(await readFile(path.join(out,'report.json'),'utf8')) : undefined;
const report = { date: new Date().toISOString(), browser: await browser.version(), profiles: process.argv.includes('--scenes-only') ? previousReport?.profiles || [] : [], scenes: process.argv.includes('--profiles-only') ? previousReport?.scenes || [] : subset.length ? (previousReport?.scenes || []).filter(scene=>!subset.includes(scene.id)) : [], errors, limitations: 'Desktop headless Chromium SwiftShader WebGL; direct Vite module harness supplies the web host EXPO_BASE_URL="/"; no iPhone/WebView performance, FPS, or GPU timing claims.' };
try {
  if (!process.argv.includes('--scenes-only')) {
    for (const kind of ['paper','cloth','leaf','wax','jade','skin','fruit','glass','water','tea','honey','wet','paper-bands','paper-radial']) {
      const result = await page.evaluate(async kind => {
        const p = window.opticsProbe, T = p.THREE;
        p.current = { profile: kind };
        const oldCanvas = document.querySelector('canvas'), canvas = document.createElement('canvas'); oldCanvas.replaceWith(canvas);
        const renderer = new T.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
        renderer.setSize(384,384,false); renderer.shadowMap.enabled = true; p.instrument(renderer);
        const scene = new T.Scene();
        scene.add(new T.AmbientLight(0xffffff,.5), new T.HemisphereLight(0xffeacc,0x575c88,.7));
        for (const light of [new T.DirectionalLight(0xffe6c8,3), new T.PointLight(0x80b5ff,12), new T.SpotLight(0xffffff,8)]) {
          light.position.set(-2,3,3); light.castShadow = true; light.shadow.mapSize.set(128,128); scene.add(light);
        }
        const structure = kind === 'paper-bands' ? {layout:'bands',spacing:.085,width:.13,contrast:.6,halfHeight:.7}
          : kind === 'paper-radial' ? {layout:'radial',spacing:Math.PI/12,width:.1,contrast:.48} : undefined;
        const material = p.createRitualMaterial({color: kind === 'glass' ? 0xb8e5ed : kind === 'honey' ? 0xb36b12 : 0xdc8a51, side:T.DoubleSide}, {kind:structure?'paper':kind,...(structure?{paper:structure}: {})});
        const geom = new T.SphereGeometry(.7,20,16); geom.deleteAttribute('uv');
        const mesh = new T.Mesh(geom,material); mesh.position.x=-.7; mesh.castShadow=true; mesh.receiveShadow=true; scene.add(mesh);
        const arrayGeom = new T.BoxGeometry(.8,.8,.8); arrayGeom.deleteAttribute('uv');
        const arrayMesh = new T.Mesh(arrayGeom,[material,material,material,material,material,material]); arrayMesh.position.x=.8; arrayMesh.castShadow=true; arrayMesh.receiveShadow=true; scene.add(arrayMesh);
        const ground = new T.Mesh(new T.PlaneGeometry(8,8),new T.MeshStandardMaterial({color:0xe9dcc4})); ground.rotation.x=-Math.PI/2; ground.position.y=-.8; ground.receiveShadow=true; scene.add(ground);
        const camera = new T.PerspectiveCamera(42,1,.1,30); camera.position.set(0,1.5,5); camera.lookAt(0,0,0);
        const style = p.createRenderStyle(renderer,scene,camera), results=[];
        try {
          for (const preset of ['original','toon-soft','toon-ink','gouache']) {
            p.current={profile:kind,style:preset};
            if(preset==='original') renderer.compile(scene,camera);
            else { const surfaces=p.createToonSurfaces(preset), frame=surfaces.apply(scene); try{renderer.compile(scene,camera);}finally{frame.restore();surfaces.dispose();} }
            style.setStyle(preset); style.render(); style.render();
            results.push({style:preset,actual:style.getStyle(),...p.pixels(renderer)});
          }
          return {kind,revision:T.REVISION,results};
        } finally { style.dispose(); material.dispose(); geom.dispose(); arrayGeom.dispose(); ground.geometry.dispose(); ground.material.dispose(); renderer.dispose(); renderer.forceContextLoss(); }
      }, kind);
      report.profiles.push(result);
      console.log('PROFILE', kind, result.results.map(r => `${r.style}:${r.actual}/${r.invalidPrograms.length}`).join(' '));
      await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));
    }
    await writeFile(path.join(out,'profile-shader-errors.json'), JSON.stringify(await page.evaluate(() => window.opticsProbe.failures),null,2));
  }
  if (!process.argv.includes('--profiles-only')) {
    for (const id of sceneIds) for (const progress of [0,1,completionProgress(id)]) {
      const result = await page.evaluate(async ({id,progress}) => {
        const p=window.opticsProbe;
        p.current={scene:id,progress};
        const stage=document.querySelector('#stage');
        stage.innerHTML='<canvas></canvas><div class="overlay"></div><div class="scene-object-cues"></div>';
        const canvas=stage.querySelector('canvas'),overlay=stage.querySelector('.overlay');
        const before=new Set(p.renderers), failuresBefore=p.failures.length;
        const mod=await p.loadScene(id);
        let active=true, instance;
        const callbacks=[], result={id,progress,stages:[]};
        try {
          instance=mod.create({canvas,overlay,shared:p.shared,gestures:p.gestures,sceneId:id,initialProgress:progress,isActive:()=>active,isReducedMotion:()=>true,isSoundEnabled:()=>false,stage:'day',deferWishWriting:true,onProgress:n=>callbacks.push(n)});
          instance.start();
          // Reduced motion settles authored state without waiting on decorative animation.
          for(let i=0;i<3;i++) instance.update(1/30);
          await new Promise(resolve=>setTimeout(resolve,100));
          for(let i=0;i<2;i++) instance.update(1/30);
          const renderers=[...p.renderers].filter(r=>!before.has(r));
          const renderer=renderers.find(r=>r.domElement===canvas);
          result.rendererCount=p.contexts.has(canvas)?1:0;
          result.environment=canvas.dataset.environment;
          for(const style of ['original','toon-soft']){
            p.current={scene:id,progress,style}; p.debugStyles.select(id,style);
            instance.update(1/30); instance.update(1/30);
            const actual=p.debugStyles.getSnapshot().find(e=>e.id===id)?.actual;
            result.stages.push({style,actual,...p.scenePixels(canvas)});
          }
          active=false; instance.update(1/30); active=true; instance.update(1/30);
          result.pauseResume=true; result.callbacks=callbacks;
          result.text=overlay.textContent?.slice(0,300);
          result.shaderErrors=p.failures.length-failuresBefore;
          window.opticsCurrent={instance,renderers};
        } catch(error){ result.error=String(error.stack||error); instance?.dispose(); renderersDispose(); }
        function renderersDispose(){for(const r of p.renderers)if(!before.has(r)){try{r.dispose();r.forceContextLoss();}catch{}}}
        return result;
      }, {id,progress});
      report.scenes.push(result);
      if (representative.has(id) && [1,completionProgress(id)].includes(progress) && !result.error) {
        await page.locator('canvas').screenshot({ path:path.join(out,`${id}-progress-${progress}.png`) });
      }
      await page.evaluate(() => { const current=window.opticsCurrent; current?.instance.dispose(); current?.renderers.forEach(r=>{r.dispose();r.forceContextLoss();}); window.opticsCurrent=null; });
      console.log('SCENE',id,progress,result.error?.slice(0,240)||result.stages.map(r=>`${r.style}:${r.actual}/${r.invalidPrograms?.length}`).join(' '));
      await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));
    }
  }
  report.shaderErrors=await page.evaluate(()=>window.opticsProbe.failures);
  const bad=[...report.profiles.flatMap(p=>p.results.map(r=>({id:p.kind,...r}))),...report.scenes.flatMap(p=>p.stages.map(r=>({id:p.id,progress:p.progress,...r})))].filter(r=>r.actual!==r.style || r.invalidPrograms?.length || (r.colorful!==undefined&&r.colorful===0));
  report.failures=bad;
  await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));
  const thumbs=[];
  for(const id of representative){
    const image=path.join(out,`${id}-progress-${id === 'japanese-wagasa' ? 1 : completionProgress(id)}.png`);
    try{const buffer=await sharp(image).resize(280,280,{fit:'contain',background:'#e8dfcc'}).extend({bottom:35,background:'#e8dfcc'}).composite([{input:Buffer.from(`<svg width="280" height="35"><text x="8" y="22" font-size="12">${id}</text></svg>`),top:280,left:0}]).png().toBuffer();thumbs.push({input:buffer,left:(thumbs.length%5)*280,top:Math.floor(thumbs.length/5)*315});}catch{}
  }
  if(thumbs.length)await sharp({create:{width:1400,height:Math.ceil(thumbs.length/5)*315,channels:3,background:'#e8dfcc'}}).composite(thumbs).png().toFile(path.join(out,'contact-sheet.png'));
  const summary=`# Ritual optics WebGL verification\n\n- Browser: ${report.browser}; Three revision ${report.profiles[0]?.revision||'not included in this run'}.\n- Profiles: ${report.profiles.length} × 4 styles, including no-UV geometry, material arrays, directional/point/spot shadows and physical glass.\n- Scene states: ${report.scenes.length} (${new Set(report.scenes.map(s=>s.id)).size} scenes × start/progress/restored completion), original and toon-soft, plus pause/resume.\n- Shader errors: ${report.shaderErrors.length}; failed/fallback/black frame checks: ${bad.length}; scene exceptions: ${report.scenes.filter(s=>s.error).length}; console/page errors: ${errors.length}.\n- ${report.limitations}\n\nDetailed evidence: ${path.relative(root,out).replaceAll('\\','/')}/report.json; representative images and contact-sheet.png.\n`;
  await writeFile(path.join(root,'.local-optics-webgl-report.md'),summary);
  console.log(summary);
  if(bad.length||report.shaderErrors.length||report.scenes.some(s=>s.error)||errors.length)process.exitCode=1;
} finally { await browser.close(); }
