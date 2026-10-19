import type {SceneModule} from '../contract'
import {createTamagushi} from './scene'
export const meta:SceneModule['meta']={id:'tamagushi-offering',title:'玉串奉愿',traditionSlug:'tamagushi-offering',grade:'C',sensitivity:'低',gestures:['drag']}
export const create=createTamagushi
