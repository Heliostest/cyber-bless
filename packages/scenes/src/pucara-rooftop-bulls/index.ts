import type {SceneModule} from '../contract'
import {createPucara} from './scene'
export const meta:SceneModule['meta']={id:'pucara-rooftop-bulls',title:'陶牛护家',traditionSlug:'pucara-rooftop-bulls',grade:'C',sensitivity:'中',gestures:['drag']}
export const create=createPucara
