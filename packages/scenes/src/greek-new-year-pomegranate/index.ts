import type {SceneModule} from '../contract'
import {createGreekNewYearPomegranate} from './scene'
export const meta:SceneModule['meta']={id:'greek-new-year-pomegranate',title:'破榴迎新',traditionSlug:'greek-new-year-pomegranate',grade:'C',sensitivity:'低',gestures:['drag']}
export const create=createGreekNewYearPomegranate
