import type {SceneModule} from '../contract'
import {createTurkishNazarBead} from './scene'
export const meta:SceneModule['meta']={id:'turkish-nazar-bead',title:'蓝珠祈安',traditionSlug:'turkish-nazar-bead',grade:'C',sensitivity:'低',gestures:['drag']}
export const create=createTurkishNazarBead
