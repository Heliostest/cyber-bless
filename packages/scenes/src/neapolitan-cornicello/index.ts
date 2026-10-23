import type {SceneModule} from '../contract'
import {createNeapolitanCornicello} from './scene'
export const meta:SceneModule['meta']={id:'neapolitan-cornicello',title:'红角赠福',traditionSlug:'neapolitan-cornicello',grade:'C',sensitivity:'低',gestures:['drag']}
export const create=createNeapolitanCornicello
