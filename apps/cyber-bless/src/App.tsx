import { lazy, Suspense, useEffect } from "react";
import { configureLocale, getLocalePreference, translate as tr } from '@wbr/i18n';
import { useDeveloperLocale } from './locale';
import { BlessingApp } from "@wbr/app";
import { browserHost } from "@wbr/runtime";
import "@wbr/app/style.css";
import { DebugOverlay, debugEnabled } from "./DebugOverlay";

const host = browserHost();
host.publicShareBaseUrl = import.meta.env.VITE_PUBLIC_SHARE_BASE_URL || undefined;
configureLocale(host.initialLocalePreference ?? 'system', navigator.languages ?? [navigator.language]);
const DevApp = lazy(() => import("./DevApp"));
const OpeningPreview = import.meta.env.DEV ? lazy(() => import('./OpeningPreview')) : null;
const SceneReview = import.meta.env.DEV ? lazy(() => import('./SceneReview')) : null;

export function App() {
  const locale = useDeveloperLocale();
  useEffect(() => { document.documentElement.lang = locale; document.title = tr('一日一念'); }, [locale]);
  useEffect(() => {
    const follow = () => configureLocale(getLocalePreference(), navigator.languages ?? [navigator.language]);
    window.addEventListener('languagechange', follow);
    return () => window.removeEventListener('languagechange', follow);
  }, []);
  if (SceneReview && window.location.pathname === '/scene-review')
    return <Suspense fallback={<p>{tr('正在准备场景检查…')}</p>}><SceneReview />{debugEnabled && <DebugOverlay />}</Suspense>;
  if (OpeningPreview && window.location.pathname === '/opening-preview')
    return <Suspense fallback={<p>{tr('正在准备开场预览…')}</p>}><OpeningPreview /></Suspense>;
  if (window.location.pathname.startsWith("/dev"))
    return (
      <>
        <Suspense fallback={<p>{tr('正在打开开发工具…')}</p>}>
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
