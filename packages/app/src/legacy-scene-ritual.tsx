import { localizedTitle } from './localization';
import { translate as tr } from '@wbr/i18n';
import { useState } from "react";
import type { RitualId } from "@wbr/core";
import { builtInScenes } from "./scene-library";
import { ProceduralScene } from "./scene-experience";
import { RitualNarrativeBlurb } from "./ritual-narrative";
import { SceneLoadFailure } from "./scene-load-failure";
/** Old session bookkeeping stays in Ritual; its interaction uses today's 3D engine. */
export function LegacySceneRitual({ kind, progress, checkpoint, returning }: {
    kind: Exclude<RitualId, "woodfish">;
    progress: number;
    checkpoint(n: number): void;
    returning: boolean;
}) {
    const [attempt, setAttempt] = useState(0);
    const [error, setError] = useState("");
    const entry = builtInScenes.find(entry => entry.id === kind)!;
    return <section className="scene-experience ritual-page" aria-label={localizedTitle(entry)}>
    <RitualNarrativeBlurb sceneId={kind}/>
    {error ? <SceneLoadFailure message={error} onRetry={() => { setError(""); setAttempt(n => n + 1); }}/> :
            <ProceduralScene key={attempt} entry={entry} progress={progress} checkpoint={checkpoint} returning={returning} failed={error => setError(error instanceof Error ? error.message : tr("\u573A\u666F\u753B\u9762\u6682\u4E0D\u53EF\u7528"))}/>}
  </section>;
}
