import { mkdir, mkdtemp, cp, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
await mkdir(path.join(root, 'artifacts'), { recursive: true });
const directory = await mkdtemp(path.join(root, 'artifacts/widget-native-'));
const app = path.join(directory, 'apps/mobile-expo');
await mkdir(path.dirname(app), { recursive: true });
const appSource = path.join(root, 'apps/mobile-expo');
const generated = new Set(['node_modules', 'ios', 'android', 'public', '.expo', '.expo-export-check']);
await cp(appSource, app, { recursive: true, filter: source => !generated.has(path.relative(appSource, source).split(path.sep)[0]) });
await cp(path.join(root, 'package.json'), path.join(directory, 'package.json'));
await cp(path.join(root, 'package-lock.json'), path.join(directory, 'package-lock.json'));
for (const item of ['node_modules', 'packages', 'scripts', 'assets', 'content']) {
  await symlink(path.join(root, item), path.join(directory, item), process.platform === 'win32' ? 'junction' : 'dir');
}
await writeFile(path.join(root, 'artifacts/widget-native-latest.json'), JSON.stringify({ directory, app }, null, 2) + '\n');
console.log(app);
