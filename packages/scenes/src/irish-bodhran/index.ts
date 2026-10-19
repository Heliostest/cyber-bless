import type {SceneModule} from '../contract'
import {createIrishBodhran} from './scene'
export const meta:SceneModule['meta']={id:'irish-bodhran',title:'鼓面轻拍',traditionSlug:'irish-bodhran',grade:'C',sensitivity:'低',gestures:['drag']}
export const create=createIrishBodhran
