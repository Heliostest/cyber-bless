import type {SceneModule} from '../contract'
import {createPrayerFlags} from './scene'
export const meta:SceneModule['meta']={id:'tibetan-prayer-flags',title:'经幡迎风',traditionSlug:'tibetan-prayer-flags',grade:'C',sensitivity:'低',gestures:['drag']}
export const create=createPrayerFlags
