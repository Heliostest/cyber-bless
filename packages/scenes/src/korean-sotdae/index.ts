import type {SceneModule} from '../contract'
import {createKoreanSotdae} from './scene'
export const meta:SceneModule['meta']={id:'korean-sotdae',title:'鸟竿祈安',traditionSlug:'korean-sotdae',grade:'C',sensitivity:'中',gestures:['drag']}
export const create=createKoreanSotdae
