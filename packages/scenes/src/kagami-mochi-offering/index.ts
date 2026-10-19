import type {SceneModule} from '../contract'
import {createKagamiMochiOffering} from './scene'
export const meta:SceneModule['meta']={id:'kagami-mochi-offering',title:'镜饼迎岁',traditionSlug:'kagami-mochi-offering',grade:'C',sensitivity:'低',gestures:['drag']}
export const create=createKagamiMochiOffering
