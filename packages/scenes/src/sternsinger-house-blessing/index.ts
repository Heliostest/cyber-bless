import type {SceneModule} from '../contract'
import {createSternsingerHouseBlessing} from './scene'
export const meta:SceneModule['meta']={id:'sternsinger-house-blessing',title:'门楣祝家',traditionSlug:'sternsinger-house-blessing',grade:'C',sensitivity:'中',gestures:['drag']}
export const create=createSternsingerHouseBlessing
