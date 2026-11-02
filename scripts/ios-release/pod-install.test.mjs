import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

test('Ruby CocoaPods checksum regression tests', t => {
  const ruby = process.env.IOS_RELEASE_TEST_RUBY ?? 'ruby';
  const available = spawnSync(ruby, ['--version'], { encoding: 'utf8' });
  if (available.error && process.platform !== 'darwin') return t.skip('Ruby is unavailable on this host; the Mac release check runs these tests');
  assert.equal(available.status, 0, available.stderr || String(available.error));
  const directory = path.dirname(fileURLToPath(import.meta.url));
  const bundle = path.join(path.dirname(ruby), process.platform === 'win32' ? 'bundle.bat' : 'bundle');
  const result = spawnSync(bundle, ['exec', ruby, path.join(directory, 'pod-install.test.rb')], {
    cwd: path.resolve(directory, '../..'), encoding: 'utf8', timeout: 30000,
    env: { ...process.env, BUNDLE_GEMFILE: path.resolve(directory, '../../Gemfile'), BUNDLE_FROZEN: 'true', BUNDLE_IGNORE_CONFIG: 'true', LANG: 'en_US.UTF-8', LC_ALL: 'en_US.UTF-8' },
  });
  assert.equal(result.status, 0, [result.stdout, result.stderr, result.error].filter(Boolean).join('\n'));
});
