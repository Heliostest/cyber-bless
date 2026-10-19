import type {SceneModule} from '../contract'
import {createKameidoUsokae} from './scene'
export const meta:SceneModule['meta']={id:'kameido-usokae',title:'木鷽迎福',traditionSlug:'kameido-usokae',grade:'C',sensitivity:'中',gestures:['drag']}
export const create=createKameidoUsokae
