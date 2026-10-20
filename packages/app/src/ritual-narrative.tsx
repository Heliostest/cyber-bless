import { builtInScenes } from "./scene-library";

export function RitualNarrativeBlurb({ sceneId, completion }: { sceneId: string; completion?: string }) {
  const scene = builtInScenes.find((e) => e.id === sceneId);
  const narrative = scene?.narrative?.trim();
  if (!narrative && !completion) return null;
  return (
    <div className="ritual-narrative-header">
      {narrative && <details className="ritual-narrative">
        <summary>了解这个仪式</summary>
        <div className="ritual-narrative-body" role="region" aria-label={`${scene?.title}的介绍`} tabIndex={0}>
          {narrative.split(/\n\s*\n/).map((paragraph, index) => <p key={index}>{paragraph}</p>)}
        </div>
      </details>}
      {completion && <p className="scene-complete-status" role="status">{completion}</p>}
    </div>
  );
}
