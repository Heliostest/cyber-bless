import type {SceneModule} from '../contract'
import {createChineseFuPaper} from './scene'
export const meta:SceneModule['meta']={id:'chinese-fu-paper',title:'贴福迎春',traditionSlug:'chinese-fu-paper',grade:'C',sensitivity:'低',gestures:['drag']}
export const create=createChineseFuPaper
