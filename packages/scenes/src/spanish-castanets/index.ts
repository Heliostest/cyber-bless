import type {SceneModule} from '../contract'
import {createSpanishCastanets} from './scene'
export const meta:SceneModule['meta']={id:'spanish-castanets',title:'木壳轻拍',traditionSlug:'spanish-castanets',grade:'C',sensitivity:'低',gestures:['drag']}
export const create=createSpanishCastanets
