import { sceneNarrativesA } from "./a.ts";
import { sceneNarrativesB } from "./b.ts";
import { sceneNarrativesC } from "./c.ts";
import { sceneNarrativesOriginal } from "./original.ts";

/** Reviewed introductions for both the App catalogue and /scene-review. */
export const sceneNarratives: Record<string, string> = {
  "japanese-kadomatsu": "在日本的正月迎神习俗中，门松立在门口或玄关，作为迎接年神的标识。松枝与竹相伴，也有成对摆放的做法。人们带着迎接新岁与神明眷顾的心意准备门前陈设；它与信仰相连，并非只是普通的盆栽装饰。各地做法有所不同，不能把某一种造型和朝向当作统一要求。\n\n眼前的松竹门松已经备好。将草束轻轻提离木托，向右移到门边，再缓缓放稳，与另一侧组成一对，为自己和家人留一份新岁平安的祝愿。三段操作、草束与松竹的具体造型、绳圈、木门和托盘是本次体验的安排。门松摆好，只表示眼前的安放完成；愿新的日子安宁，脚步从容。",
  "alasita-miniature-house": "在玻利维亚拉巴斯的 Alasita，人们会获取代表所愿之物的微型物，房屋也是其中一类。它们与艾马拉丰饶神 Ekeko 的信仰相连。现实中的实践还包含安第斯仪式人士的祝圣或天主教神父的祝福，参与者将对生活的期盼寄于这些小小器物。\n\n眼前是一件原创造型的微型房屋。将它提起，转看门窗与屋顶，再安放到软垫上，想一想自己盼望的家。这里聚焦愿望器物的选取片段；房型、配色、软垫和三段动作是这次体验的安排，不代表固定礼序，也不替代现实的祝福。",
  ...sceneNarrativesA,
  ...sceneNarrativesB,
  ...sceneNarrativesC,
  ...sceneNarrativesOriginal,
};
