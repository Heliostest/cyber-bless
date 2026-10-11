import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const app = path.join(root, 'apps/mobile-expo');
const require = createRequire(path.join(app, 'package.json'));
const parent = path.join(root, 'artifacts');
await mkdir(parent, { recursive: true });
const task = await mkdtemp(path.join(parent, 'eas-archive-'));
const source = path.join(task, 'source');
const npmCli = process.env.npm_execpath;
if (!npmCli) throw Error('Run through npm run mobile:archive:verify so the current npm CLI is reused');
function run(cli, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cli, ...args], { cwd, env: { ...process.env, CI: '1', EXPO_NO_TELEMETRY: '1' }, stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', code => code === 0 ? resolve() : reject(Error(`${args.join(' ')} failed: ${code}`)));
  });
}
await run(require.resolve('eas-cli/bin/run'), ['build:inspect', '-p', 'ios', '-s', 'archive', '-o', source], app);
for (const file of ['package-lock.json', 'scripts/prepare-app-assets.mjs', 'content/woodfish/bundled.json',
  'assets/fonts/OFL.txt', 'assets/fonts/nunito-OFL.txt', 'assets/woodfish/bundled-v1/woodfish.glb', 'apps/mobile-expo/assets/icon.png',
  'apps/mobile-expo/widget-sync.ts', 'apps/mobile-expo/widgets/TodayWidget.tsx',
  'apps/mobile-expo/widget-images.ts', 'apps/mobile-expo/widget-preview-assets.ts', 'assets/widgets/today/manifest.json',
  'apps/mobile-expo/plugins/withBlessingWidgets.cjs', 'apps/mobile-expo/modules/blessing-widgets/expo-module.config.json',
  'apps/mobile-expo/modules/blessing-widgets/android/build.gradle',
  'apps/mobile-expo/modules/blessing-widgets/android/src/main/AndroidManifest.xml',
  'apps/mobile-expo/modules/blessing-widgets/android/src/main/java/com/helio/blessingwidgets/TodayRitualWidget.kt',
  'apps/mobile-expo/modules/blessing-widgets/android/src/main/res/xml/blessing_today_widget_info.xml',
  'apps/mobile-expo/modules/blessing-widgets/android/src/main/res/drawable/blessing_widget_generic.xml',
  'packages/core/src/daily-scenes.ts', 'packages/core/src/widgets.ts', 'packages/runtime/src/projected-storage.ts']) {
  if (!(await stat(path.join(source, file))).size) throw Error(`Missing archive input: ${file}`);
}
const previews = JSON.parse(await readFile(path.join(source, 'assets/widgets/today/manifest.json'), 'utf8'));
for (const scene of previews.scenes) for (const size of ['small', 'medium']) {
  const expected = scene[size].sha256;
  for (const file of [`assets/widgets/today/${scene[size].file}`,
    `apps/mobile-expo/modules/blessing-widgets/android/src/main/res/drawable-nodpi/blessing_preview_${scene.id.replaceAll('-', '_')}_${size}.png`]) {
    const actual = createHash('sha256').update(await readFile(path.join(source, file))).digest('hex');
    if (actual !== expected) throw Error(`Archive widget cover differs: ${file}`);
  }
}
for (const size of ['small', 'medium']) {
  const expected = previews.scenes.find(scene => scene.id === 'woodfish')[size].sha256;
  for (const file of [`assets/widgets/today/generic-${size}.png`,
    `apps/mobile-expo/modules/blessing-widgets/android/src/main/res/drawable-nodpi/blessing_preview_generic_${size}.png`]) {
    const actual = createHash('sha256').update(await readFile(path.join(source, file))).digest('hex');
    if (actual !== expected) throw Error(`Archive generic cover differs: ${file}`);
  }
}
await run(npmCli, ['ci'], source);
await run(npmCli, ['run', 'assets:prepare', '-w', '@wbr/mobile'], source);
await run(npmCli, ['run', 'mobile:verify'], source);
const evidence = JSON.parse(await readFile(path.join(source, 'artifacts/mobile-verification/latest.json'), 'utf8'));
await writeFile(path.join(parent, 'eas-archive-latest.json'), JSON.stringify({ at: new Date().toISOString(), source, ...evidence }, null, 2) + '\n');
console.log(`EAS upload archive installed and both platforms exported in a clean directory: ${source}`);
