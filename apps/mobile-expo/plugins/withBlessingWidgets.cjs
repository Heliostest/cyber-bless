const { withEntitlementsPlist, withGradleProperties, withMainActivity } = require('expo/config-plugins');
const { mergeContents } = require('@expo/config-plugins/build/utils/generateCode');

/** Register before expo-widgets so the entitlement mod runs after its APNs mod. */
module.exports = function withBlessingWidgets(config) {
  const schemes = Array.isArray(config.scheme) ? config.scheme : [config.scheme];
  if (!schemes.includes('cyber-bless')) {
    throw new Error('BlessingWidgets requires the existing cyber-bless scheme.');
  }
  if (!config.android?.package) {
    throw new Error('BlessingWidgets requires android.package; it does not create an application identity.');
  }
  const widgetOptions = config.plugins?.find((plugin) => Array.isArray(plugin) && plugin[0] === 'expo-widgets')?.[1];
  config = withEntitlementsPlist(config, (mod) => {
    // Expo Widgets 57 adds APNs even when its push feature is disabled.
    // Local timelines only require the existing shared App Group.
    if (widgetOptions?.enablePushNotifications !== true) delete mod.modResults['aps-environment'];
    return mod;
  });
  config = withMainActivity(config, (mod) => {
    if (mod.modResults.language !== 'kt') {
      throw new Error('BlessingWidgets requires the Expo Kotlin MainActivity template.');
    }
    mod.modResults.contents = mergeContents({
      tag: 'blessing-widget-link-intent',
      src: mod.modResults.contents,
      newSrc: `  override fun onNewIntent(intent: android.content.Intent) {
    // Linking reads this intent when a widget restores a task after process death.
    setIntent(intent)
    super.onNewIntent(intent)
  }`,
      anchor: /class MainActivity[^\n]*\{/,
      offset: 1,
      comment: '//',
    }).contents;
    return mod;
  });
  return withGradleProperties(config, (mod) => {
    const property = mod.modResults.find((item) => item.type === 'property' && item.key === 'android.minSdkVersion');
    if (property) {
      const minimum = Number(property.value);
      if (!Number.isInteger(minimum) || minimum < 24) property.value = '24';
    } else {
      mod.modResults.push({ type: 'property', key: 'android.minSdkVersion', value: '24' });
    }
    return mod;
  });
};
