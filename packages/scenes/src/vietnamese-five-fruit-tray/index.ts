import type {SceneModule} from '../contract'
import {createVietnameseFiveFruitTray} from './scene'
export const meta:SceneModule['meta']={id:'vietnamese-five-fruit-tray',title:'五果迎春',traditionSlug:'vietnamese-five-fruit-tray',grade:'C',sensitivity:'低',gestures:['drag']}
export const create=createVietnameseFiveFruitTray
