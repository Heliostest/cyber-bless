import type {ConfigContext,ExpoConfig} from 'expo/config';
import {INTERNAL_TOOLS_ENABLED} from '../../packages/app/src/internal-tools-config.ts';
import {withInternalUpdates} from '../../scripts/internal-update-config.mjs';

export default ({config}:ConfigContext):ExpoConfig=>withInternalUpdates(config,{
  internalToolsEnabled:INTERNAL_TOOLS_ENABLED,
  requested:process.env.EXPO_INTERNAL_UPDATES,
});
