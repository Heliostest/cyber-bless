const fs = require('node:fs');
const path = require('node:path');
const { withDangerousMod } = require('expo/config-plugins');
const { APP_HIDDEN_SCENE_IDS } = require('../../../packages/core/src/daily-scenes.ts');

// Register before expo-widgets: dangerous mods run in reverse registration order.
module.exports = function withWidgetSceneVisibility(config) {
  return withDangerousMod(config, ['ios', async config => {
    const file = path.join(config.modRequest.platformProjectRoot, 'ExpoWidgetsTarget', 'BlessingToday.swift');
    let source = fs.readFileSync(file, 'utf8');
    if (source.includes('// App scene curation')) return config;
    const anchor = '      WidgetsEntryView(entry: entry)';
    if (source.split(anchor).length !== 2) throw Error('Unexpected expo-widgets entry view; update the scene visibility hook.');
    const hidden = APP_HIDDEN_SCENE_IDS.map(id => JSON.stringify(id)).join(', ');
    source = source.replace('import SwiftUI', 'import SwiftUI\nimport Foundation').replace(anchor, `      // App scene curation also applies before the main App refreshes an old layout.
      let hiddenScenes: Set<String> = [${hidden}]
      let sceneId = entry.props?["sceneId"] as? String ?? ""
      let deepLink = entry.props?["deepLink"] as? String ?? ""
      let linkedId = URLComponents(string: deepLink)?.queryItems?.first(where: { $0.name == "scene" })?.value ?? ""
      if hiddenScenes.contains(sceneId) || hiddenScenes.contains(linkedId) {
        if #available(iOS 17.0, *) {
          Text("今日仪式")
            .foregroundStyle(.white)
            .containerBackground(Color(red: 0.09, green: 0.24, blue: 0.20), for: .widget)
            .widgetURL(URL(string: "cyber-bless://widget/today?v=1"))
        } else {
          Text("今日仪式").widgetURL(URL(string: "cyber-bless://widget/today?v=1"))
        }
      } else {
        WidgetsEntryView(entry: entry)
      }`);
    fs.writeFileSync(file, source);
    return config;
  }]);
};
