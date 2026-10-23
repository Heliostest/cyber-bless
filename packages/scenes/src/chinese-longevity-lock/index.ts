import type {SceneModule} from '../contract'
import {createLongevityLock} from './scene'
export const meta:SceneModule['meta']={id:'chinese-longevity-lock',title:'银锁寄安',traditionSlug:'chinese-longevity-lock',grade:'C',sensitivity:'中',gestures:['drag']}
export const create=createLongevityLock
