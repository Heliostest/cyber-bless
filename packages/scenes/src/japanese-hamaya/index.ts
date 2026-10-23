import type {SceneModule} from '../contract'
import {createJapaneseHamaya} from './scene'
export const meta:SceneModule['meta']={id:'japanese-hamaya',title:'饰矢祈安',traditionSlug:'japanese-hamaya',grade:'C',sensitivity:'低',gestures:['drag']}
export const create=createJapaneseHamaya
