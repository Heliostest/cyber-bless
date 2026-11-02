import test from 'node:test';
import assert from 'node:assert/strict';
import { quickTunnelUrl } from './tunnel.mjs';

test('captures the temporary upload hostname but never mistakes the Cloudflare API for it', () => {
  assert.equal(quickTunnelUrl('failed POST https://api.trycloudflare.com/tunnel'), undefined);
  assert.equal(quickTunnelUrl('Your quick Tunnel\nhttps://four-words-test-url.trycloudflare.com\n'), 'https://four-words-test-url.trycloudflare.com');
});
