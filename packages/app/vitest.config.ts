import { defineConfig } from "vitest/config";

// Match the app's `jsx: "react-jsx"` so .tsx components render in tests.
export default defineConfig({ esbuild: { jsx: "automatic" }, test: { setupFiles: ['./src/test-locale-setup.ts'] } });
