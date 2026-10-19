import type {SceneModule} from '../contract'
import {createBonfimRibbon} from './scene'
export const meta:SceneModule['meta']={id:'bonfim-ribbon',title:'栏前结愿',traditionSlug:'bonfim-ribbon',grade:'C',sensitivity:'低',gestures:['drag']}
export const create=createBonfimRibbon
