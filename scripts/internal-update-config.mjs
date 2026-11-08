export const INTERNAL_UPDATE_ORIGIN='https://feedback.heliosoft.win';
/** Build-time distribution decision; saved preferences cannot enable updates. */
export function withInternalUpdates(config,{internalToolsEnabled,requested}={}) {
  const enabled=internalToolsEnabled===true&&requested==='1';
  return {...config,
    ...(enabled?{runtimeVersion:{policy:'fingerprint'}}:{}),
    updates:enabled?{enabled:true,url:`${INTERNAL_UPDATE_ORIGIN}/api/internal-updates/check`,checkAutomatically:'NEVER',fallbackToCacheTimeout:0,
      codeSigningCertificate:'./certs/internal-updates.pem',codeSigningMetadata:{keyid:'main',alg:'rsa-v1_5-sha256'},requestHeaders:{'expo-channel-name':'internal','X-Feedback-Token':''}}:{enabled:false},
    extra:{...config.extra,internalUpdates:{enabled,channel:'internal',schemaVersion:1,bridgeVersion:1}},
  };
}
