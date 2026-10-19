import type {SceneModule} from '../contract'
import {createFgsBuddhaBathing} from './scene'
export const meta:SceneModule['meta']={id:'fgs-buddha-bathing',title:'浴佛发愿',traditionSlug:'fgs-buddha-bathing',grade:'C',sensitivity:'低',gestures:['drag']}
export const create=createFgsBuddhaBathing
