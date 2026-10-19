import type {SceneModule} from '../contract'
import {createChineseSteelyard} from './scene'
export const meta:SceneModule['meta']={id:'chinese-steelyard',title:'移砣平衡',traditionSlug:'chinese-steelyard',grade:'C',sensitivity:'低',gestures:['drag']}
export const create=createChineseSteelyard
