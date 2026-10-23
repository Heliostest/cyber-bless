import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Geometry sweeps cover thousands of poses; bound CPU contention and allow their full assertions to finish.
    maxWorkers: 4,
    testTimeout: 30_000,
  },
})
