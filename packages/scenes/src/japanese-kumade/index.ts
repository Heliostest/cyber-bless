import type {SceneModule} from '../contract'
import {createJapaneseKumade} from './scene'
export const meta:SceneModule['meta']={id:'japanese-kumade',title:'熊手纳福',traditionSlug:'japanese-kumade',grade:'C',sensitivity:'低',gestures:['drag']}
export const create=createJapaneseKumade
