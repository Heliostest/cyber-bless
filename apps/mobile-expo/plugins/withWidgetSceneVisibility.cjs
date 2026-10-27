const fs = require('node:fs');
const path = require('node:path');
const { withDangerousMod } = require('expo/config-plugins');
const { APP_HIDDEN_SCENE_IDS } = require('../../../packages/core/src/daily-scenes.ts');

function adaptWidgetSource(source) {
  if (source.includes('// Blessing SDK57 localization adapter v2')) return source;
  const anchor = '      WidgetsEntryView(entry: entry)';
  if (source.split(anchor).length !== 2 || !source.includes('WidgetsTimelineProvider(name: name)') ||
      !source.includes('.configurationDisplayName(') || !source.includes('.description(')) {
    throw Error('Unsupported Expo Widgets SDK57 template: localization adapter requires review.');
  }
  const copy = JSON.parse(fs.readFileSync(path.join(__dirname, '../widget-copy.generated.json'), 'utf8'));
  const base64 = Buffer.from(JSON.stringify(copy.native)).toString('base64');
  source = source.replace('import SwiftUI', 'import SwiftUI\nimport Foundation')
    .replace(anchor, '      BlessingLocalizedEntryView(entry: entry)')
    .replace(/\.configurationDisplayName\([^\n]+\)/, '.configurationDisplayName(Text(verbatim: BlessingWidgetCopy.text(BlessingWidgetCopy.resolve("system", Locale.preferredLanguages), "native.widget.name")))')
    .replace(/\.description\([^\n]+\)/, '.description(Text(verbatim: BlessingWidgetCopy.text(BlessingWidgetCopy.resolve("system", Locale.preferredLanguages), "native.widget.description")))');
  return source + `

// Blessing SDK57 localization adapter v2. Generated into the extension's Sources phase.
// App scene curation and localization run before an old persisted layout is evaluated.
private enum BlessingWidgetCopy {
  static let supported: Set<String> = ["zh-Hans", "zh-Hant", "en", "ja", "ko", "es", "pt", "fr"]
  static let copy: [String: [String: String]] = {
    guard let data = Data(base64Encoded: "${base64}"),
      let value = try? JSONSerialization.jsonObject(with: data) as? [String: [String: String]] else { return [:] }
    return value
  }()
  static func resolve(_ preference: String, _ tags: [String]) -> String {
    if supported.contains(preference) { return preference }
    for tag in tags {
      guard tag.range(of: "^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$", options: .regularExpression) != nil else { continue }
      let parts = tag.lowercased().split(separator: "-").map(String.init)
      guard let language = parts.first else { continue }
      if language == "zh" {
        let script = parts.first(where: { $0 == "hans" || $0 == "hant" })
        return script == "hant" || (script == nil && parts.contains(where: { ["tw", "hk", "mo"].contains($0) })) ? "zh-Hant" : "zh-Hans"
      }
      if supported.contains(language) { return language }
    }
    return "en"
  }
  static func text(_ locale: String, _ key: String) -> String { copy[locale]?[key] ?? copy["en"]?[key] ?? "" }
  static func formatTag(_ preference: String, _ tags: [String]) -> String {
    if supported.contains(preference) { return preference }
    return tags.first(where: { tag in
      guard tag.range(of: "^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$", options: .regularExpression) != nil,
        let language = tag.lowercased().split(separator: "-").first.map(String.init) else { return false }
      return language == "zh" || supported.contains(language)
    }) ?? "en"
  }
}

private struct BlessingLocalizedEntryView: View {
  @Environment(\\.self) private var environment
  @Environment(\\.locale) private var locale
  let entry: WidgetsTimelineProvider.Entry

  private func localizedProps() -> [String: Any] {
    let allowed: Set<String> = ["day", "sceneId", "deepLink", "collected", "localePreference", "copyRevision", "previewSmall", "previewMedium", "previewLarge"]
    var props = (entry.props ?? [:]).filter { allowed.contains($0.key) }
    let preference = props["localePreference"] as? String ?? "system"
    // SwiftUI locale invalidates this view; no RN execution is needed at redraw.
    let tags = Locale.preferredLanguages + [locale.identifier]
    let resolved = BlessingWidgetCopy.resolve(preference, tags)
    props["resolvedLocale"] = resolved
    if let day = props["day"] as? String, day.range(of: "^[0-9]{4}-[0-9]{2}-[0-9]{2}$", options: .regularExpression) != nil {
      let parser = DateFormatter()
      parser.locale = Locale(identifier: "en_US_POSIX")
      parser.dateFormat = "yyyy-MM-dd"
      parser.isLenient = false
      if let date = parser.date(from: day) {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: BlessingWidgetCopy.formatTag(preference, tags))
        formatter.setLocalizedDateFormatFromTemplate("yMMMd")
        props["localizedDay"] = formatter.string(from: date)
      }
    }
    return props
  }

  var body: some View {
    let props = localizedProps()
    let resolved = props["resolvedLocale"] as? String ?? "en"
    let hiddenScenes: Set<String> = [${APP_HIDDEN_SCENE_IDS.map(JSON.stringify).join(', ')}]
    let sceneId = props["sceneId"] as? String ?? ""
    let deepLink = props["deepLink"] as? String ?? ""
    let linkedId = URLComponents(string: deepLink)?.queryItems?.first(where: { $0.name == "scene" })?.value ?? ""
    if hiddenScenes.contains(sceneId) || hiddenScenes.contains(linkedId) {
      fallback(resolved)
    } else if let layout = WidgetsStorage.getString(forKey: "__expo_widgets_\\(entry.name)_layout"), !layout.isEmpty {
      let widgetEnvironment = getWidgetEnvironment(environment: environment)
      let node = evaluateLayout(layout: layout, props: props, environment: widgetEnvironment)
      WidgetsDynamicView(name: entry.name, kind: .widget, node: node, entryIndex: entry.entryIndex, environmentString: nil)
    } else {
      // First-install placeholder/gallery has no registered JavaScript layout.
      fallback(resolved)
    }
  }

  @ViewBuilder private func fallback(_ resolved: String) -> some View {
    if #available(iOS 17.0, *) {
      Text(verbatim: BlessingWidgetCopy.text(resolved, "native.widget.name"))
        .foregroundStyle(.white)
        .containerBackground(Color(red: 0.09, green: 0.24, blue: 0.20), for: .widget)
        .widgetURL(URL(string: "cyber-bless://widget/today?v=1"))
    } else {
      Text(verbatim: BlessingWidgetCopy.text(resolved, "native.widget.name"))
        .widgetURL(URL(string: "cyber-bless://widget/today?v=1"))
    }
  }
}
`;
}

// Register before expo-widgets: dangerous mods run in reverse registration order.
module.exports = function withWidgetSceneVisibility(config) {
  const version = require('expo-widgets/package.json').version;
  if (!version.startsWith('57.')) throw Error(`Unsupported Expo Widgets SDK57 template version: ${version}`);
  return withDangerousMod(config, ['ios', async config => {
    const directory = path.join(config.modRequest.platformProjectRoot, 'ExpoWidgetsTarget');
    const file = path.join(directory, 'BlessingToday.swift');
    fs.writeFileSync(file, adaptWidgetSource(fs.readFileSync(file, 'utf8')));
    const plist = require('@expo/plist').default;
    const infoPath = path.join(directory, 'Info.plist');
    const info = plist.parse(fs.readFileSync(infoPath, 'utf8'));
    info.CFBundleLocalizations = ['zh-Hans', 'zh-Hant', 'en', 'ja', 'ko', 'es', 'pt', 'fr'];
    fs.writeFileSync(infoPath, plist.build(info));
    return config;
  }]);
};
module.exports.adaptWidgetSource = adaptWidgetSource;
