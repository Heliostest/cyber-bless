import type {SceneModule} from '../contract'
import {createSetsubunMamemaki} from './scene'
export const meta:SceneModule['meta']={id:'setsubun-mamemaki',title:'节分撒豆',traditionSlug:'setsubun-mamemaki',grade:'C',sensitivity:'低',gestures:['drag']}
export const create=createSetsubunMamemaki
