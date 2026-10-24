import { useEffect, type RefObject } from "react";

/** Keep the ritual in the visible phone screen, including above a keyboard. */
export function useSceneViewport(ref: RefObject<HTMLElement | null>, active: boolean) {
  useEffect(() => {
    const shell = ref.current;
    if (!active || !shell) return;
    const viewport = window.visualViewport;
    const update = () => {
      shell.style.setProperty("--scene-viewport-height", `${viewport?.height || window.innerHeight}px`);
    };
    const roots = [document.documentElement, document.body];
    const previous = roots.map(element => ({
      overflow: element.style.overflow,
      overscroll: element.style.overscrollBehavior,
    }));
    for (const element of roots) {
      element.style.overflow = "hidden";
      element.style.overscrollBehavior = "none";
    }
    update();
    window.addEventListener("resize", update);
    viewport?.addEventListener("resize", update);
    return () => {
      window.removeEventListener("resize", update);
      viewport?.removeEventListener("resize", update);
      shell.style.removeProperty("--scene-viewport-height");
      roots.forEach((element, index) => {
        element.style.overflow = previous[index].overflow;
        element.style.overscrollBehavior = previous[index].overscroll;
      });
    };
  }, [ref, active]);
}
