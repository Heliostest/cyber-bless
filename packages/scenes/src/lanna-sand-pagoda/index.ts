import type {SceneModule} from '../contract'
import {createLannaSandPagoda} from './scene'
export const meta:SceneModule['meta']={id:'lanna-sand-pagoda',title:'沙塔献幡',traditionSlug:'lanna-sand-pagoda',grade:'C',sensitivity:'中',gestures:['drag']}
export const create=createLannaSandPagoda
