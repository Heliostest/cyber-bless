import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { prepareAppAssets } from "../../scripts/prepare-app-assets.mjs";

await prepareAppAssets();
const base = process.env.VITE_BASE_PATH || '/';

export default defineConfig({
  publicDir: "public",
  base,
  define: { "process.env.EXPO_BASE_URL": JSON.stringify(base) },
  build: {
    rollupOptions: { input: {
      main: path.resolve(import.meta.dirname, 'index.html'),
      share: path.resolve(import.meta.dirname, 'share.html'),
    } },
  },
  plugins: [react()],
  server: {
    host: true,
  },
});
