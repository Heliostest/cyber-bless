import type {SceneModule} from '../contract'
import {createZeniaraiCoinWashing} from './scene'
export const meta:SceneModule['meta']={id:'zeniarai-coin-washing',title:'泉水净币',traditionSlug:'zeniarai-coin-washing',grade:'C',sensitivity:'低',gestures:['drag']}
export const create=createZeniaraiCoinWashing
