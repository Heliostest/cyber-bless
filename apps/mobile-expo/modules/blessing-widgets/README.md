# Android 今日仪式 widget

Local Expo module, autolinked from `apps/mobile-expo/modules`. The library manifest owns the provider registration and merges its resources; `plugins/withBlessingWidgets.cjs` validates the existing app scheme/identity and sets an Android minimum of at least 24. Repeated CNG application does not copy or duplicate native receivers.

The native `BlessingWidgets` API exposes `publishSnapshot(snapshotJson): Promise<void>` and `refresh(): Promise<void>`. The app publishes its independent seven-day public projection after confirmed reads/writes. Kotlin validates schema/source versions, the bundled catalog revision, SHA-256 shape, exact public metadata, contiguous local dates, and canonical links. An intentional empty `days` projection clears previously confirmed status. Invalid publications reject without replacing the previous complete cache.

`AtomicFile` stores only the validated widget projection beneath `noBackupFilesDir/blessing-widgets/today-v1.json`. The widget and its workers never open AsyncStorage or a personal save. They select the device's exact current local day and use a generic invitation when the file is absent, invalid, or expired. Future entries cannot be confirmed. The native Activity Intent is explicit and builds its own allowlisted URL. The gallery preview reads no stored data.

Glance renders compact (140 × 140 dp), wide (300 × 140 dp), and large square (300 × 300 dp) scene-cover cards, corresponding approximately to 2×2, 4×2, and 4×4. Resize the existing provider horizontally and vertically; grid cells and available area depend on the launcher. Bundled PNGs capture the app's actual Three.js scenes at 600 × 600, 1280 × 600, and 1200 × 1200 pixels and fill the card with `ContentScale.Crop`; they are static offline images. The large card uses its own square capture rather than cropping the wide image. A native bottom scrim supports the scene title at bottom-left. The whole card is the only tap target and launches an explicit, validated Activity Intent; there is no separate launch button, including in the picker placeholder. No personal collection status is displayed. The gallery uses the generic cover and public invitation only. Rounded clipping uses the Glance corner modifier on Android 12+, with older launcher clipping subject to device verification. A refresh StateFlow keeps an existing Glance composition current when several saves arrive during its active session.

`npm run mobile:widgets:render` generates `WidgetCatalog.kt` alongside the PNGs from the shared bundled catalog. This keeps public snapshot validation and all three cover-resource variants aligned with new scenes. It also generates the iOS asset import table; regenerate after changing the catalog or scene appearance.

Only installed instances retain unique 6-hour periodic work and a Calendar-derived next-local-midnight job. Time, timezone, boot and package replacement events reschedule work; the last deletion cancels these jobs. WorkManager and launcher refreshes are approximate and can be delayed by Doze, force-stop or vendor battery policies.

Local checks:

```powershell
node --test scripts/blessing-widgets-plugin.test.mjs scripts/blessing-widgets-native.test.mjs
# From a generated Android project:
.\gradlew.bat :blessing-widgets:compileDebugKotlin :blessing-widgets:testDebugUnitTest
```

JVM tests cover exact day selection, expiry, public metadata, schema/link/privacy rejection, empty invalidation, offset timezone fallback, 23/25-hour DST boundaries, three-size selection, and distinct scene/size cover resources. Launcher rendering, resizing, TalkBack/font scaling, killed-app cold/warm navigation, and actual background delivery need an installed native build and device. The widget is unavailable in Expo Go.
