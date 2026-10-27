import { translate as tr } from '@wbr/i18n';
import { useEffect, useRef, useState } from 'react';
import { localDay, openingExclusions } from '@wbr/core';
import { resolveWidgetScene, type WidgetNavigationRequest } from '@wbr/core/widgets';
import { useApp, type Route } from './context';
import { useOpenScene, useSceneLibrary } from './scene-library';
/** Conservative guard: a visit or an editable page stays mounted until its user leaves. */
const protectedPages = new Set<Route['page']>(['new', 'note', 'fulfill', 'scene', 'ritual', 'complete']);
export function WidgetNavigation({ request, route, saved, busy, onConsumed }: {
    request?: WidgetNavigationRequest;
    route: Route;
    saved: boolean;
    busy: boolean;
    onConsumed?: (requestId: number) => Promise<void>;
}) {
    const { active, go, state } = useApp();
    const openingActive = !!state.opening && state.opening.status !== 'complete';
    const { entries } = useSceneLibrary();
    const openScene = useOpenScene();
    const handled = useRef<number | undefined>(undefined);
    const target = useRef<{
        requestId: number;
        sceneId?: string;
    } | undefined>(undefined);
    const [retry, setRetry] = useState(0);
    const actions = useRef({ go, openScene, onConsumed });
    actions.current = { go, openScene, onConsumed };
    const blocked = protectedPages.has(route.page) || busy || openingActive;
    useEffect(() => {
        if (!request || handled.current === request.requestId || !active)
            return;
        let disposed = false;
        let timer: ReturnType<typeof setTimeout> | undefined;
        const acknowledge = () => {
            handled.current = request.requestId;
            void Promise.resolve(actions.current.onConsumed?.(request.requestId)).catch(() => {
                if (!disposed) {
                    handled.current = undefined;
                    timer = setTimeout(() => setRetry(n => n + 1), 3000);
                }
            });
        };
        const pending = target.current;
        if (pending?.requestId === request.requestId) {
            // This effect follows the route render; acknowledgement cannot get ahead of it.
            if (pending.sceneId ? route.page === 'scene' && route.id === pending.sceneId : route.page === 'today')
                acknowledge();
        }
        else if (saved && !blocked) {
            const day = localDay();
            const entry = resolveWidgetScene(request, day, entries, openingExclusions(state.opening, day));
            target.current = { requestId: request.requestId, sceneId: entry?.id };
            if (entry)
                actions.current.openScene(entry, { daily: day });
            else
                actions.current.go({ page: 'today' });
        }
        return () => { disposed = true; if (timer)
            clearTimeout(timer); };
    }, [request, route, saved, blocked, active, entries, retry, state.opening]);
    if (openingActive)
        return null;
    if (!request || handled.current === request.requestId || target.current?.requestId === request.requestId || (saved && !blocked))
        return null;
    return <div className="widget-entry-notice" role="status">
    <span>{saved ? tr("\u5148\u5B8C\u6210\u5F53\u524D\u9875\u9762\uFF0C\u518D\u6253\u5F00\u4ECA\u65E5\u4EEA\u5F0F\u3002") : tr("\u8BB0\u5F55\u4FDD\u5B58\u540E\uFF0C\u518D\u6253\u5F00\u4ECA\u65E5\u4EEA\u5F0F\u3002")}</span>
    <button onClick={() => {
            handled.current = request.requestId;
            void actions.current.onConsumed?.(request.requestId).catch(() => { handled.current = undefined; setRetry(n => n + 1); });
            setRetry(n => n + 1);
        }}>{tr("\u7559\u5728\u8FD9\u91CC")}</button>
  </div>;
}
