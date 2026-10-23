import type {SceneModule} from '../contract'
import {createNanakusaGayu} from './scene'
export const meta:SceneModule['meta']={id:'nanakusa-gayu',title:'七草祈安',traditionSlug:'nanakusa-gayu',grade:'C',sensitivity:'低',gestures:['drag']}
export const create=createNanakusaGayu
