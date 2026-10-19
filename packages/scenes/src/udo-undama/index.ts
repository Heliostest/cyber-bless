import type {SceneModule} from '../contract'
import {createUdoUndama} from './scene'
export const meta:SceneModule['meta']={id:'udo-undama',title:'龟岩投愿',traditionSlug:'udo-undama',grade:'C',sensitivity:'低',gestures:['drag']}
export const create=createUdoUndama
