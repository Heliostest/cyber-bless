import type {SceneModule} from '../contract'
import {createRomanianMartisor} from './scene'
export const meta:SceneModule['meta']={id:'romanian-martisor',title:'红白寄春',traditionSlug:'romanian-martisor',grade:'C',sensitivity:'低',gestures:['drag']}
export const create=createRomanianMartisor
