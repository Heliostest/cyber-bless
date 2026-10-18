import type {SceneModule} from '../contract'
import {createJapaneseShishiOdoshi} from './scene'
export const meta:SceneModule['meta']={id:'japanese-shishi-odoshi',title:'竹筒叩石',traditionSlug:'japanese-shishi-odoshi',grade:'C',sensitivity:'低',gestures:['drag']}
export const create=createJapaneseShishiOdoshi
