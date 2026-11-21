import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const RAPIER_WASM_SUFFIX = '/rapier_wasm3d_bg.wasm';

/**
 * Minimal Vite/Vitest plugin for `@dimforge/rapier3d-simd`.
 * - Resolves the bare `@dimforge/rapier3d-simd` specifier to `rapier.js` because
 *   the upstream package declares `"module": "rapier.js"` without `"main"`.
 * - In Vite browser dev/build: resolves `rapier_wasm3d_bg.wasm` to a regular
 *   `?url` static asset without top-level await, so Rollup keeps the 3.3 MB
 *   `.wasm` out of initial bundles and emits it as a separate hashed file
 *   fetched only when a soft-body ritual activates.
 * - In Vitest/Node SSR: instantiates the real `.wasm` synchronously from disk
 *   so tests exercise actual Rapier physics without network fetches.
 */
export function rapierWasmPlugin() {
  const rapierRoot = path.dirname(require.resolve('@dimforge/rapier3d-simd/package.json'));
  const rapierEntry = path.join(rapierRoot, 'rapier.js');

  return {
    name: 'wbr-rapier-wasm',
    enforce: 'pre',
    resolveId(source) {
      if (source === '@dimforge/rapier3d-simd') {
        return rapierEntry;
      }
      return null;
    },
    load(id, options) {
      const normalized = id.replaceAll('\\', '/');
      if (!normalized.endsWith(RAPIER_WASM_SUFFIX) || normalized.includes('?')) {
        return null;
      }
      if (options?.ssr || process.env.VITEST) {
        const wasmPath = JSON.stringify(path.resolve(id));
        const bgPath = JSON.stringify(path.resolve(path.dirname(id), 'rapier_wasm3d_bg.js'));
        return [
          `import fs from 'node:fs';`,
          `import * as bg from ${bgPath};`,
          `const bytes = fs.readFileSync(${wasmPath});`,
          `const mod = new WebAssembly.Module(bytes);`,
          `const inst = new WebAssembly.Instance(mod, { './rapier_wasm3d_bg.js': bg });`,
          `export const __rapierWasmExports = inst.exports;`,
          `export const __rapierWasmUrl = null;`,
          `export default inst.exports;`,
        ].join('\n');
      }
      const urlImport = JSON.stringify(`${normalized}?url`);
      return [
        `import wasmUrl from ${urlImport};`,
        `export const __rapierWasmExports = null;`,
        `export const __rapierWasmUrl = wasmUrl;`,
        `export default wasmUrl;`,
      ].join('\n');
    },
  };
}
