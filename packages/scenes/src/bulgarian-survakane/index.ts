import type {SceneModule} from '../contract'
import {createBulgarianSurvakane} from './scene'
export const meta:SceneModule['meta']={id:'bulgarian-survakane',title:'彩枝贺年',traditionSlug:'bulgarian-survakane',grade:'C',sensitivity:'低',gestures:['drag']}
export const create=createBulgarianSurvakane
