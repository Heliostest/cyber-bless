import type {SceneModule} from '../contract'
import {createLamTsuenWishingTree} from './scene'
export const meta:SceneModule['meta']={id:'lam-tsuen-wishing-tree',title:'林村抛愿',traditionSlug:'lam-tsuen-wishing-tree',grade:'C',sensitivity:'低',gestures:['drag']}
export const create=createLamTsuenWishingTree
