import { defineConfig } from 'vitest/config';
import { rapierWasmPlugin } from '../../scripts/vite-rapier-wasm.mjs';

export default defineConfig({
  plugins: [rapierWasmPlugin()],
  test: {
    server: {
      deps: {
        inline: ['@dimforge/rapier3d-simd'],
      },
    },
  },
});
