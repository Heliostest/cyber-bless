"use dom";
import { useEffect, useMemo } from "react";
import { BlessingApp } from "@wbr/app";
import {
  createNativeContentIO,
  type NativeContentBridge,
} from "@wbr/content/native-web";
import "@wbr/app/style.css";
import type { WidgetNavigationRequest } from '@wbr/core/widgets';
import type { HapticStrength, ShareImageRequest, ShareLinkRequest } from '@wbr/runtime';
import type { LocalePreference } from '@wbr/i18n/locales';
export default function BlessingDom({
  readSave,
  writeSave,
  haptic,
  shareImage,
  shareLink,
  publicShareBaseUrl,
  onCanGoBack,
  active,
  preferredLanguages,
  localePreference,
  systemHour12,
  backRequest,
  readContentHistory,
  readSceneAsset,
  writeContentHistory,
  fetchSceneAsset,
  cancelSceneAsset,
  protectSceneAssets,
  releaseSceneAssets,
  maintainSceneCache,
  manifestUrl,
  catalogUrl,
  navigationRequest,
  onNavigationConsumed,
  dom: _dom,
}: NativeContentBridge & {
  readSave(): Promise<string | null>;
  writeSave(raw: string): Promise<void>;
  haptic(strength?: HapticStrength): Promise<void>;
  shareImage(image: ShareImageRequest): Promise<void>;
  shareLink(request: ShareLinkRequest): Promise<void>;
  publicShareBaseUrl: string;
  onCanGoBack(value: boolean): Promise<void>;
  active: boolean;
  preferredLanguages: string[];
  localePreference: LocalePreference;
  systemHour12?: boolean;
  backRequest: number;
  manifestUrl: string;
  catalogUrl: string;
  navigationRequest?: WidgetNavigationRequest;
  onNavigationConsumed(requestId: number): Promise<void>;
  dom?: import("expo/dom").DOMProps;
}) {
  useEffect(() => {
    const meta = document.querySelector('meta[name="viewport"]') ?? document.createElement('meta');
    meta.setAttribute('name', 'viewport');
    meta.setAttribute('content', 'width=device-width, initial-scale=1, viewport-fit=cover');
    if (!meta.parentNode) document.head.appendChild(meta);
  }, []);
  // DOM bridge proxies can change when native props update; keep a stable host.
  const actions = useMemo(() => ({ readSave, writeSave, haptic, shareImage, shareLink }), []);
  actions.readSave = readSave;
  actions.writeSave = writeSave;
  actions.haptic = haptic;
  actions.shareImage = shareImage;
  actions.shareLink = shareLink;
  const contentActions = useMemo(
    () => ({
      readContentHistory,
      readSceneAsset,
      writeContentHistory,
      fetchSceneAsset,
      cancelSceneAsset,
      protectSceneAssets,
      releaseSceneAssets,
      maintainSceneCache,
    }),
    [],
  );
  Object.assign(contentActions, {
    readContentHistory,
    readSceneAsset,
    writeContentHistory,
    fetchSceneAsset,
    cancelSceneAsset,
    protectSceneAssets,
    releaseSceneAssets,
    maintainSceneCache,
  });
  const contentIO = useMemo(
    () => createNativeContentIO(contentActions),
    [contentActions],
  );
  const host = useMemo(
    () => ({
      read: () => actions.readSave(),
      write: (raw: string) => actions.writeSave(raw),
      haptic: (strength?: HapticStrength) => actions.haptic(strength),
      shareImage: (image: ShareImageRequest) => actions.shareImage(image),
      shareLink: (request: ShareLinkRequest) => actions.shareLink(request),
    }),
    [actions],
  );
  // The native shell already read this same save before mounting the WebView.
  Object.assign(host, { initialLocalePreference: localePreference, publicShareBaseUrl });
  return (
    <BlessingApp
      host={host}
      systemHour12={systemHour12}
      content={{
        io: contentIO,
        manifestUrl: manifestUrl || undefined,
        catalogUrl: catalogUrl || undefined,
      }}
      active={active}
      systemLocales={preferredLanguages}
      backRequest={backRequest}
      onCanGoBack={onCanGoBack}
      navigationRequest={navigationRequest}
      onNavigationConsumed={onNavigationConsumed}
    />
  );
}
