import type {SceneModule} from '../contract'
import {createMochigaseNagashibina} from './scene'
export const meta:SceneModule['meta']={id:'mochigase-nagashibina',title:'纸雏祈安',traditionSlug:'mochigase-nagashibina',grade:'C',sensitivity:'中',gestures:['drag']}
export const create=createMochigaseNagashibina
