import { build } from 'vite';
import path from 'node:path';
import { readFile, readdir, writeFile } from 'node:fs/promises';
const root = path.resolve('scripts');
const appRoot = path.resolve('apps/cyber-bless');
await build({ configFile: false, root, publicDir: false, define: { 'process.env.EXPO_BASE_URL': JSON.stringify('/') },
  build: { outDir: path.resolve('artifacts/icon-look-preview/site'), emptyOutDir: true,
    rollupOptions: { input: path.join(root, 'icon-look-preview.html'), output: { inlineDynamicImports: true } } },
});
const site = path.resolve('artifacts/icon-look-preview/site');
const files = await readdir(path.join(site, 'assets'));
const js = await readFile(path.join(site, 'assets', files.find(file => file.endsWith('.js'))), 'utf8');
let css = await readFile(path.join(site, 'assets', files.find(file => file.endsWith('.css'))), 'utf8');
const resources = {};
for (const id of ['omamori-cycle', 'woodfish', 'shrine-suzu-bell', 'furin-wind-chime'])
  resources[`/scene-icons/soft3d/${id}.webp`] = ['image/webp', (await readFile(path.join(appRoot, 'public/scene-icons/soft3d', `${id}.webp`))).toString('base64')];
for (const file of ['environments/kloppenheim-06-sky-1k.hdr', 'woodfish/blender-v2/woodfish.glb'])
  resources[`/${file}`] = ['application/octet-stream', (await readFile(path.join(appRoot, 'public', file))).toString('base64')];
const font = (await readFile(path.join(appRoot, 'public/fonts/noto-sans-sc.woff2'))).toString('base64');
css = css.replaceAll('/fonts/noto-sans-sc.woff2', `data:font/woff2;base64,${font}`);
const bootstrap = `const files=${JSON.stringify(resources)};globalThis.__iconLookAssets={};for(const [path,[type,base64]] of Object.entries(files)){const raw=atob(base64);const bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);globalThis.__iconLookAssets[path]=URL.createObjectURL(new Blob([bytes],{type}));}
function localAsset(url){try{const parsed=new URL(String(url),location.href);const path=parsed.protocol==='file:'&&parsed.pathname.charAt(2)===':'?parsed.pathname.slice(3):parsed.pathname;return globalThis.__iconLookAssets[path]||url}catch{return url}}
const nativeFetch=globalThis.fetch.bind(globalThis);globalThis.fetch=(input,options)=>nativeFetch(input instanceof Request?new Request(localAsset(input.url),input):localAsset(input),options);
const nativeOpen=XMLHttpRequest.prototype.open;XMLHttpRequest.prototype.open=function(method,url,...rest){return nativeOpen.call(this,method,localAsset(url),...rest)};`;
const standalone = `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>仪式小物 · 图标质感对照</title><style>${css}</style></head><body><main id="root"></main><script>${bootstrap}</script><script type="module">${js.replaceAll('</script', '<\\/script')}</script></body></html>`;
await writeFile(path.resolve('artifacts/icon-look-preview/仪式小物质感对比.html'), standalone);
console.log(`Standalone comparison: ${(Buffer.byteLength(standalone) / 1024 / 1024).toFixed(1)} MB, including real GLB and local assets.`);
