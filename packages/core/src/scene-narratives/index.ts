import { sceneNarrativesA } from "./a.ts";
import { sceneNarrativesB } from "./b.ts";
import { sceneNarrativesC } from "./c.ts";
import { sceneNarrativesOriginal } from "./original.ts";

/** Reviewed introductions for both the App catalogue and /scene-review. */
export const sceneNarratives: Record<string, string> = {
  "alasita-miniature-house": "在玻利维亚拉巴斯的 Alasita，人们会获取代表所愿之物的微型物，房屋也是其中一类。它们与艾马拉丰饶神 Ekeko 的信仰相连。现实中的实践还包含安第斯仪式人士的祝圣或天主教神父的祝福，参与者将对生活的期盼寄于这些小小器物。\n\n眼前是一件原创造型的微型房屋。将它提起，转看门窗与屋顶，再安放到软垫上，想一想自己盼望的家。这里聚焦愿望器物的选取片段；房型、配色、软垫和三段动作是这次体验的安排，不代表固定礼序，也不替代现实的祝福。",
  "kitano-nadeushi": "京都北野天满宫的境内安置着多尊卧牛像。神社将牛视为天神菅原道真的神使，并介绍了轻抚牛头、祈愿学问成就的信仰。这份心意与求学者对天神的敬意相连。\n\n这里是一尊原创造型的石卧牛。将手掌靠近牛额，轻轻抚过，再慢慢收回，寄托学业顺遂的愿望。石牛静静伏在石座上，手掌顺着额面的弧度移动，最后回到身前。你可以把正在准备的功课和考试放在心里。",
  ...sceneNarrativesA,
  ...sceneNarrativesB,
  ...sceneNarrativesC,
  ...sceneNarrativesOriginal,
};
