import type {SceneModule} from '../contract'
import {createFinnishVirpominen} from './scene'
export const meta:SceneModule['meta']={id:'finnish-virpominen',title:'柳枝祝春',traditionSlug:'finnish-virpominen',grade:'C',sensitivity:'中',gestures:['drag']}
export const create=createFinnishVirpominen
