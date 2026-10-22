import { sceneNarrativesA } from "./a.ts";
import { sceneNarrativesB } from "./b.ts";
import { sceneNarrativesC } from "./c.ts";
import { sceneNarrativesOriginal } from "./original.ts";

/** Reviewed introductions for both the App catalogue and /scene-review. */
export const sceneNarratives: Record<string, string> = {
  "finnish-virpominen": "在当代芬兰埃斯波的一种复活节邻里拜访中，孩子先征得主人同意，再挥动装饰好的猫柳枝，以祝词送上健康顺遂的祝愿。孩子把柳枝交给主人，主人将巧克力蛋等糖果放进访客的篮中答谢。不同社群的拜访对象、装扮与答谢时间各有差异。\n\n眼前的柳枝已经装饰好。轻挥柳枝，递出这份祝愿，再收下主人放入篮中的谢礼。纸花、门前小景和三段动作是为这次体验安排的原创分镜；它们留住互赠祝福的片刻，不代表一套各地通用的固定礼序。",
  ...sceneNarrativesA,
  ...sceneNarrativesB,
  ...sceneNarrativesC,
  ...sceneNarrativesOriginal,
};
