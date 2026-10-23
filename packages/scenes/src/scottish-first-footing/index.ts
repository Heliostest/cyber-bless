import type {SceneModule} from '../contract'
import {createScottishFirstFooting} from './scene'
export const meta:SceneModule['meta']={id:'scottish-first-footing',title:'煤火迎年',traditionSlug:'scottish-first-footing',grade:'C',sensitivity:'低',gestures:['drag']}
export const create=createScottishFirstFooting
