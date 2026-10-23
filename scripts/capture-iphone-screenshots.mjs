import { chromium } from 'playwright';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = fileURLToPath(new URL('../', import.meta.url));
const base = new URL(process.env.WBR_SCREENSHOT_URL ?? 'http://127.0.0.1:4198');
if (!['localhost','127.0.0.1'].includes(base.hostname)) throw Error('Capture only a local production preview');
const config = JSON.parse(await readFile(path.join(root,'store/ios/screenshot-sizes.json'),'utf8'));
const output = path.join(root,'store/screenshots/ios/zh-Hans');
const manifestFile = path.join(root,'store/screenshots/ios-sizes-manifest.json');
const sourceLabel = process.env.WBR_SCREENSHOT_SOURCE ?? 'Local production Web preview; browser capture, not native device or simulator';
const at = '2026-10-10T04:00:00.000Z';
const sample = { version:1, sceneRecords:[], wishes:[{id:'store-example-wish',title:'希望每天都从容一点',intention:'每天留一点时间给自己',category:'life',returnMethod:'kindness',status:'active',archived:false,createdAt:at,notes:[]}], activeSession:null, sessions:[{id:'store-example-session',ritual:'woodfish',progress:12,startedAt:at,completedAt:at}], collectibles:[{id:'store-example-woodfish',kind:'woodfish',title:'小木鱼',at}], ledger:[], settings:{sound:false,haptics:false,reducedMotion:true} };
const manifest = { capturedAt:new Date().toISOString(), source:sourceLabel, browser:'Microsoft Edge headless / real production Web UI', nativeStatusBar:false, sampleData:'Fictional local records; sample date 2026-10-10', specificationUrl:config.specificationUrl, groups:[] };
const browser = await chromium.launch({channel:process.env.WBR_SCREENSHOT_BROWSER ?? 'msedge',headless:true,args:['--enable-unsafe-swiftshader']});
async function describe(file, group) {
  const bytes = await readFile(file);
  const meta = await sharp(bytes).metadata();
  if (meta.width!==group.width || meta.height!==group.height || meta.hasAlpha) throw Error('Invalid screenshot format: '+file);
  return {file:path.relative(root,file).replaceAll('\\','/'),width:meta.width,height:meta.height,hasAlpha:false,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),md5:createHash('md5').update(bytes).digest('hex')};
}
try {
  for (const group of config.groups) {
    const record = {displayType:group.displayType,label:group.label,width:group.width,height:group.height,legacy:group.legacy ?? false,files:[]};
    if (group.existingFiles) {
      record.source = 'Preserved original production Web screenshots captured 2026-10-10';
      for (const name of group.existingFiles) record.files.push(await describe(path.join(output,name),group));
      manifest.groups.push(record);
      continue;
    }
    const directory = path.join(output,group.directory);
    await mkdir(directory,{recursive:true});
    const context = await browser.newContext({viewport:{width:group.width/group.scale,height:group.height/group.scale},deviceScaleFactor:group.scale,isMobile:true,hasTouch:true,colorScheme:'light',reducedMotion:'reduce',locale:'zh-CN',timezoneId:'Asia/Shanghai'});
    await context.addInitScript(({sample,at})=>{
      localStorage.setItem('cyber-bless:personal:v1',JSON.stringify(sample));
      const NativeDate=Date, instant=Date.parse(at);
      class SampleDate extends NativeDate { constructor(...args) { super(...(args.length ? args : [instant])); } static now() { return instant; } }
      window.Date=SampleDate;
    },{sample,at});
    const page = await context.newPage();
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    async function capture(view) {
      await page.evaluate(()=>document.fonts.ready);
      if (await page.evaluate(()=>document.documentElement.scrollWidth > innerWidth+1)) throw Error('Horizontal overflow in '+group.displayType+' '+view);
      if (errors.length) throw Error('Product render errors: '+errors.join('; '));
      const file=path.join(directory,view+'.png');
      const bytes=await page.screenshot({fullPage:false,animations:'disabled'});
      await sharp(bytes).removeAlpha().png().toFile(file);
      record.files.push(await describe(file,group));
    }
    await page.goto(base.href,{waitUntil:'networkidle'});
    await page.getByRole('heading',{name:'今日仪式',exact:true}).waitFor();
    await capture('01-today');
    await page.locator('[data-tab="wishes"]').click();
    await page.getByText(sample.wishes[0].title,{exact:true}).waitFor();
    await capture('02-wishes');
    await page.locator('[data-tab="today"]').click();
    await page.getByRole('button',{name:'开始今日仪式',exact:true}).click();
    await page.locator('[data-renderer="ready"]').waitFor({timeout:60000});
    await page.getByRole('progressbar').waitFor();
    await capture('03-woodfish');
    await page.getByRole('button',{name:'返回',exact:true}).click();
    await page.locator('[data-tab="world"]').click();
    await page.getByText('小木鱼',{exact:true}).first().waitFor();
    await capture('04-world');
    await page.locator('[data-tab="me"]').click();
    await page.getByRole('button',{name:'隐私政策',exact:true}).click();
    await page.locator('h1').filter({hasText:'隐私'}).waitFor();
    await capture('05-privacy');
    record.viewport={width:group.width/group.scale,height:group.height/group.scale,deviceScaleFactor:group.scale};
    record.source=sourceLabel;
    manifest.groups.push(record);
    await context.close();
    await writeFile(manifestFile,JSON.stringify(manifest,null,2)+'\n');
    console.log(`${group.displayType}: ${record.files.length} captured, ${group.width}x${group.height}`);
  }
} finally { await browser.close(); }
await writeFile(manifestFile,JSON.stringify(manifest,null,2)+'\n');
console.log(`Verified ${manifest.groups.length} groups / ${manifest.groups.reduce((n,g)=>n+g.files.length,0)} screenshots: ${manifestFile}`);
