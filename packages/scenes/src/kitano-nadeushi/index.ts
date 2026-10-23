import type {SceneModule} from '../contract'
import {createKitanoNadeushi} from './scene'
export const meta:SceneModule['meta']={id:'kitano-nadeushi',title:'抚牛寄愿',traditionSlug:'kitano-nadeushi',grade:'C',sensitivity:'中',gestures:['drag']}
export const create=createKitanoNadeushi
