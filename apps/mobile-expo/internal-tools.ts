import { INTERNAL_TOOLS_ENABLED } from '@wbr/app/internal-tools-config';

/** Internal testing ends by rebuilding with the shared switch disabled. */
export async function detectInternalToolsEnabled(): Promise<boolean> {
  return INTERNAL_TOOLS_ENABLED;
}
