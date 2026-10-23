import type {SceneModule} from '../contract'
import {createWishingMallet} from './scene'
export const meta:SceneModule['meta']={id:'uchide-wishing-mallet',title:'振槌寄愿',traditionSlug:'uchide-wishing-mallet',grade:'C',sensitivity:'中',gestures:['drag']}
export const create=createWishingMallet
