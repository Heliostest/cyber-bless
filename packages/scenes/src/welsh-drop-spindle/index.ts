import type {SceneModule} from '../contract'
import {createWelshDropSpindle} from './scene'
export const meta:SceneModule['meta']={id:'welsh-drop-spindle',title:'悬锤纺线',traditionSlug:'welsh-drop-spindle',grade:'C',sensitivity:'低',gestures:['drag']}
export const create=createWelshDropSpindle
