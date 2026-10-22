import type {SceneModule} from '../contract'
import {createYushengLohei} from './scene'
export const meta:SceneModule['meta']={id:'yusheng-lohei',title:'鱼生捞起',traditionSlug:'yusheng-lohei',grade:'C',sensitivity:'中',gestures:['drag']}
export const create=createYushengLohei
