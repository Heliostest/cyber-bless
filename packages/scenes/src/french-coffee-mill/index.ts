import type {SceneModule} from '../contract'
import {createFrenchCoffeeMill} from './scene'
export const meta:SceneModule['meta']={id:'french-coffee-mill',title:'手磨晨光',traditionSlug:'french-coffee-mill',grade:'C',sensitivity:'低',gestures:['drag']}
export const create=createFrenchCoffeeMill
