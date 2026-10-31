import test from 'node:test';
import assert from 'node:assert/strict';

const manifest = { schemaVersion: 2, sourceMode: 'git-tag', sourceTag: 'ios/v1.0.0-build.19', sourceTagObject: '1'.repeat(40), commit: '2'.repeat(40), tree: '3'.repeat(40), sourceIdentitySha256: '4'.repeat(64) };
const config = { buildNumber: 19, appId: '123' };
const complete = () => ({ sourceMode: 'git-tag', sourceTag: manifest.sourceTag, sourceTagObject: manifest.sourceTagObject, sourceCommit: manifest.commit, sourceTree: manifest.tree, sourceIdentitySha256: manifest.sourceIdentitySha256, buildNumber: '19', appId: '123', internalBuildState: 'IN_BETA_TESTING', build: { processingState: 'VALID' } });

test('counter sync accepts only the same tag and successful TestFlight build', async () => {
  const { assertCounterCompletion } = await import('./counter.mjs');
  assert.equal(typeof assertCounterCompletion, 'function');
  assert.doesNotThrow(() => assertCounterCompletion(config, manifest, complete()));
  for (const change of [{ sourceTagObject: '5'.repeat(40) }, { sourceIdentitySha256: '6'.repeat(64) }, { buildNumber: '18' }, { appId: 'other' }, { internalBuildState: 'PROCESSING' }]) {
    assert.throws(() => assertCounterCompletion(config, manifest, { ...complete(), ...change }));
  }
});

test('counter refuses unsupported modes before config or credentials are read', async () => {
  const { main } = await import('./counter.mjs');
  assert.equal(typeof main, 'function');
  await assert.rejects(main(['/missing.json', 'reset']), /Usage/i);
});
