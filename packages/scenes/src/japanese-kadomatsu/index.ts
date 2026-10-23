import type {SceneModule} from '../contract'
import {createKadomatsu} from './scene'
export const meta:SceneModule['meta']={id:'japanese-kadomatsu',title:'门松迎岁',traditionSlug:'japanese-kadomatsu',grade:'C',sensitivity:'中',gestures:['drag']}
export const create=createKadomatsu
