import type {ExpoConfig} from 'expo/config';
export declare const INTERNAL_UPDATE_ORIGIN:string;
export declare function withInternalUpdates(config:Partial<ExpoConfig>,options?:{internalToolsEnabled?:boolean;requested?:string}):ExpoConfig;
