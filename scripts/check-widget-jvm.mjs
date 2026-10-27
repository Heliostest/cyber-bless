import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const harness = path.join(root, 'artifacts/i18n-widget-jvm');
const source = readFileSync(path.join(root, 'apps/mobile-expo/modules/blessing-widgets/android/src/main/java/com/helio/blessingwidgets/WidgetCatalog.kt'), 'utf8');
const names = [...new Set([...source.matchAll(/R\.drawable\.([a-z0-9_]+)/g)].map(m => m[1]))];
const output = path.join(harness, 'src/main/kotlin/com/helio/blessingwidgets');
mkdirSync(output, { recursive: true });
writeFileSync(path.join(output, 'R.kt'), 'package com.helio.blessingwidgets\ninternal object R { object drawable {\n' + names.map((n,i) => `const val ${n} = ${i+1}`).join('\n') + '\n} }\n');
writeFileSync(path.join(harness, 'settings.gradle'), "pluginManagement { repositories { mavenCentral(); gradlePluginPortal() } }\nrootProject.name = 'i18n-widget-parser-check'\n");
writeFileSync(path.join(harness, 'build.gradle'), `plugins { id 'org.jetbrains.kotlin.jvm' version '2.1.20' }
repositories { mavenCentral() }
kotlin { jvmToolchain(21) }
sourceSets {
  main.kotlin.srcDir '../../apps/mobile-expo/modules/blessing-widgets/android/src/main/java'
  main.kotlin.include '**/WidgetSnapshot.kt', '**/WidgetCatalog.kt', '**/WidgetCoverSize.kt', '**/WidgetLocalization.kt', '**/R.kt'
  test.kotlin.srcDir '../../apps/mobile-expo/modules/blessing-widgets/android/src/test/java'
  test.kotlin.include '**/WidgetSnapshotTest.kt'
  test.resources.srcDir '../../apps/mobile-expo/modules/blessing-widgets/android/src/test/resources'
}
dependencies { implementation 'org.json:json:20250517'; testImplementation 'junit:junit:4.13.2' }
test { testLogging { events 'passed', 'failed', 'skipped' } }
`);
const cache = process.env.WBR_GRADLE_CACHE || path.join(root, 'artifacts/widget-work/gradle-clean');
const gradle = path.join(cache, 'wrapper/dists/gradle-9.3.1-bin/23ovyewtku6u96viwx3xl3oks/gradle-9.3.1');
const java = process.env.WBR_JAVA || 'C:/Program Files/Microsoft/jdk-21.0.9.10-hotspot/bin/java.exe';
if (!existsSync(java) || !existsSync(gradle)) throw Error('JVM verification runtime unavailable; set WBR_JAVA and WBR_GRADLE_CACHE to the cached Gradle 9.3.1 distribution.');
const env = { ...process.env, GRADLE_USER_HOME: cache };
const pathKey = Object.keys(env).find(k => k.toLowerCase() === 'path');
if (pathKey) env[pathKey] = env[pathKey].replaceAll('"', '');
const result = spawnSync(java, [`-javaagent:${path.join(gradle, 'lib/agents/gradle-instrumentation-agent-9.3.1.jar')}`,
  '-jar', path.join(gradle, 'lib/gradle-gradle-cli-main-9.3.1.jar'), '-p', harness,
  'test', '--offline', '--no-daemon', '--console=plain', '--max-workers=2',
], { env, stdio: 'inherit' });
process.exit(result.status ?? 1);
