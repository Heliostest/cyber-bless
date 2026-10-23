import { sceneNarrativesA } from "./a.ts";
import { sceneNarrativesB } from "./b.ts";
import { sceneNarrativesC } from "./c.ts";
import { sceneNarrativesOriginal } from "./original.ts";

/** Reviewed introductions for both the App catalogue and /scene-review. */
export const sceneNarratives: Record<string, string> = {
  "uchide-wishing-mallet": "打出小槌与日本的招福、愿望传说相连。射水神社在一次节分活动记录中，写下家人摇动小槌寄愿的场景，并将它解释为带着心愿轻摇的宝物。一寸法师故事中的神奇力量属于传说；这里保留其信仰与故事背景，不把摇槌写成现实中必定实现愿望的方法，也不把某次活动当成所有地方的统一礼序。\n\n眼前的小槌已经安在木托上。轻轻托起槌柄，让小槌在空中摇动，再放回原处，为心中所盼寄一份祝福。木质红漆、金色边圈、柄端绳穗和双托架是本次原创造型，三段拖动与这一次轻摇的方向、幅度和时长也属于产品安排。小槌放稳，只表示眼前的动作完成。愿所盼有新的进展，也愿前行的脚步安稳。",
  "alasita-miniature-house": "在玻利维亚拉巴斯的 Alasita，人们会获取代表所愿之物的微型物，房屋也是其中一类。它们与艾马拉丰饶神 Ekeko 的信仰相连。现实中的实践还包含安第斯仪式人士的祝圣或天主教神父的祝福，参与者将对生活的期盼寄于这些小小器物。\n\n眼前是一件原创造型的微型房屋。将它提起，转看门窗与屋顶，再安放到软垫上，想一想自己盼望的家。这里聚焦愿望器物的选取片段；房型、配色、软垫和三段动作是这次体验的安排，不代表固定礼序，也不替代现实的祝福。",
  ...sceneNarrativesA,
  ...sceneNarrativesB,
  ...sceneNarrativesC,
  ...sceneNarrativesOriginal,
};
