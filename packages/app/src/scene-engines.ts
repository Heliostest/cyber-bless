import { createSceneRegistry, type SceneController } from "@wbr/scene-runtime";
import type { createContentClient } from "@wbr/content";

export type WoodfishContext = {
  sceneId?: string;
  content: ReturnType<typeof createContentClient>;
  decodeSound(bytes: ArrayBuffer): Promise<AudioBuffer>;
  onInstruction(text: string): void;
  impact(sound?: AudioBuffer): void;
};
export interface WoodfishController extends SceneController {
  strike(): void;
  /** Resolves once the strike queue is empty and no swing is running. */
  whenIdle(): Promise<void>;
  movePointer(x: number, y: number, immediate?: boolean): void;
  stopFollowing(): void;
  inspect(view: string): void;
}
export const sceneEngines = createSceneRegistry({
  "ema-votive-plaque@1": () => import("./procedural-scene").then(m => m.proceduralEngine("ema-votive-plaque")),
  "clootie-well-rag@1": () => import("./procedural-scene").then(m => m.proceduralEngine("clootie-well-rag")),
  "diya-oil-lamp@1": () => import("./procedural-scene").then(m => m.proceduralEngine("diya-oil-lamp")),
  "votive-candle-catholic@1": () => import("./procedural-scene").then(m => m.proceduralEngine("votive-candle-catholic")),
  "daruma-eye-painting@1": () => import("./procedural-scene").then(m => m.proceduralEngine("daruma-eye-painting")),
  "mizuhiki@1": () => import("./procedural-scene").then(m => m.proceduralEngine("mizuhiki")),
  "milagros@1": () => import("./procedural-scene").then(m => m.proceduralEngine("milagros")),
  "phuang-malai@1": () => import("./procedural-scene").then(m => m.proceduralEngine("phuang-malai")),
  "woodfish@1": () =>
    import("./woodfish-scene").then((module) => module.woodfishEngine),
  "celtic-folk-spring@1": () => import("./procedural-scene").then(m => m.proceduralEngine("celtic-folk-spring")),
  "theravada-water@1": () => import("./procedural-scene").then(m => m.proceduralEngine("theravada-water")),
  "tanzaku-tanabata@1": () => import("./procedural-scene").then(m => m.proceduralEngine("tanzaku-tanabata")),
  "yeondeunghoe@1": () => import("./procedural-scene").then(m => m.proceduralEngine("yeondeunghoe")),
  "furin-wind-chime@1": () => import("./procedural-scene").then(m => m.proceduralEngine("furin-wind-chime")),
  "shinto-torii@1": () => import("./procedural-scene").then(m => m.proceduralEngine("shinto-torii")),
  "tibetan-wheel@1": () => import("./procedural-scene").then(m => m.proceduralEngine("tibetan-wheel")),
  "slavic-wreath@1": () => import("./procedural-scene").then(m => m.proceduralEngine("slavic-wreath")),
  "crane@1": () => import("./procedural-scene").then(m => m.proceduralEngine("crane")),
  "lantern@1": () => import("./procedural-scene").then(m => m.proceduralEngine("lantern")),
});
