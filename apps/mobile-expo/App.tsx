import { useCallback, useEffect, useRef, useState } from "react";
import {
  AppState,
  BackHandler,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Updates from 'expo-updates';
import * as Haptics from "expo-haptics";
import * as Linking from 'expo-linking';
import { getLocales, getCalendars } from 'expo-localization';
import { resolveLocale, type LocalePreference } from '@wbr/i18n/locales';
import nativeCopy from './widget-copy.generated.json';
import { createProjectedStorage, type HapticStrength, type TestFeedbackInfo } from '@wbr/runtime';
import { parseWidgetLink, type WidgetNavigationRequest } from '@wbr/core/widgets';
import { synchronizeWidgets } from './widget-sync';
import BlessingDom from "./BlessingDom";
import { SafeAreaBackground } from './SafeAreaBackground';
import { shareImage } from './share-image';
import { shareLink } from './share-link';
import { readUiSound } from './ui-sound';
import { detectInternalToolsEnabled } from './internal-tools';
import { INTERNAL_TOOLS_ENABLED } from '@wbr/app/internal-tools-config';
import { readTestFeedback, writeTestFeedback, flushTestFeedbackWrites, submitTestFeedback, fetchTestFeedbackStatus, testFeedbackInfo } from './test-feedback';
import {createNativeUpdateHost} from './internal-updates';
import {resolveBundledAssetUris} from './bundled-assets';
import type {InternalUpdateAction} from '@wbr/runtime';
import {InternalUpdateRecovery} from './InternalUpdateRecovery';
import {watchDomReadiness} from './dom-readiness';
import {
  readContentHistory,
  readSceneAsset,
  writeContentHistory,
  fetchSceneAsset,
  cancelSceneAsset,
  protectSceneAssets,
  releaseSceneAssets,
  maintainSceneCache,
  resetSceneCacheSession,
} from "./scene-cache";

const SAVE_KEY = "cyber-bless:personal:v1";
const preferredLanguages = () => getLocales().map(locale => locale.languageTag);
const preferredHour12 = () => {
  const use24 = getCalendars()[0]?.uses24hourClock;
  return typeof use24 === 'boolean' ? !use24 : undefined;
};
function localePreference(raw: string | null): LocalePreference {
  // Read only a validated preference. Never rewrite a damaged or older save here.
  try {
    const value = raw === null ? undefined : JSON.parse(raw);
    const preference = value?.version === 1 ? value?.settings?.locale : undefined;
    return preference === 'system' || Object.hasOwn(nativeCopy.native, preference) ? preference : 'system';
  } catch { return 'system'; }
}
export default function App() {
  return (
    <SafeAreaProvider>
      <Shell />
    </SafeAreaProvider>
  );
}
function Shell() {
  const [active, setActive] = useState(AppState.currentState === "active");
  const activeRef=useRef(active);activeRef.current=active;
  const [internalToolsEnabled, setInternalToolsEnabled] = useState(INTERNAL_TOOLS_ENABLED);
  const [feedbackInfo, setFeedbackInfo] = useState<TestFeedbackInfo>({ platform: Platform.OS === 'ios' ? 'ios' : 'android', appVersion: 'unknown', buildNumber: 'unknown', osVersion: String(Platform.Version) });
  useEffect(() => { let disposed = false; void testFeedbackInfo().then(info => { if (!disposed) setFeedbackInfo(info); }); return () => { disposed = true; }; }, []);
  useEffect(() => {
    if (!active) return;
    let disposed = false;
    void detectInternalToolsEnabled().then(enabled => { if (!disposed) setInternalToolsEnabled(enabled); });
    return () => { disposed = true; };
  }, [active]);
  const [backRequest, setBackRequest] = useState(0);
  const [generation, setGeneration] = useState(0);
  const domGeneration=useRef(0);
  const [domHealthy,setDomHealthy]=useState(false);
  const [nativeApplying,setNativeApplying]=useState(false);
  const applyingRef=useRef(false);
  const [assetMap,setAssetMap]=useState<Record<string,string>|null>(__DEV__||Platform.OS==='web'?{}:null);
  const [failed, setFailed] = useState(false);
  const [languages, setLanguages] = useState(preferredLanguages);
  const [hour12, setHour12] = useState(preferredHour12);
  const [preference, setPreference] = useState<LocalePreference>('system');
  const [ready, setReady] = useState(false);
  const initialRead = useRef<Promise<string | null> | null>(null);
  const canGoBack = useRef(false);
  const fail=useCallback((session:number)=>{
    if(session!==domGeneration.current)return;
    void resetSceneCacheSession().catch(()=>{});
    canGoBack.current=false;setFailed(true);
  },[]);
  const onDomReady=useCallback(async(session:number)=>{if(session===domGeneration.current)setDomHealthy(true)},[]);
  const onDomFailure=useCallback(async(session:number)=>{fail(session)},[fail]);
  const [navigationRequests, setNavigationRequests] = useState<WidgetNavigationRequest[]>([]);
  const nextRequest = useRef(0);
  const [storage] = useState(() => createProjectedStorage({
    read: () => AsyncStorage.getItem(SAVE_KEY),
    write: (raw) => AsyncStorage.setItem(SAVE_KEY, raw),
  }, synchronizeWidgets, () => console.warn('[Widgets] Cache update failed; retrying on the next foreground refresh.')));
  const [updateHost]=useState(()=>createNativeUpdateHost({isActive:()=>activeRef.current,flushWrites:async()=>{await storage.flushWrites();await flushTestFeedbackWrites();await storage.flushProjection()}}));
  const updates=Updates.useUpdates();
  useEffect(()=>{updateHost.updateProgress(updates.downloadProgress??0)},[updateHost,updates.downloadProgress]);
  const requestInternalUpdate=useCallback(async(action:InternalUpdateAction)=>{
    if(action==='apply'){applyingRef.current=true;setNativeApplying(true)}
    try{const result=await updateHost.request(action);if(action==='apply'&&result.phase!=='applying'){applyingRef.current=false;setNativeApplying(false)}return result}
    catch(error){if(action==='apply'){applyingRef.current=false;setNativeApplying(false)}throw error}
  },[updateHost]);
  const [recoveryHost]=useState(()=>({request:requestInternalUpdate}));
  useEffect(()=>{
    if(__DEV__||!active||!ready||assetMap===null||failed||domHealthy)return;
    return watchDomReadiness(()=>fail(generation));
  },[active,ready,assetMap,failed,domHealthy,generation,fail]);
  useEffect(()=>{
    if(assetMap!==null)return;
    let disposed=false;
    void resolveBundledAssetUris().then(map=>{if(!disposed)setAssetMap(map)}).catch(()=>{if(!disposed)fail(generation)});
    return()=>{disposed=true};
  },[assetMap,generation]);
  const readSave = useCallback(async () => {
    const pending = initialRead.current ?? storage.read();
    initialRead.current = null;
    const raw = await pending;
    setPreference(localePreference(raw));
    return raw;
  }, [storage]);
  const writeSave = useCallback(async (raw: string) => {
    await storage.write(raw);
    setPreference(localePreference(raw));
  }, [storage]);
  useEffect(() => {
    // The DOM consumes this same initial read, avoiding a second bootstrap read.
    let disposed = false;
    const pending = storage.read();
    initialRead.current = pending;
    void pending.then(raw => { if (!disposed) setPreference(localePreference(raw)); })
      .catch(() => {}).finally(() => { if (!disposed) setReady(true); });
    return () => { disposed = true; };
  }, [storage]);
  const onNavigationConsumed = useCallback(async (requestId: number) => {
    setNavigationRequests(old => old.filter(request => request.requestId !== requestId));
  }, []);
  useEffect(() => {
    let disposed = false;
    let incoming = false;
    let lastURL = '', lastAt = 0;
    const accept = (url: string | null) => {
      if (disposed || !url) return;
      const parsed = parseWidgetLink(url);
      if (!parsed || (url === lastURL && Date.now() - lastAt < 2000)) return;
      lastURL = url; lastAt = Date.now();
      const request = { ...parsed, requestId: ++nextRequest.current };
      setNavigationRequests(old => old.length < 10 ? [...old, request] : [old[0], ...old.slice(-8), request]);
    };
    const links = Linking.addEventListener('url', ({ url }) => { incoming = true; accept(url); });
    void Linking.getInitialURL().then(url => { if (!incoming) accept(url); }).catch(() => {});
    return () => { disposed = true; links.remove(); };
  }, []);
  const haptic = useCallback(async (strength?: HapticStrength) => {
    if (!strength) {
      await Haptics.selectionAsync().catch(() => {});
      return;
    }
    const impacts = {
      light: Haptics.ImpactFeedbackStyle.Light,
      medium: Haptics.ImpactFeedbackStyle.Medium,
      heavy: Haptics.ImpactFeedbackStyle.Heavy,
    };
    await Haptics.impactAsync(impacts[strength]).catch(() => {});
  }, []);
  const onCanGoBack = useCallback(async (value: boolean) => {
    canGoBack.current = value;
  }, []);
  useEffect(() => {
    const app = AppState.addEventListener("change", (next) => {
      setActive(next === "active");
      if (next === 'active') {
        setLanguages(preferredLanguages());
        setHour12(preferredHour12());
        void storage.refreshProjection().catch(() => {});
      }
      else void storage.flushWrites().catch(() => {});
    });
    const back = BackHandler.addEventListener("hardwareBackPress", () => {
      if (!canGoBack.current) return false;
      setBackRequest((n) => n + 1);
      return true;
    });
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') void storage.refreshProjection().catch(() => {});
    }, 60000);
    return () => {
      app.remove();
      back.remove();
      clearInterval(timer);
    };
  }, [storage]);
  const resolved = resolveLocale(preference, languages).locale;
  const copy = nativeCopy.native[resolved];
  return (
    <View style={styles.shell}>
      <SafeAreaBackground />
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      {ready && assetMap!==null && !failed && <BlessingDom
        key={generation}
        domSession={generation}
        onDomReady={onDomReady}
        onDomFailure={onDomFailure}
        assetMap={assetMap}
        requestInternalUpdate={requestInternalUpdate}
        readSave={readSave}
        readContentHistory={readContentHistory}
        readSceneAsset={readSceneAsset}
        writeContentHistory={writeContentHistory}
        fetchSceneAsset={fetchSceneAsset}
        cancelSceneAsset={cancelSceneAsset}
        protectSceneAssets={protectSceneAssets}
        releaseSceneAssets={releaseSceneAssets}
        maintainSceneCache={maintainSceneCache}
        internalToolsEnabled={internalToolsEnabled}
        feedbackInfo={feedbackInfo}
        readTestFeedback={readTestFeedback}
        writeTestFeedback={writeTestFeedback}
        submitTestFeedback={submitTestFeedback}
        fetchTestFeedbackStatus={fetchTestFeedbackStatus}
        writeSave={writeSave}
        haptic={haptic}
        shareImage={shareImage}
        shareLink={shareLink}
        readUiSound={Platform.OS === 'ios' && !__DEV__ ? readUiSound : undefined}
        publicShareBaseUrl={process.env.EXPO_PUBLIC_SHARE_BASE_URL ?? ''}
        onCanGoBack={onCanGoBack}
        active={active}
        preferredLanguages={languages}
        localePreference={preference}
        systemHour12={hour12}
        backRequest={backRequest}
        navigationRequest={navigationRequests[0]}
        onNavigationConsumed={onNavigationConsumed}
        dom={{
          // Expo's native DOM WebView exposes the bridge before offline HTML runs.
          // Development keeps the RN WebView and its delayed Metro bootstrap.
          useExpoDOMWebView: !__DEV__,
          onMessage: __DEV__
            ? (event) => {
                try {
                  const message = JSON.parse(event.nativeEvent.data);
                  if (message.type === "wbr:dom-bootstrap")
                    console.info("[BlessingDOM] bootstrap", message.data.status);
                } catch {
                  // Other WebView messages are handled by Expo's DOM wrapper.
                }
              }
            : undefined,
          style: styles.webview,
          contentInsetAdjustmentBehavior: "never",
          bounces: false,
          keyboardDisplayRequiresUserAction: true,
          onError: ()=>fail(generation),
          onContentProcessDidTerminate: ()=>fail(generation),
          ...(Platform.OS === "android" ? { onRenderProcessGone: ()=>fail(generation) } : {}),
        }}
      />}
      {failed && (
        <ScrollView style={styles.failure} contentContainerStyle={styles.failureContent} accessibilityRole="alert">
          <Text style={styles.message}>
            {copy['native.failure.message']}
          </Text>
          <Pressable
            style={styles.retry}
            disabled={nativeApplying}
            onPress={() => {
              if(applyingRef.current)return;
              domGeneration.current++;setGeneration(domGeneration.current);setDomHealthy(false);
              setFailed(false);
            }}
          >
            <Text style={styles.retryLabel}>{copy['native.failure.retry']}</Text>
          </Pressable>
          {internalToolsEnabled&&Updates.isEnabled&&<InternalUpdateRecovery host={recoveryHost} copy={copy}/>}
        </ScrollView>
      )}
    </SafeAreaView>
    </View>
  );
}
// Native tiles extend the CSS ground into the safe areas. Keep the WebView's
// first paint mint; content, keyboard and fixed controls retain their safe rect.
const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: "#cdf1e6", overflow: "hidden" },
  safeArea: { flex: 1 },
  webview: { flex: 1, backgroundColor: "#cdf1e6" },
  failure: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "#fbf3dc",
  },
  failureContent: {
    flexGrow:1,
    justifyContent: "center",
    alignItems: "center",
    padding: 30,
    gap: 24,
  },
  message: { color: "#4a2a12", textAlign: "center", lineHeight: 26 },
  retry: {
    backgroundColor: "#4fd8c9",
    borderColor: "#d4f8f2",
    borderWidth: 3,
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 28,
  },
  retryLabel: { color: "#064a43", fontWeight: "800", fontSize: 16 },
});
