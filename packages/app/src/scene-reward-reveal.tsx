import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { SceneArt } from "./scene-icons";
import { shouldReduceMotion } from "./reward-flight";

type RevealProps = { sceneId: string; reducedMotion?: boolean };
type Phase = "appear" | "hold" | "leave" | "gone";

/**
 * Decorative completion feedback, using the existing keepsake illustration.
 * Mount only on this visit's first incomplete → complete transition. This
 * layer neither grants a reward nor replaces its later trip to 小天地.
 * Cultural facts and artwork stay unchanged; this is product feedback only.
 */
export function SceneRewardReveal(props: RevealProps) {
  return <Reveal key={props.sceneId} {...props} />;
}

function Reveal({ sceneId, reducedMotion = false }: RevealProps) {
  const reduced = shouldReduceMotion(reducedMotion);
  const anchor = useRef<HTMLSpanElement>(null);
  const expired = useRef(false);
  const [shell, setShell] = useState<Element | null>(null);
  const [phase, setPhase] = useState<Phase>(reduced ? "hold" : "appear");

  // Portalling before paint avoids the route's entrance transform or the
  // scene canvas becoming this foreground layer's positioning context.
  useLayoutEffect(() => {
    setShell(anchor.current?.closest(".app-shell") ?? null);
  }, []);

  useEffect(() => {
    if (expired.current) return;
    const timers: number[] = [];
    const later = (delay: number, next: Phase) => {
      timers.push(window.setTimeout(() => {
        if (next === "gone") expired.current = true;
        setPhase(next);
      }, delay));
    };
    setPhase(reduced ? "hold" : "appear");
    if (reduced) later(2000, "gone");
    else {
      later(700, "hold");
      later(3200, "leave");
      later(4000, "gone");
    }
    return () => timers.forEach(timer => window.clearTimeout(timer));
  }, [reduced]);

  const reveal = phase === "gone" ? null : (
    <div className="scene-reward-reveal" data-scene={sceneId} data-phase={phase}
      data-reduced={reduced} aria-hidden="true">
      <div className="scene-reward-reveal__position">
        <span className="scene-reward-reveal__glow" />
        <span className="scene-reward-reveal__shadow" />
        <div className="scene-reward-reveal__item"><SceneArt id={sceneId} /></div>
      </div>
    </div>
  );

  return <>
    <span ref={anchor} hidden aria-hidden="true" />
    {shell ? createPortal(reveal, shell) : reveal}
  </>;
}
