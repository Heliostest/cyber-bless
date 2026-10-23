import { sceneNarrativesA } from "./a.ts";
import { sceneNarrativesB } from "./b.ts";
import { sceneNarrativesC } from "./c.ts";
import { sceneNarrativesOriginal } from "./original.ts";

/** Reviewed introductions for both the App catalogue and /scene-review. */
export const sceneNarratives: Record<string, string> = {
  "brat-bride-cloth": "在爱尔兰的圣布里吉德节前夜，有人把一片布或缎带留在住宅外的窗台或门边，盼望圣人经过时赐予祝福。这种称作Brat Bríde或Ribín Bríde的留布习俗，与保护家人、减轻病苦的民俗信念相连。所记载的布形和用法有所不同，不能把某一种颜色、尺寸当作统一要求。\n\n暮色里，眼前是一方已经备好的布。将它从木凳提起，移向窗户外侧，再轻轻放到窗台，为自己与牵挂的人寄一份平安祝愿。窗框、布的造型、配色和三段操作是这次体验的安排。此刻铺好，只表示完成了放置；夜晚仍静静延续，留下的心意也由你自己珍藏。",
  "alasita-miniature-house": "在玻利维亚拉巴斯的 Alasita，人们会获取代表所愿之物的微型物，房屋也是其中一类。它们与艾马拉丰饶神 Ekeko 的信仰相连。现实中的实践还包含安第斯仪式人士的祝圣或天主教神父的祝福，参与者将对生活的期盼寄于这些小小器物。\n\n眼前是一件原创造型的微型房屋。将它提起，转看门窗与屋顶，再安放到软垫上，想一想自己盼望的家。这里聚焦愿望器物的选取片段；房型、配色、软垫和三段动作是这次体验的安排，不代表固定礼序，也不替代现实的祝福。",
  ...sceneNarrativesA,
  ...sceneNarrativesB,
  ...sceneNarrativesC,
  ...sceneNarrativesOriginal,
};
