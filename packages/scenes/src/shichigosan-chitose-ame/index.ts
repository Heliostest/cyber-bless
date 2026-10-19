import type {SceneModule} from '../contract'
import {createChitoseAme} from './scene'
export const meta:SceneModule['meta']={id:'shichigosan-chitose-ame',title:'千岁赠糖',traditionSlug:'shichigosan-chitose-ame',grade:'C',sensitivity:'低',gestures:['drag']}
export const create=createChitoseAme
