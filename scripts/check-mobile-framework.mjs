import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepareAppAssets } from './prepare-app-assets.mjs';
import { validateMobileEmbed } from './validate-mobile-embed.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const app = path.join(root, 'apps/mobile-expo');
const require = createRequire(path.join(app, 'package.json'));
const cli = require.resolve('expo/bin/cli');
const parent = path.join(app, '.expo-export-check');
await mkdir(parent, { recursive: true });
const output = await mkdtemp(path.join(parent, 'verify-'));
const cache = path.join(output, 'cache');
await mkdir(cache);
const assets = await prepareAppAssets();
const covers = JSON.parse(await readFile(path.join(root, 'assets/widgets/today/manifest.json'), 'utf8'));
const platforms = process.argv[2] ? [process.argv[2]] : ['android', 'ios'];
if (platforms.some(platform => !['android', 'ios'].includes(platform))) throw Error('Expected android or ios');
const results = {};
for (const platform of platforms) {
  const target = path.join(output, platform);
  await mkdir(target);
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cli, 'export:embed', '--platform', platform, '--dev', 'false',
      '--max-workers', '2', '--entry-file', path.join(app, 'index.ts'), '--bundle-output', path.join(target, 'main.bundle'),
      '--assets-dest', platform === 'android' ? path.join(target, 'res') : target], {
      cwd: app, env: { ...process.env, CI: '1', EXPO_NO_TELEMETRY: '1', TEMP: cache, TMP: cache, TMPDIR: cache,
        WBR_METRO_CACHE: path.join(cache, 'metro') }, stdio: 'inherit',
    });
    child.on('error', reject);
    child.on('exit', code => code === 0 ? resolve() : reject(Error(`Expo ${platform} failed: ${code}`)));
  });
  results[platform] = await validateMobileEmbed(target, assets);
  if (platform === 'ios') {
    const expected = covers.scenes.flatMap(scene => [scene.small, scene.medium, scene.large]);
    const generic = covers.scenes.find(scene => scene.id === 'woodfish');
    for (const size of ['small', 'medium', 'large']) expected.push({ ...generic[size], file: `generic-${size}.png` });
    for (const cover of expected) {
      const bytes = await readFile(path.join(target, 'assets/__assets/widgets/today', cover.file));
      if (createHash('sha256').update(bytes).digest('hex') !== cover.sha256)
        throw Error(`Embedded widget cover mismatch: ${cover.file}`);
    }
    results[platform].widgetCoverCount = expected.length;
    console.log(`ios: ${expected.length} offline widget cover hashes verified.`);
  }
  console.log(`${platform}: native/DOM HTML/JS/CSS and ${assets.length} offline asset hashes verified.`);
}
const evidence = path.join(root, 'artifacts/mobile-verification');
await mkdir(evidence, { recursive: true });
await writeFile(path.join(evidence, 'latest.json'), JSON.stringify({ at: new Date().toISOString(), output, results }, null, 2) + '\n');
console.log(`Evidence: ${evidence}`);
