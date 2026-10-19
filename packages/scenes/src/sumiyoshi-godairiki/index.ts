import type {SceneModule} from '../contract'
import {createSumiyoshiGodairiki} from './scene'
export const meta:SceneModule['meta']={id:'sumiyoshi-godairiki',title:'三石寄愿',traditionSlug:'sumiyoshi-godairiki',grade:'C',sensitivity:'低',gestures:['drag']}
export const create=createSumiyoshiGodairiki
