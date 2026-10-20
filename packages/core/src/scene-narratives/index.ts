import { sceneNarrativesA } from "./a.ts";
import { sceneNarrativesB } from "./b.ts";
import { sceneNarrativesC } from "./c.ts";
import { sceneNarrativesOriginal } from "./original.ts";

/** Reviewed introductions for both the App catalogue and /scene-review. */
export const sceneNarratives: Record<string, string> = {
  ...sceneNarrativesA,
  ...sceneNarrativesB,
  ...sceneNarrativesC,
  ...sceneNarrativesOriginal,
};
