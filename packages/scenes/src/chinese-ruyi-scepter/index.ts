import type {SceneModule} from '../contract'
import {createChineseRuyiScepter} from './scene'
export const meta:SceneModule['meta']={id:'chinese-ruyi-scepter',title:'如意寄愿',traditionSlug:'chinese-ruyi-scepter',grade:'C',sensitivity:'低',gestures:['drag']}
export const create=createChineseRuyiScepter
