import type {SceneModule} from '../contract'
import {createSpanishTwelveGrapes} from './scene'
export const meta:SceneModule['meta']={id:'spanish-twelve-grapes',title:'葡萄迎岁',traditionSlug:'spanish-twelve-grapes',grade:'C',sensitivity:'低',gestures:['drag']}
export const create=createSpanishTwelveGrapes
