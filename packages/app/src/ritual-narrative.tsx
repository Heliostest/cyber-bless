import { builtInScenes } from "./scene-library";

export function RitualNarrativeBlurb({ sceneId, completion }: { sceneId: string; completion?: string }) {
  const narrative = builtInScenes.find((e) => e.id === sceneId)?.narrative?.trim();
  if (!narrative && !completion) return null;
  return (
    <div className="ritual-narrative-header">
      {narrative && <details className="ritual-narrative">
        <summary>了解这个仪式</summary>
        <p>{narrative}</p>
      </details>}
      {completion && <p className="scene-complete-status" role="status">{completion}</p>}
    </div>
  );
}
