import { build } from 'vite';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const phase = process.argv.includes('--baseline') ? 'before' : 'after';
const outDir = path.resolve('artifacts/icon-style-rollout', phase);
await build({ configFile: false, root: process.cwd(), publicDir: false, define: { 'process.env.EXPO_BASE_URL': JSON.stringify('/'), 'process.env.NODE_ENV': JSON.stringify('production') },
  build: { outDir, emptyOutDir: false, minify: true, lib: { entry: path.resolve('scripts/icon-style-audit-entry.ts'), formats: ['iife'], name: 'IconAudit', fileName: () => 'audit.js' }, rollupOptions: { output: { inlineDynamicImports: true } } },
});
await mkdir(outDir, { recursive: true });
await writeFile(path.join(outDir, 'index.html'), '<!doctype html><html><head><meta charset="UTF-8"><style>body{margin:0;background:#f5eddf}#stage{position:relative;width:100vw;height:100vh}canvas{display:block;width:100%;height:100%}.overlay{position:absolute;inset:0;pointer-events:none}.scene-title,.scene-step-dots,.scene-hint,.scene-bow-tap,.scene-wish-slot,.scene-cue-guides{display:none}.scene-hit-layer{position:absolute;inset:0;pointer-events:auto;touch-action:none}.scene-object-cues{position:absolute;inset:0;pointer-events:none}</style></head><body><div id="stage"></div><script src="/audit.js"></script></body></html>');
