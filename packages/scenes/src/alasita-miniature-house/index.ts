import type {SceneModule} from '../contract'
import {createAlasitaMiniatureHouse} from './scene'
export const meta:SceneModule['meta']={id:'alasita-miniature-house',title:'微屋寄愿',traditionSlug:'aymara',grade:'C',sensitivity:'中',gestures:['drag']}
export const create=createAlasitaMiniatureHouse
