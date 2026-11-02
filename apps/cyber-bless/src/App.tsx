import { lazy, Suspense, useEffect } from "react";
import { configureLocale, getLocalePreference, translate as tr } from '@wbr/i18n';
import { useDeveloperLocale } from './locale';
import { BlessingApp } from "@wbr/app";
import { browserHost, browserTestFeedbackHost } from "@wbr/runtime";
import "@wbr/app/style.css";

const host = browserHost();
if (import.meta.env.DEV) host.testFeedback = browserTestFeedbackHost();
host.publicShareBaseUrl = import.meta.env.VITE_PUBLIC_SHARE_BASE_URL || undefined;
configureLocale(host.initialLocalePreference ?? 'system', navigator.languages ?? [navigator.language]);
const DevApp = import.meta.env.DEV ? lazy(() => import("./DevApp")) : null;
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
    return <Suspense fallback={<p>{tr('正在准备场景检查…')}</p>}><SceneReview /></Suspense>;
  if (OpeningPreview && window.location.pathname === '/opening-preview')
    return <Suspense fallback={<p>{tr('正在准备开场预览…')}</p>}><OpeningPreview /></Suspense>;
  if (DevApp && window.location.pathname.startsWith("/dev"))
    return (
      <Suspense fallback={<p>{tr('正在打开开发工具…')}</p>}>
        <DevApp />
      </Suspense>
    );
  return (
    <BlessingApp
      host={host}
      internalToolsEnabled={import.meta.env.DEV}
    />
  );
}
