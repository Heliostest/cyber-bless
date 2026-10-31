import { useLayoutEffect, type ReactNode, type RefObject } from "react";

export function PageTitle({ title }: { title: string }) {
  return (
    <h1 className="title-ribbon" title={title}>
      {title}
    </h1>
  );
}

/** Measure the actual controls: translations and font changes need no scene remount. */
export function useAppLayout(ref: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const shell = ref.current;
    if (!shell) return;
    let frame = 0, disposed = false;
    const observed = new Set<Element>();
    const observe = (element: Element | null) => {
      if (element && !observed.has(element)) { observed.add(element); observer?.observe(element); }
    };
    const measure = () => {
      if (disposed) return;
      for (const element of observed) if (element !== shell && !shell.contains(element)) {
        observer?.unobserve(element); observed.delete(element);
      }
      shell.toggleAttribute("data-large-text", (parseFloat(getComputedStyle(shell).fontSize) || 16) > 20);
      const dock = shell.querySelector<HTMLElement>(".bottom-nav");
      if (dock) {
        const css = getComputedStyle(dock);
        const reserve = Math.ceil(dock.getBoundingClientRect().height + (parseFloat(css.bottom) || 10) + 18);
        shell.style.setProperty("--app-dock-space", `${reserve}px`);
        observe(dock);
      } else shell.style.removeProperty("--app-dock-space");
      const content = shell.querySelector<HTMLElement>(".app-content");
      const experience = content?.querySelector<HTMLElement>(".scene-experience, .ritual-page, .completion");
      const stage = experience?.querySelector<HTMLElement>(".library-scene-stage, .celebration");
      if (!shell.hasAttribute("data-immersive") || !content || !experience || !stage) {
        shell.removeAttribute("data-layout-scroll"); return;
      }
      const stageCss = getComputedStyle(stage), contentCss = getComputedStyle(content);
      const minimumCanvas = Math.max(224, (parseFloat(stageCss.fontSize) || 16) * 10);
      const guide = stage.querySelector<HTMLElement>(".scene-cue-guides:not([hidden])");
      const tray = parseFloat(stageCss.getPropertyValue("--tray")) ||
        (guide ? Math.max(112, guide.getBoundingClientRect().height + 88) : stage.classList.contains("library-scene-stage") ? 132 : 0);
      const wish = parseFloat(stageCss.getPropertyValue("--wish-box")) || 0;
      const stageMinimum = minimumCanvas + tray + wish + 8;
      shell.style.setProperty("--scene-min-canvas", `${minimumCanvas}px`);
      shell.style.setProperty("--scene-min-stage", `${stageMinimum}px`);
      const children = [...experience.children].filter((element): element is HTMLElement =>
        element instanceof HTMLElement && element !== stage && getComputedStyle(element).display !== "none");
      const extras = children.reduce((height, element) => {
        const css = getComputedStyle(element);
        observe(element);
        // Absolutely positioned editors overlay the scene and have their own scroll region.
        return css.position === "absolute" ? height : height + element.getBoundingClientRect().height +
          (parseFloat(css.marginTop) || 0) + (parseFloat(css.marginBottom) || 0);
      }, 0);
      const gap = parseFloat(getComputedStyle(experience).rowGap) || 0;
      const available = content.getBoundingClientRect().height -
        (parseFloat(contentCss.paddingTop) || 0) - (parseFloat(contentCss.paddingBottom) || 0);
      // The editor overlays the stage and owns its scrolling. A minimum-height
      // scene here would anchor the editor below the keyboard's visible area.
      const writingWish = !!experience.querySelector(".scene-post-wish form");
      const needsScroll = !writingWish && available > 0 && stageMinimum + extras + gap * children.length > available;
      if (needsScroll) shell.setAttribute("data-layout-scroll", "true");
      else shell.removeAttribute("data-layout-scroll");
      observe(content); observe(stage); observe(experience);
    };
    const schedule = () => {
      if (disposed || frame) return;
      frame = requestAnimationFrame(() => { frame = 0; measure(); });
    };
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(schedule) : undefined;
    const changes = typeof MutationObserver === "function" ? new MutationObserver(schedule) : undefined;
    changes?.observe(shell, { subtree: true, childList: true, characterData: true,
      attributes: true, attributeFilter: ["hidden", "data-page", "data-immersive"] });
    const language = typeof MutationObserver === "function" ? new MutationObserver(schedule) : undefined;
    language?.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
    window.addEventListener("resize", schedule);
    window.visualViewport?.addEventListener("resize", schedule);
    document.fonts?.addEventListener("loadingdone", schedule);
    document.fonts?.ready?.then(() => { if (!disposed) schedule(); });
    observe(shell); measure();
    return () => {
      disposed = true; if (frame) cancelAnimationFrame(frame);
      observer?.disconnect(); changes?.disconnect(); language?.disconnect();
      window.removeEventListener("resize", schedule);
      window.visualViewport?.removeEventListener("resize", schedule);
      document.fonts?.removeEventListener("loadingdone", schedule);
      shell.style.removeProperty("--app-dock-space");
      shell.style.removeProperty("--scene-min-canvas"); shell.style.removeProperty("--scene-min-stage");
      shell.removeAttribute("data-layout-scroll");
      shell.removeAttribute("data-large-text");
    };
  }); // The first render may contain only the asynchronous storage loading screen.
}

/** One title row and one optional line of supporting copy on every page. */
export function PageHead({
  title,
  eyebrow,
  children,
}: {
  title: string;
  eyebrow?: string;
  children?: ReactNode;
}) {
  return (
    <header className="page-heading">
      <div className="page-heading-row">
        <PageTitle title={title} />
        {children && <div className="page-heading-actions">{children}</div>}
      </div>
      {eyebrow && <p className="page-tagline">{eyebrow}</p>}
    </header>
  );
}
