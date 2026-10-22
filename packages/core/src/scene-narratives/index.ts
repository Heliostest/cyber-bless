import { sceneNarrativesA } from "./a.ts";
import { sceneNarrativesB } from "./b.ts";
import { sceneNarrativesC } from "./c.ts";
import { sceneNarrativesOriginal } from "./original.ts";

/** Reviewed introductions for both the App catalogue and /scene-review. */
export const sceneNarratives: Record<string, string> = {
  "kitano-nadeushi": "京都北野天满宫的境内安置着多尊卧牛像。神社将牛视为天神菅原道真的神使，并介绍了轻抚牛头、祈愿学问成就的信仰。这份心意与求学者对天神的敬意相连。\n\n这里是一尊原创造型的石卧牛。将手掌靠近牛额，轻轻抚过，再慢慢收回，寄托学业顺遂的愿望。石牛静静伏在石座上，手掌顺着额面的弧度移动，最后回到身前。你可以把正在准备的功课和考试放在心里。",
  ...sceneNarrativesA,
  ...sceneNarrativesB,
  ...sceneNarrativesC,
  ...sceneNarrativesOriginal,
};
