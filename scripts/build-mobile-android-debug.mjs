import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, readdir, realpath, stat, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepareAppAssets } from './prepare-app-assets.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const cache = path.join(root, 'artifacts/widget-work/gradle-clean');
const env = { ...process.env, GRADLE_USER_HOME: cache, NODE_ENV: 'development', CI: '1', EXPO_NO_TELEMETRY: '1' };
if (process.platform === 'win32') {
  // A stray quote in a host PATH entry breaks AGP's test JVM java.library.path argument.
  // Normalize only the spawned build environment; retain every entry and the user's PATH.
  const pathKey = Object.keys(env).find(key => key.toLowerCase() === 'path');
  if (pathKey) env[pathKey] = env[pathKey].replaceAll('"', '');
}
const java = process.env.JAVA_HOME ? path.join(process.env.JAVA_HOME, 'bin', process.platform === 'win32' ? 'java.exe' : 'java') : 'java';
function run(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env, stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', code => code === 0 ? resolve() : reject(Error(`${path.basename(command)} failed: ${code}`)));
  });
}

await mkdir(cache, { recursive: true });
if (!process.argv.includes('--prepared')) {
  await prepareAppAssets();
  await run(process.execPath, [path.join(root, 'scripts/prepare-widget-native-check.mjs')], root);
}
const snapshot = JSON.parse(await readFile(path.join(root, 'artifacts/widget-native-latest.json'), 'utf8'));
const app = path.resolve(snapshot.app);
if (!path.relative(path.join(root, 'artifacts'), app).startsWith('widget-native-') || !app.endsWith(path.join('apps', 'mobile-expo')))
  throw Error('Expected an isolated widget-native app under this workspace');
const appPackageFile = path.join(app, 'package.json');
const appPackage = JSON.parse(await readFile(appPackageFile, 'utf8'));
const launcherPackages = ['expo-dev-client', 'expo-dev-launcher', 'expo-dev-menu'];
const widgetQa = process.argv.includes('--widget-qa');
appPackage.expo ??= {};
appPackage.expo.autolinking ??= {};
appPackage.expo.autolinking.android ??= {};
const linking = appPackage.expo.autolinking.android;
linking.exclude = [...(linking.exclude ?? []).filter(name => !launcherPackages.includes(name)),
  ...(widgetQa ? launcherPackages : [])];
