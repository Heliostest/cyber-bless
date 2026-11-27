import path from 'node:path';
import { defineConfig } from 'vitest/config';
import { rapierWasmPlugin } from '../../scripts/vite-rapier-wasm.mjs';

export default defineConfig({
  plugins: [rapierWasmPlugin()],
  test: {
    // Bound worker contention so dense multi-scene sweeps report heartbeats reliably.
    maxWorkers: 4,
    testTimeout: 30_000,
    setupFiles: [path.resolve(import.meta.dirname, './vitest.setup.ts')],
    server: {
      deps: {
        inline: ['@dimforge/rapier3d-simd'],
      },
    },
  },
});
