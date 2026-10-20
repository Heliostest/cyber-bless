import type {SceneModule} from '../contract'
import {createSongkran} from './scene'
export const meta:SceneModule['meta']={id:'thai-songkran-elders',title:'浇水敬老',traditionSlug:'thai-songkran-elders',grade:'C',sensitivity:'低',gestures:['drag']}
export const create=createSongkran
