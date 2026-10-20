import type {SceneModule} from '../contract'
import {createOplatek} from './scene'
export const meta:SceneModule['meta']={id:'polish-oplatek-sharing',title:'薄饼相祝',traditionSlug:'polish-oplatek-sharing',grade:'C',sensitivity:'低',gestures:['drag']}
export const create=createOplatek
