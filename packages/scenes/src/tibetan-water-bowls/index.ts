import type {SceneModule} from '../contract'
import {createTibetanWaterBowls} from './scene'
export const meta:SceneModule['meta']={id:'tibetan-water-bowls',title:'清水七供',traditionSlug:'tibetan-water-bowls',grade:'C',sensitivity:'中',gestures:['drag']}
export const create=createTibetanWaterBowls
