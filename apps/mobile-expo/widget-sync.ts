import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import { createSHA256 } from '@wbr/content';
import { createWidgetSnapshot, widgetTimeline, type WidgetSnapshotV2 } from '@wbr/core/widgets';
import { getLocales } from 'expo-localization';
import { resolveLocale } from '@wbr/i18n/locales';

let iosWidget: import('expo-widgets').Widget<import('@wbr/core/widgets').TodayWidgetProps> | undefined;
let lastPublished = '';
async function publish(snapshot: WidgetSnapshotV2) {
  if (Platform.OS === 'ios') {
    // Expo Go must keep opening the existing DOM app without loading unavailable views.
    const native = requireOptionalNativeModule('ExpoWidgets');
    if (!native?.Widget) return;
    const { createWidget, widgetsDirectory } = require('expo-widgets') as typeof import('expo-widgets');
    const { TodayWidget } = require('./widgets/TodayWidget') as typeof import('./widgets/TodayWidget');
    iosWidget ??= createWidget('BlessingToday', TodayWidget);
    if (!widgetsDirectory) throw Error('Widget App Group unavailable');
    const { prepareWidgetImages } = require('./widget-images') as typeof import('./widget-images');
    const images = await prepareWidgetImages(widgetsDirectory);
    iosWidget.updateTimeline(widgetTimeline(snapshot, new Date()).map(entry => {
      const cover = images[entry.props.sceneId ?? 'generic'] ?? images.generic;
      return { ...entry, props: { ...entry.props, previewSmall: cover.small, previewMedium: cover.medium, previewLarge: cover.large } };
    }));
  } else if (Platform.OS === 'android') {
    const native = requireOptionalNativeModule<{ publishSnapshot(raw: string): Promise<void> }>('BlessingWidgets');
    if (native) await native.publishSnapshot(JSON.stringify(snapshot));
  }
}
/** Confirmed raw, an empty save (null), or an unavailable-source fallback (undefined). */
export async function synchronizeWidgets(raw: string | null | undefined): Promise<void> {
  const sourceHash = Array.from(createSHA256().update(raw ?? '').digest(), byte => byte.toString(16).padStart(2, '0')).join('');
  const snapshot = createWidgetSnapshot(raw, new Date(), sourceHash);
  // Private edits and scene checkpoints do not spend widget refresh budget.
  const resolved = resolveLocale(snapshot.localePreference, getLocales().map(locale => locale.languageTag));
  const signature = JSON.stringify([snapshot.catalogRevision, snapshot.timeZone, snapshot.validThroughDay,
    snapshot.localePreference, resolved.locale, resolved.formatLocale, snapshot.copyRevision, snapshot.days]);
  if (signature === lastPublished) return;
  await publish(snapshot);
  lastPublished = signature;
}
