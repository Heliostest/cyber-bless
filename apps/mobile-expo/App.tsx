import { useCallback, useEffect, useRef, useState } from "react";
import {
  AppState,
  BackHandler,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import * as Linking from 'expo-linking';
import { createProjectedStorage } from '@wbr/runtime';
import { parseWidgetLink, type WidgetNavigationRequest } from '@wbr/core/widgets';
import { synchronizeWidgets } from './widget-sync';
import BlessingDom from "./BlessingDom";
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
export default function App() {
  return (
    <SafeAreaProvider>
      <Shell />
    </SafeAreaProvider>
  );
}
function Shell() {
  const [active, setActive] = useState(AppState.currentState === "active");
  const [backRequest, setBackRequest] = useState(0);
  const [generation, setGeneration] = useState(0);
  const [failed, setFailed] = useState(false);
  const canGoBack = useRef(false);
  const [navigationRequests, setNavigationRequests] = useState<WidgetNavigationRequest[]>([]);
  const nextRequest = useRef(0);
  const [storage] = useState(() => createProjectedStorage({
    read: () => AsyncStorage.getItem(SAVE_KEY),
    write: (raw) => AsyncStorage.setItem(SAVE_KEY, raw),
  }, synchronizeWidgets, () => console.warn('[Widgets] Cache update failed; retrying on the next foreground refresh.')));
  const readSave = useCallback(async () => {
    return storage.read();
  }, [storage]);
  const writeSave = useCallback((raw: string) => {
    return storage.write(raw);
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
  const haptic = useCallback(async () => {
    await Haptics.selectionAsync().catch(() => {});
  }, []);
  const onCanGoBack = useCallback(async (value: boolean) => {
    canGoBack.current = value;
  }, []);
  useEffect(() => {
    const app = AppState.addEventListener("change", (next) => {
      setActive(next === "active");
      if (next === 'active') void storage.refreshProjection().catch(() => {});
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
  const fail = () => {
    void resetSceneCacheSession().catch(() => {});
    canGoBack.current = false;
    setFailed(true);
  };
  return (
    <SafeAreaView style={styles.shell}>
      <StatusBar style="dark" />
      <BlessingDom
        key={generation}
        readSave={readSave}
        readContentHistory={readContentHistory}
        readSceneAsset={readSceneAsset}
        writeContentHistory={writeContentHistory}
        fetchSceneAsset={fetchSceneAsset}
        cancelSceneAsset={cancelSceneAsset}
        protectSceneAssets={protectSceneAssets}
        releaseSceneAssets={releaseSceneAssets}
        maintainSceneCache={maintainSceneCache}
        catalogUrl={process.env.EXPO_PUBLIC_SCENE_CATALOG_URL ?? ""}
        manifestUrl={process.env.EXPO_PUBLIC_SCENE_MANIFEST_URL ?? ""}
        writeSave={writeSave}
        haptic={haptic}
        onCanGoBack={onCanGoBack}
        active={active}
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
          onError: fail,
          onContentProcessDidTerminate: fail,
          ...(Platform.OS === "android" ? { onRenderProcessGone: fail } : {}),
        }}
      />
      {failed && (
        <View style={styles.failure} accessibilityRole="alert">
          <Text style={styles.message}>
            画面暂时无法打开，已保存的记录仍在设备上。
          </Text>
          <Pressable
            style={styles.retry}
            onPress={() => {
              setFailed(false);
              setGeneration((n) => n + 1);
            }}
          >
            <Text style={styles.retryLabel}>重新打开</Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}
// Island shell colours (packages/app/src/style.css): the safe-area bands and
// the WebView's first paint are the mint page, like index.html's theme-color.
const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: "#cdf1e6" },
  webview: { flex: 1, backgroundColor: "#cdf1e6" },
  failure: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "#fbf3dc",
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
