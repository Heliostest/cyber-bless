import type {SceneModule} from '../contract'
import {createHiiragiIwashi} from './scene'
export const meta:SceneModule['meta']={id:'hiiragi-iwashi',title:'柊鰯守门',traditionSlug:'hiiragi-iwashi',grade:'C',sensitivity:'中',gestures:['drag']}
export const create=createHiiragiIwashi
