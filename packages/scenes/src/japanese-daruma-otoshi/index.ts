import type {SceneModule} from '../contract'
import {createJapaneseDarumaOtoshi} from './scene'
export const meta:SceneModule['meta']={id:'japanese-daruma-otoshi',title:'木槌落片',traditionSlug:'japanese-daruma-otoshi',grade:'C',sensitivity:'低',gestures:['drag']}
export const create=createJapaneseDarumaOtoshi
