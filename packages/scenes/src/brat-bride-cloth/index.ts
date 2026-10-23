import type {SceneModule} from '../contract'
import {createBratBrideCloth} from './scene'
export const meta:SceneModule['meta']={id:'brat-bride-cloth',title:'窗布祈护',traditionSlug:'brat-bride-cloth',grade:'C',sensitivity:'中',gestures:['drag']}
export const create=createBratBrideCloth
