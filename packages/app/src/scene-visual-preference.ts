import { useEffect, useRef, type RefObject } from "react";
import { sceneStyles } from "@wbr/scene-runtime/debug-styles";
import { useApp } from "./context";

/** Bind the host save to this mounted scene only, including lazy engine creation. */
export function useSceneVisualPreference(id: string, cancelInput: () => void, host: RefObject<HTMLElement | null>) {
  const { state } = useApp();
  const preference = state.visualStyles?.[id];
  const latest = useRef({ preference, cancelInput }); latest.current = { preference, cancelInput };
  const owner = useRef<ReturnType<typeof sceneStyles.connectUserPreference> | null>(null);
  useEffect(() => {
    const connection = sceneStyles.connectUserPreference(id, latest.current.preference, () => latest.current.cancelInput(), host.current?.closest(".app-shell") ?? undefined);
    owner.current = connection;
    return () => { connection.dispose(); owner.current = null; };
  }, [id]);
  useEffect(() => { owner.current?.update(preference); }, [id, preference]);
}
