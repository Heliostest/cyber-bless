const { withGradleProperties } = require('expo/config-plugins');

/** The provider and resources merge from the local Expo module, once per CNG build. */
module.exports = function withBlessingWidgets(config) {
  const schemes = Array.isArray(config.scheme) ? config.scheme : [config.scheme];
  if (!schemes.includes('cyber-bless')) {
    throw new Error('BlessingWidgets requires the existing cyber-bless scheme.');
  }
  if (!config.android?.package) {
    throw new Error('BlessingWidgets requires android.package; it does not create an application identity.');
  }
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
