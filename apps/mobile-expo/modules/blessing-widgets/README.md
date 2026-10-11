# Android 今日仪式 widget

Local Expo module, autolinked from `apps/mobile-expo/modules`. The library manifest owns the provider registration and merges its resources; `plugins/withBlessingWidgets.cjs` validates the existing app scheme/identity and sets an Android minimum of at least 24. Repeated CNG application does not copy or duplicate native receivers.

The native `BlessingWidgets` API exposes `publishSnapshot(snapshotJson): Promise<void>` and `refresh(): Promise<void>`. The app publishes its independent seven-day public projection after confirmed reads/writes. Kotlin validates schema/source versions, the bundled catalog revision, SHA-256 shape, exact public metadata, contiguous local dates, and canonical links. An intentional empty `days` projection clears previously confirmed status. Invalid publications reject without replacing the previous complete cache.

`AtomicFile` stores only the validated widget projection beneath `noBackupFilesDir/blessing-widgets/today-v1.json`. The widget and its workers never open AsyncStorage or a personal save. They select the device's exact current local day and use a generic invitation when the file is absent, invalid, or expired. Future entries cannot be confirmed. The native Activity Intent is explicit and builds its own allowlisted URL. The gallery preview reads no stored data.

Glance renders compact (140 × 140 dp) or wide (300 × 140 dp) scene-cover cards. Bundled PNGs capture the app's actual Three.js scenes at 600 × 600 and 1280 × 600 pixels and fill the card with `ContentScale.Crop`; they are static offline images. A native bottom scrim supports the scene title at bottom-left and a rounded “进入仪式 ↗” button at bottom-right. The button and whole card both launch the same explicit, validated Activity Intent. No personal collection status is displayed. The gallery uses the generic cover and public invitation only. The actual launcher grid varies; resize the default compact widget horizontally for the wide card. Rounded clipping uses the Glance corner modifier on Android 12+, with older launcher clipping subject to device verification. A refresh StateFlow keeps an existing Glance composition current when several saves arrive during its active session.

Only installed instances retain unique 6-hour periodic work and a Calendar-derived next-local-midnight job. Time, timezone, boot and package replacement events reschedule work; the last deletion cancels these jobs. WorkManager and launcher refreshes are approximate and can be delayed by Doze, force-stop or vendor battery policies.

Local checks:

```powershell
node --test scripts/blessing-widgets-plugin.test.mjs scripts/blessing-widgets-native.test.mjs
# From a generated Android project:
.\gradlew.bat :blessing-widgets:compileDebugKotlin :blessing-widgets:testDebugUnitTest
```

JVM tests cover exact day selection, expiry, all 11 metadata entries, schema/link/privacy rejection, empty invalidation, offset timezone fallback and 23/25-hour DST boundaries. Launcher rendering, resizing, TalkBack/font scaling, killed-app cold/warm navigation, and actual background delivery still need an installed development build and device. The widget is unavailable in Expo Go.
