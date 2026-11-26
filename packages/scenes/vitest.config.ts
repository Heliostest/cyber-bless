import path from 'node:path'
import { defineConfig } from 'vitest/config'
import { rapierWasmPlugin } from '../../scripts/vite-rapier-wasm.mjs'

export default defineConfig({
  plugins: [rapierWasmPlugin()],
  resolve: {
    alias: [
      { find: /^@wbr\/scene-runtime\/(.+)$/, replacement: path.resolve(import.meta.dirname, '../scene-runtime/src/$1.ts') },
      { find: /^@wbr\/scene-runtime$/, replacement: path.resolve(import.meta.dirname, '../scene-runtime/src/index.ts') },
    ],
  },
  test: {
    // Geometry sweeps cover thousands of poses; bound CPU contention and allow their full assertions to finish.
    maxWorkers: 4,
    testTimeout: 30_000,
    server: {
      deps: {
        inline: ['@dimforge/rapier3d-simd'],
      },
    },
  },
})
