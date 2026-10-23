import { sceneNarrativesA } from "./a.ts";
import { sceneNarrativesB } from "./b.ts";
import { sceneNarrativesC } from "./c.ts";
import { sceneNarrativesOriginal } from "./original.ts";

/** Reviewed introductions for both the App catalogue and /scene-review. */
export const sceneNarratives: Record<string, string> = {
  "pucara-rooftop-bulls": "在秘鲁南部，Toritos de Pucará陶牛与当地的护家信念相连。一对陶牛被安放在屋顶，寄托守护家人、生活丰足的愿望。它们有陶土塑出的双角、卷尾和花饰，也有作为仪式容器的历史，与Pachamama及牲畜标记礼俗相连。屋顶陈设是这里选择的一段，不把不同家庭与工匠的做法归成唯一规则。\n\n眼前是一对已经备好的陶牛。托起它们脚下的木承板，移到屋脊上方，再轻轻落稳，为牵挂的家人寄一份平安的祝愿。陶牛的具体造型、配色、花饰、木板、屋形和承台是本次体验的设计；三段拖动、路径和时长也属于产品安排。安放完成，只表示眼前陶牛已摆好。愿家中安宁，日子丰足。",
  "alasita-miniature-house": "在玻利维亚拉巴斯的 Alasita，人们会获取代表所愿之物的微型物，房屋也是其中一类。它们与艾马拉丰饶神 Ekeko 的信仰相连。现实中的实践还包含安第斯仪式人士的祝圣或天主教神父的祝福，参与者将对生活的期盼寄于这些小小器物。\n\n眼前是一件原创造型的微型房屋。将它提起，转看门窗与屋顶，再安放到软垫上，想一想自己盼望的家。这里聚焦愿望器物的选取片段；房型、配色、软垫和三段动作是这次体验的安排，不代表固定礼序，也不替代现实的祝福。",
  ...sceneNarrativesA,
  ...sceneNarrativesB,
  ...sceneNarrativesC,
  ...sceneNarrativesOriginal,
};
