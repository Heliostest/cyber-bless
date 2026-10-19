import type {SceneModule} from '../contract'
import {createGardenCroquet} from './scene'
export const meta:SceneModule['meta']={id:'garden-croquet',title:'草坪过门',traditionSlug:'garden-croquet',grade:'C',sensitivity:'低',gestures:['drag']}
export const create=createGardenCroquet
