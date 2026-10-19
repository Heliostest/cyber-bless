import type {SceneModule} from '../contract'
import {createEsfand} from './scene'
export const meta:SceneModule['meta']={id:'persian-esfand',title:'熏籽祈安',traditionSlug:'persian-esfand',grade:'C',sensitivity:'低',gestures:['drag']}
export const create=createEsfand
