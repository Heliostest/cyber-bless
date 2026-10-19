import type {SceneModule} from '../contract'
import {createScottishPlungeChurn} from './scene'
export const meta:SceneModule['meta']={id:'scottish-plunge-churn',title:'木杆搅乳',traditionSlug:'scottish-plunge-churn',grade:'C',sensitivity:'低',gestures:['drag']}
export const create=createScottishPlungeChurn
