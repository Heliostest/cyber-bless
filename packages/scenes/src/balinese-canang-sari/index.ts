import type {SceneModule} from '../contract'
import {createBalineseCanangSari} from './scene'
export const meta:SceneModule['meta']={id:'balinese-canang-sari',title:'叶盘献谢',traditionSlug:'balinese-canang-sari',grade:'C',sensitivity:'中',gestures:['drag']}
export const create=createBalineseCanangSari
