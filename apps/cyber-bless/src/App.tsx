import { lazy, Suspense } from "react";
import { BlessingApp } from "@wbr/app";
import { browserHost } from "@wbr/runtime";
import "@wbr/app/style.css";
import { DebugOverlay, debugEnabled } from "./DebugOverlay";

const host = browserHost();
const DevApp = lazy(() => import("./DevApp"));
const OpeningPreview = import.meta.env.DEV ? lazy(() => import('./OpeningPreview')) : null;

export function App() {
  if (OpeningPreview && window.location.pathname === '/opening-preview')
    return <Suspense fallback={<p>正在准备开场预览…</p>}><OpeningPreview /></Suspense>;
  if (window.location.pathname.startsWith("/dev"))
    return (
      <>
        <Suspense fallback={<p>正在打开开发工具…</p>}>
          <DevApp />
        </Suspense>
        {debugEnabled && <DebugOverlay />}
      </>
    );
  return (
    <>
      <BlessingApp
        host={host}
        content={{
          catalogUrl: import.meta.env.VITE_SCENE_CATALOG_URL || (import.meta.env.DEV ? "/scene-content/catalog.json" : undefined),
          manifestUrl:
            import.meta.env.VITE_SCENE_MANIFEST_URL ||
            (import.meta.env.DEV ? "/scene-content/woodfish.json" : undefined),
        }}
      />
      {debugEnabled && <DebugOverlay />}
    </>
  );
}
