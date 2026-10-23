import type {SceneModule} from '../contract'
import {createHorseshoeDoorwayLuck} from './scene'
export const meta:SceneModule['meta']={id:'horseshoe-doorway-luck',title:'蹄铁护家',traditionSlug:'horseshoe-doorway-luck',grade:'C',sensitivity:'低',gestures:['drag']}
export const create=createHorseshoeDoorwayLuck
