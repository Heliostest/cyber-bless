import type {SceneModule} from '../contract'
import {createVasilopita} from './scene'
export const meta:SceneModule['meta']={id:'greek-vasilopita',title:'新岁分糕',traditionSlug:'greek-vasilopita',grade:'C',sensitivity:'低',gestures:['drag']}
export const create=createVasilopita
