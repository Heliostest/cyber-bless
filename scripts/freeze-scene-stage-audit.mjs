// Freeze source and prepared browser assets while other development continues.
// All dependency junctions except @wbr point to installed third-party packages;
// workspace packages resolve exclusively inside the frozen directory.
import { cp, mkdir, readdir, readFile, writeFile, symlink } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

const source = process.cwd();
const frozen = path.join(source, 'artifacts/all-scene-stability/frozen');
// Refuse to overwrite a prior audit's source evidence.
await mkdir(path.dirname(frozen), { recursive: true });
await mkdir(frozen);
const skip = new Set(['node_modules', 'dist', '.git', 'artifacts', '.expo', '.expo-export-check', 'ios', 'android', '.gradle', 'build']);
for (const directory of ['apps', 'packages', 'scripts', 'assets', 'content', 'docs']) {
  await cp(path.join(source, directory), path.join(frozen, directory), {
    recursive: true, filter: file => !skip.has(path.basename(file)),
  });
}
for (const item of await readdir(source, { withFileTypes: true })) {
  if (item.isFile() && /(?:\.json|\.ts|\.mjs|\.md|\.cjs)$/.test(item.name))
    await cp(path.join(source, item.name), path.join(frozen, item.name));
}
const modules = path.join(frozen, 'node_modules');
await mkdir(path.join(modules, '@wbr'), { recursive: true });
for (const item of await readdir(path.join(source, 'node_modules'), { withFileTypes: true })) {
  if (['@wbr', '.vite', '.cache'].includes(item.name)) continue;
  await symlink(path.join(source, 'node_modules', item.name), path.join(modules, item.name), item.isDirectory() ? 'junction' : 'file');
}
for (const group of ['apps', 'packages']) for (const item of await readdir(path.join(frozen, group), { withFileTypes: true })) {
  if (!item.isDirectory()) continue;
  const directory = path.join(frozen, group, item.name);
  const pkg = JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8'));
  if (pkg.name?.startsWith('@wbr/')) await symlink(directory, path.join(modules, '@wbr', pkg.name.slice(5)), 'junction');
}
const sources = [];
async function collect(directory) {
  for (const entry of await readdir(path.join(frozen, directory), { withFileTypes: true })) {
    const relative = path.join(directory, entry.name);
    if (entry.isDirectory()) await collect(relative);
    else if (/\.(?:ts|tsx|css|json)$/.test(entry.name) && !/\.(?:test|spec)\.|scene-testing-revisions.generated/.test(entry.name)) {
      const bytes = await readFile(path.join(frozen, relative));
      sources.push({ path: relative, sha256: createHash('sha256').update(bytes).digest('hex').toUpperCase() });
    }
  }
}
for (const group of ['app', 'scenes', 'scene-runtime', 'core', 'shared', 'gestures', 'runtime', 'i18n', 'content']) await collect(`packages/${group}/src`);
const manifest = { frozenRoot: frozen, capturedAt: new Date().toISOString(), sources,
  runner: createHash('sha256').update(await readFile(path.join(frozen, 'scripts/scene-stage-audit-browser.mjs'))).digest('hex').toUpperCase(),
};
const reportDirectory = path.join(source, 'artifacts/all-scene-stability/frozen-report');
await mkdir(reportDirectory, { recursive: true });
await writeFile(path.join(reportDirectory, 'source-manifest.json'), JSON.stringify(manifest, null, 2));
const config = `import { defineConfig } from 'vite';\nimport react from '@vitejs/plugin-react';\nexport default defineConfig({root:${JSON.stringify(path.join(frozen, 'apps/cyber-bless'))},publicDir:'public',define:{'process.env.EXPO_BASE_URL':JSON.stringify('/')},plugins:[react()],cacheDir:${JSON.stringify(path.join(frozen, '.vite'))},server:{host:'127.0.0.1',port:5178,strictPort:true,hmr:false,watch:{ignored:['**/*']},fs:{allow:[${JSON.stringify(frozen)},${JSON.stringify(path.join(source, 'node_modules'))}]}}});\n`;
await writeFile(path.join(frozen, 'audit.vite.config.mjs'), config);
console.log(JSON.stringify({ frozen, reportDirectory, sourceFiles: sources.length }, null, 2));
