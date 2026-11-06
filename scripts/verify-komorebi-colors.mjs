import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { chromium } from 'playwright';

const base=process.env.WBR_URL || 'http://127.0.0.1:5197';
const fixture=JSON.parse(await readFile('assets/environments/komorebi/reference-colors.json','utf8'));
const out=path.resolve('artifacts/komorebi-calibration'); await mkdir(out,{recursive:true});
const executablePath=[process.env.WBR_CHROME,chromium.executablePath(),'C:/Program Files/Google/Chrome/Application/chrome.exe'].find(file=>file&&existsSync(file));
const browser=await chromium.launch({executablePath,headless:true,args:['--enable-unsafe-swiftshader','--no-proxy-server']});
const errors=[],report={ reference:fixture.source,styles:[],errors };
try {
  const page=await browser.newPage({viewport:{width:840,height:432}});
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  await page.goto(`${base}/scene-review?scene=woodfish`,{waitUntil:'domcontentloaded'});
  const moduleURL=file=>'/@fs/'+path.resolve(`packages/scene-runtime/src/${file}`).replaceAll('\\','/');
  for(const style of ['original','toon-soft']) {
    const url=await page.evaluate(async ({fixture,surfaceURL,styleURL,style})=>{
      const code=await(await fetch(surfaceURL)).text();
      const T=await import(code.match(/from\s+['"]([^'"]*three[^'"]*)['"]/)[1]);
      const {createKomorebiSurface}=await import(surfaceURL),{createRenderStyle}=await import(styleURL);
      const renderer=new T.WebGLRenderer({preserveDrawingBuffer:true});renderer.setPixelRatio(1);renderer.setSize(840,432);renderer.outputColorSpace=T.SRGBColorSpace;
      const scene=new T.Scene(),camera=new T.OrthographicCamera(-3.5,3.5,1.8,-1.8,.1,20);camera.position.z=6;camera.lookAt(0,0,0);
      const sky=new T.HemisphereLight();sky.color.setRGB(121/255,168/255,227/255);sky.groundColor.setRGB(37/255,62/255,87/255);sky.intensity=.64*Math.PI;sky.position.set(.2,1,.3);scene.add(sky);
      const sun=new T.DirectionalLight();sun.color.setRGB(1,241/255,220/255);sun.intensity=1.12*Math.PI;sun.position.set(-.5,1,.5);scene.add(sun);
      const owned=[];
      for(let row=0;row<fixture.normals.length;row++) for(let col=0;col<fixture.palette.length;col++) {
        const geometry=new T.PlaneGeometry(.9,.9);
        geometry.setAttribute('normal',new T.Float32BufferAttribute(Array(4).fill(fixture.normals[row]).flat(),3));
        geometry.setAttribute('color',new T.Float32BufferAttribute(Array(4).fill(fixture.palette[col]).flat(),3));
        const material=createKomorebiSurface();material.vertexColors=true;material.specular.setRGB(0,0,0);material.side=T.DoubleSide;
        const mesh=new T.Mesh(geometry,material);mesh.position.set((col-2.5)*1.1,(1-row)*1.1,0);scene.add(mesh);owned.push(mesh);
      }
      const pipeline=createRenderStyle(renderer,scene,camera);pipeline.setStyle(style);pipeline.setEnvironmentTone('komorebi');pipeline.render();
      if(pipeline.getStyle()!==style)throw Error('Color pipeline silently fell back');
      const result=renderer.domElement.toDataURL();pipeline.dispose();owned.forEach(mesh=>{mesh.geometry.dispose();mesh.material.dispose();});renderer.dispose();return result;
    },{fixture,surfaceURL:moduleURL('komorebi-surface.ts'),styleURL:moduleURL('render-style.ts'),style});
    const bytes=Buffer.from(url.split(',')[1],'base64');await writeFile(path.join(out,`swatches-${style}.png`),bytes);
    const {data,info}=await sharp(bytes).removeAlpha().raw().toBuffer({resolveWithObject:true});
    const samples=fixture.expected.map((_expected,i)=>{
      const col=i%6,row=Math.floor(i/6),x=Math.round((.75+col*1.1)/7*info.width),y=Math.round((.7+row*1.1)/3.6*info.height),at=(y*info.width+x)*3;
      return [...data.subarray(at,at+3)];
    });
    const errorsBySample=samples.map((sample,i)=>sample.map((channel,k)=>Math.abs(channel-fixture.expected[i][k])));
    const maxError=Math.max(...errorsBySample.flat());report.styles.push({style,samples,maxError});
    assert.ok(maxError<=fixture.tolerance,`${style}: source color error ${maxError}/255 exceeds ${fixture.tolerance}/255`);
  }
  assert.deepEqual(errors,[]);
} finally {
  await writeFile(path.join(out,'color-regression.json'),JSON.stringify(report,null,2)+'\n');
  await browser.close();
}
console.log(JSON.stringify(report,null,2));
