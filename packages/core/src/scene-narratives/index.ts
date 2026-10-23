import { sceneNarrativesA } from "./a.ts";
import { sceneNarrativesB } from "./b.ts";
import { sceneNarrativesC } from "./c.ts";
import { sceneNarrativesOriginal } from "./original.ts";

/** Reviewed introductions for both the App catalogue and /scene-review. */
export const sceneNarratives: Record<string, string> = {
  "nanakusa-gayu": "日本1月7日的人日节句，有食用七草粥、祈愿无病息灾的习俗。春日若菜加入米粥，人们借这份行事食寄托对新一年安康的期盼。食材与料理因地区、家庭而有不同，这里不规定统一配方。\n\n眼前是一锅已经备好的菜粥。将木勺移入锅中轻拌，舀起一勺，再盛入碗中，为自己与牵挂的人寄一份安康祝愿。器形、配色、勺托和三段操作是这次体验的安排，聚焦盛食片段，不模拟供奉或实际食用，也不把盛好虚拟粥当作获得健康效果。",
  "alasita-miniature-house": "在玻利维亚拉巴斯的 Alasita，人们会获取代表所愿之物的微型物，房屋也是其中一类。它们与艾马拉丰饶神 Ekeko 的信仰相连。现实中的实践还包含安第斯仪式人士的祝圣或天主教神父的祝福，参与者将对生活的期盼寄于这些小小器物。\n\n眼前是一件原创造型的微型房屋。将它提起，转看门窗与屋顶，再安放到软垫上，想一想自己盼望的家。这里聚焦愿望器物的选取片段；房型、配色、软垫和三段动作是这次体验的安排，不代表固定礼序，也不替代现实的祝福。",
  ...sceneNarrativesA,
  ...sceneNarrativesB,
  ...sceneNarrativesC,
  ...sceneNarrativesOriginal,
};
