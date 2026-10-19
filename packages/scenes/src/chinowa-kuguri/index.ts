import type {SceneModule} from '../contract'
import {createChinowaKuguri} from './scene'
export const meta:SceneModule['meta']={id:'chinowa-kuguri',title:'茅环祈安',traditionSlug:'chinowa-kuguri',grade:'C',sensitivity:'低',gestures:['drag']}
export const create=createChinowaKuguri
