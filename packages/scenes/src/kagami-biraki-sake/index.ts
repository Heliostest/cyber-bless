import type {SceneModule} from '../contract'
import {createKagamiBirakiSake} from './scene'
export const meta:SceneModule['meta']={id:'kagami-biraki-sake',title:'开樽祝愿',traditionSlug:'kagami-biraki-sake',grade:'C',sensitivity:'中',gestures:['drag']}
export const create=createKagamiBirakiSake
