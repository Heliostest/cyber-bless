import { createContext, useContext } from "react";
import { createContentClient, type ContentIO } from "@wbr/content";
import { bundledWoodfish } from "@wbr/content/bundled";
import { createWebContentIO } from "@wbr/content/web";
import { assetUrl } from "./assets";
import { validateWoodfishGLB } from "@wbr/content/glb";

/** Legacy URL fields remain readable for older hosts; the App only loads bundled content. */
export type ContentEnvironment = { io?: ContentIO; manifestUrl?: string; catalogUrl?: string };
export const ContentContext = createContext<ContentEnvironment>({});
export const useContent = () => useContext(ContentContext);
let browserIO: ContentIO | undefined;
export const contentIO = (environment: ContentEnvironment) => environment.io ?? (browserIO ??= createWebContentIO());
const clients = new WeakMap<
  ContentIO,
  Map<string, ReturnType<typeof createContentClient>>
>();
export function woodfishContent(environment: ContentEnvironment) {
  const io = contentIO(environment);
  const base = new URL(assetUrl(""), window.location.href).href;
  const key = base;
  let scoped = clients.get(io);
  if (!scoped) {
    scoped = new Map();
    clients.set(io, scoped);
  }
  let client = scoped.get(key);
  if (!client) {
    client = createContentClient({
      // Download history belongs to the retired delivery flow. Never let an
      // older confirmed/pending pack replace the resources shipped in this App.
      io: {
        readAsset: (asset, url, signal) => io.readAsset(asset, url, signal),
        readHistory: async () => undefined,
        writeHistory: async () => {},
        readCachedAsset: async () => undefined,
        readManifest: async () => { throw Error("Bundled content has no remote manifest"); },
      },
      bundled: bundledWoodfish,
      bundledBase: base,
      validatePrepared: (pack, bytes) =>
        validateWoodfishGLB(bytes, pack.bindings),
    });
    scoped.set(key, client);
  }
  return client;
}
