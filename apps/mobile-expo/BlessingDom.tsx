"use dom";
import { useEffect, useMemo } from "react";
import { BlessingApp } from "@wbr/app";
import {
  createNativeContentIO,
  type NativeContentBridge,
} from "@wbr/content/native-web";
import "@wbr/app/style.css";
import type { WidgetNavigationRequest } from '@wbr/core/widgets';
import type { HapticStrength, ShareImageRequest, ShareLinkRequest, TestFeedbackInfo } from '@wbr/runtime';
import type { LocalePreference } from '@wbr/i18n/locales';
import type {InternalUpdateAction,InternalUpdateState} from '@wbr/runtime';
import {installNativeAssetMap} from '@wbr/scene-runtime/asset-urls';
import {DomHealthBoundary} from './dom-health';
export default function BlessingDom({
  assetMap,
  domSession,onDomReady,onDomFailure,
  requestInternalUpdate,
  readSave,
  writeSave,
  haptic,
  shareImage,
  shareLink,
  readUiSound,
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
  internalToolsEnabled,
  feedbackInfo,
  readTestFeedback,
  writeTestFeedback,
  submitTestFeedback,
  fetchTestFeedbackStatus,
  navigationRequest,
  onNavigationConsumed,
  dom: _dom,
}: NativeContentBridge & {
  assetMap:Record<string,string>;
  domSession:number;
  onDomReady(session:number):Promise<void>;
  onDomFailure(session:number):Promise<void>;
  requestInternalUpdate(action:InternalUpdateAction):Promise<InternalUpdateState>;
  readSave(): Promise<string | null>;
  writeSave(raw: string): Promise<void>;
  haptic(strength?: HapticStrength): Promise<void>;
  shareImage(image: ShareImageRequest): Promise<void>;
  shareLink(request: ShareLinkRequest): Promise<void>;
  readUiSound?(file: string): Promise<string>;
  publicShareBaseUrl: string;
  onCanGoBack(value: boolean): Promise<void>;
  active: boolean;
  preferredLanguages: string[];
  localePreference: LocalePreference;
  systemHour12?: boolean;
  backRequest: number;
  internalToolsEnabled: boolean;
  feedbackInfo: TestFeedbackInfo;
  readTestFeedback(): Promise<string | null>;
  writeTestFeedback(raw: string): Promise<void>;
  submitTestFeedback(endpoint: string, token: string, reportJSON: string): Promise<string>;
  fetchTestFeedbackStatus(endpoint: string, token: string, queryJSON: string): Promise<string>;
  navigationRequest?: WidgetNavigationRequest;
  onNavigationConsumed(requestId: number): Promise<void>;
  dom?: import("expo/dom").DOMProps;
}) {
  // Register URI indirection before any App/font/Three loader renders. HTTP
  // Metro previews retain public paths; only file-hosted DOM can read files.
  useMemo(()=>installNativeAssetMap(window.location.protocol==='file:'?assetMap:{}),[assetMap]);
  useEffect(()=>{void onDomReady(domSession).catch(()=>{})},[domSession]);
  useEffect(() => {
    const meta = document.querySelector('meta[name="viewport"]') ?? document.createElement('meta');
    meta.setAttribute('name', 'viewport');
    meta.setAttribute('content', 'width=device-width, initial-scale=1, viewport-fit=cover');
    if (!meta.parentNode) document.head.appendChild(meta);
  }, []);
  // DOM bridge proxies can change when native props update; keep a stable host.
  const actions = useMemo(() => ({ readSave, writeSave, haptic, shareImage, shareLink, readUiSound,requestInternalUpdate }), []);
  actions.readSave = readSave;
  actions.writeSave = writeSave;
  actions.haptic = haptic;
  actions.shareImage = shareImage;
  actions.shareLink = shareLink;
  actions.readUiSound = readUiSound;
  actions.requestInternalUpdate=requestInternalUpdate;
  const feedbackActions = useMemo(() => ({ readTestFeedback, writeTestFeedback, submitTestFeedback, fetchTestFeedbackStatus }), []);
  Object.assign(feedbackActions, { readTestFeedback, writeTestFeedback, submitTestFeedback, fetchTestFeedbackStatus });
  const feedbackHost = useMemo(() => ({
    read: () => feedbackActions.readTestFeedback(),
    write: (raw: string) => feedbackActions.writeTestFeedback(raw),
    send: (endpoint: string, token: string, raw: string) => feedbackActions.submitTestFeedback(endpoint, token, raw),
    readStatus: (endpoint: string, token: string, raw: string) => feedbackActions.fetchTestFeedbackStatus(endpoint, token, raw),
    info: feedbackInfo,
  }), [feedbackActions]);
  feedbackHost.info = feedbackInfo;
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
      readUiSound: readUiSound ? (file: string) => actions.readUiSound!(file) : undefined,
      internalUpdates:{request:(action:InternalUpdateAction)=>actions.requestInternalUpdate(action)},
    }),
    [actions],
  );
  // The native shell already read this same save before mounting the WebView.
  Object.assign(host, { initialLocalePreference: localePreference, publicShareBaseUrl, testFeedback: feedbackHost });
  return (
    <DomHealthBoundary onFailure={()=>{void onDomFailure(domSession).catch(()=>{})}}><BlessingApp
      host={host}
      internalToolsEnabled={internalToolsEnabled}
      systemHour12={systemHour12}
      content={{
        io: contentIO,
      }}
      active={active}
      systemLocales={preferredLanguages}
      backRequest={backRequest}
      onCanGoBack={onCanGoBack}
      navigationRequest={navigationRequest}
      onNavigationConsumed={onNavigationConsumed}
    /></DomHealthBoundary>
  );
}
