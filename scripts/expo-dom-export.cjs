// Expo 57.0.31 / @expo/cli 57.0.32 renames DOM export artifacts to MD5
// filenames after @expo/metro-config 57.0.13 has emitted chunk requires and
// async paths. Those references retain the old __common/scene filenames and
// serializeHtml fails with "Asset not found". Export one complete DOM JS file
// until upstream reconciles both dependency metadata and runtime chunk URLs.
// Scope this workaround to production DOM MD5 exports, retaining ordinary web
// chunking and Metro development behavior. No installed dependency is patched.
function withDomExportCompatibility(serializer) {
  if (typeof serializer !== 'function') throw new TypeError('Expo Metro serializer is unavailable');
  const compatibleSerializer = (entry, preModules, graph, options) => {
    const transform = graph.transformOptions;
    const custom = transform?.customTransformOptions;
    const md5 = custom?.useMd5Filename;
    if (transform?.platform === 'web' && transform.dev === false && custom?.dom &&
        (md5 === true || md5 === 'true' || md5 === '1') &&
        options.serializerOptions?.output === 'static' && options.serializerOptions.exporting) {
      options = { ...options, serializerOptions: { ...options.serializerOptions, splitChunks: false } };
    }
    return serializer(entry, preModules, graph, options);
  };
  // Expo uses serializer properties to find the original custom serializer.
  return Object.assign(compatibleSerializer, serializer);
}

module.exports = { withDomExportCompatibility };
