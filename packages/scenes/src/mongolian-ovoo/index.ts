import type {SceneModule} from '../contract'
import {createMongolianOvoo} from './scene'
export const meta:SceneModule['meta']={id:'mongolian-ovoo',title:'敖包祈护',traditionSlug:'mongolian-ovoo',grade:'C',sensitivity:'中',gestures:['drag']}
export const create=createMongolianOvoo
