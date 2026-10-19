import type {SceneModule} from '../contract'
import {createJapaneseWagasa} from './scene'
export const meta:SceneModule['meta']={id:'japanese-wagasa',title:'纸伞舒晴',traditionSlug:'japanese-wagasa',grade:'C',sensitivity:'低',gestures:['drag']}
export const create=createJapaneseWagasa
