import { sceneNarrativesA } from "./a.ts";
import { sceneNarrativesB } from "./b.ts";
import { sceneNarrativesC } from "./c.ts";
import { sceneNarrativesOriginal } from "./original.ts";

/** Reviewed introductions for both the App catalogue and /scene-review. */
export const sceneNarratives: Record<string, string> = {
  "korean-sotdae": "在韩国的一些村落，顶着木鸟的长竿称作솟대。人们将它立在村落入口，寄托护佑村落、向天祈愿的心意。木鸟有鸭形等不同造型，相关村祭也有地方差异；它与村落信仰相连，不能只当作普通的木工装饰。\n\n眼前是一根已经备好的木鸟长竿。从木托上将它提起，缓缓扶正，再让竿脚稳稳落下，为家园与牵挂的人留一份平安祝愿。这里呈现立竿的准备片段，木鸟造型、木环、托架、承孔与三段动作都是本次体验的安排。竿脚落稳，只表示完成了眼前的安放；愿日常安宁，所爱之人平安。",
  "alasita-miniature-house": "在玻利维亚拉巴斯的 Alasita，人们会获取代表所愿之物的微型物，房屋也是其中一类。它们与艾马拉丰饶神 Ekeko 的信仰相连。现实中的实践还包含安第斯仪式人士的祝圣或天主教神父的祝福，参与者将对生活的期盼寄于这些小小器物。\n\n眼前是一件原创造型的微型房屋。将它提起，转看门窗与屋顶，再安放到软垫上，想一想自己盼望的家。这里聚焦愿望器物的选取片段；房型、配色、软垫和三段动作是这次体验的安排，不代表固定礼序，也不替代现实的祝福。",
  ...sceneNarrativesA,
  ...sceneNarrativesB,
  ...sceneNarrativesC,
  ...sceneNarrativesOriginal,
};
