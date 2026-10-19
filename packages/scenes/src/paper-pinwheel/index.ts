import type {SceneModule} from '../contract'
import {createPaperPinwheel} from './scene'
export const meta:SceneModule['meta']={id:'paper-pinwheel',title:'纸翼转风',traditionSlug:'paper-pinwheel',grade:'C',sensitivity:'低',gestures:['drag']}
export const create=createPaperPinwheel
