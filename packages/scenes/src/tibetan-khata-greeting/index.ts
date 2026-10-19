import type {SceneModule} from '../contract'
import {createTibetanKhataGreeting} from './scene'
export const meta:SceneModule['meta']={id:'tibetan-khata-greeting',title:'白绢迎客',traditionSlug:'tibetan-khata-greeting',grade:'C',sensitivity:'中',gestures:['drag']}
export const create=createTibetanKhataGreeting