// A normal React Native debug host preserves cold widget ACTION_VIEW intents. Expo's
// development launcher intercepts them before it loads the app. This affects only the copy.
await writeFile(appPackageFile, JSON.stringify(appPackage, null, 2) + '\n');
if (!process.argv.includes('--prepared')) {
  await cp(path.join(root, 'apps/mobile-expo/public'), path.join(app, 'public'), { recursive: true });
  await run(process.execPath, [path.join(root, 'node_modules/expo/bin/cli'), 'prebuild', '--no-install', '--platform', 'android'], app);
}
const android = path.join(app, 'android');
const localArgs = [];
if (process.platform === 'win32') {
  // CNG's deep app directory leaves too little room for Ninja's generated object paths.
  // Override only this isolated application's C++ staging directory, using the AGP DSL.
  env.WBR_ANDROID_CXX = path.join(root, 'artifacts', `cxx-${path.basename(snapshot.directory).replace('widget-native-', '')}`);
  const ninjaHome = path.join(root, 'artifacts/widget-work/ninja-1.12.1');
  env.WBR_ANDROID_NINJA = process.env.WBR_ANDROID_NINJA ?? path.join(ninjaHome, 'ninja.exe');
  if (!await stat(env.WBR_ANDROID_NINJA).then(() => true, () => false)) {
    if (process.env.WBR_ANDROID_NINJA) throw Error('WBR_ANDROID_NINJA does not exist');
    await mkdir(ninjaHome, { recursive: true });
    env.WBR_NINJA_ARCHIVE = path.join(ninjaHome, 'ninja-win.zip');
    env.WBR_NINJA_HOME = ninjaHome;
    const release = 'https://github.com/ninja-build/ninja/releases/download/v1.12.1/ninja-win.zip';
    const response = await fetch(release);
    if (!response.ok) throw Error(`Ninja download failed: ${response.status}`);
    await writeFile(env.WBR_NINJA_ARCHIVE, Buffer.from(await response.arrayBuffer()));
    await run('powershell.exe', ['-NoProfile', '-Command',
      'Expand-Archive -LiteralPath $env:WBR_NINJA_ARCHIVE -DestinationPath $env:WBR_NINJA_HOME -Force'], root);
    await stat(env.WBR_ANDROID_NINJA);
  }
  const init = path.join(cache, 'android-local.init.gradle');
  await writeFile(init, `gradle.beforeProject { project ->
  ['com.android.application', 'com.android.library'].each { androidPlugin ->
    project.plugins.withId(androidPlugin) {
      def android = project.extensions.getByName('android')
      android.defaultConfig.externalNativeBuild.cmake.arguments(
        '-DCMAKE_MAKE_PROGRAM=' + System.getenv('WBR_ANDROID_NINJA').replace('\\\\', '/'))
      if (project.path == ':app') {
        android.externalNativeBuild.cmake.buildStagingDirectory = new File(System.getenv('WBR_ANDROID_CXX'))
      }
    }
  }
}
`);
  localArgs.push('--init-script', init);
}
const wrapper = await readFile(path.join(android, 'gradle/wrapper/gradle-wrapper.properties'), 'utf8');
const version = wrapper.match(/gradle-([\d.]+)-bin\.zip/)?.[1];
if (!version) throw Error('Cannot read the generated Gradle wrapper version');
async function cachedDistribution(home) {
  const base = path.join(home, 'wrapper/dists', `gradle-${version}-bin`);
  for (const entry of await readdir(base).catch(() => [])) {
    const candidate = path.join(base, entry, `gradle-${version}`);
    if (await stat(path.join(candidate, 'lib', `gradle-gradle-cli-main-${version}.jar`)).then(() => true, () => false))
      return realpath(candidate);
  }
}
let distribution = process.env.WBR_GRADLE_HOME ? await realpath(process.env.WBR_GRADLE_HOME)
  : await cachedDistribution(cache) ?? await cachedDistribution(path.join(homedir(), '.gradle'));
if (!distribution) {
  await run(java, ['-classpath', path.join(android, 'gradle/wrapper/gradle-wrapper.jar'), 'org.gradle.wrapper.GradleWrapperMain', '--version'], android);
  distribution = await cachedDistribution(cache);
}
if (!distribution) throw Error('Cannot find the generated wrapper Gradle distribution');
// Launch the canonical installation directly: Windows junction paths break Kotlin DSL stage compilation.
// Keep all caches/init scripts in our task home; never load or edit the user's global init.gradle.
const launcher = path.join(distribution, 'lib', `gradle-gradle-cli-main-${version}.jar`);
await stat(launcher);
console.log(`Gradle ${version}: ${distribution}\nTask cache: ${cache}\nAndroid project: ${android}`);
await run(java, ['-Xmx64m', '-Xms64m', `-javaagent:${path.join(distribution, 'lib/agents', `gradle-instrumentation-agent-${version}.jar`)}`,
  '-Dorg.gradle.appname=gradle', '-jar', launcher, '-p', android, ':app:assembleDebug',
  ...(process.argv.includes('--test') ? [':blessing-widgets:testDebugUnitTest'] : []),
  ...localArgs,
  '-PreactNativeArchitectures=arm64-v8a,x86_64', '-PreactNativeDevServerPort=8083', '--no-daemon', '--console=plain', '--max-workers=2'], android);
const input = path.join(android, 'app/build/outputs/apk/debug/app-debug.apk');
const bytes = await readFile(input);
const output = path.join(root, 'artifacts/android-debug');
await mkdir(output, { recursive: true });
const apk = path.join(output, 'cyber-bless-debug.apk');
await writeFile(apk, bytes);
await writeFile(path.join(output, 'latest.json'), JSON.stringify({ at: new Date().toISOString(), apk, source: app, gradle: version,
  gradleDistribution: distribution, cppStaging: env.WBR_ANDROID_CXX, ninja: env.WBR_ANDROID_NINJA,
  bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'),
  architectures: ['arm64-v8a', 'x86_64'], metroPort: 8083, variant: 'debug', widgetQa,
  developmentLauncher: !widgetQa }, null, 2) + '\n');
console.log(`Debug APK: ${apk}`);
