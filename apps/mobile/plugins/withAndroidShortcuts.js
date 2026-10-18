// Android static app shortcuts (long-press the launcher icon). Pure configuration: no native module,
// so it works with Continuous Native Generation and every EAS build. Each shortcut opens a deep link
// (aisec://...) that Expo Router resolves to a screen.
const fs = require('fs');
const path = require('path');
const { AndroidConfig, withAndroidManifest, withDangerousMod, withStringsXml } = require('expo/config-plugins');

const SHORTCUTS = [
  { id: 'continue', label: 'Continue', long: 'Continue learning', url: 'aisec:///', glyph: 'M9,7v10l8,-5z' },
  { id: 'review', label: 'Review', long: 'Review flashcards', url: 'aisec:///review', glyph: 'M6,7h9v11H6z M9,5h9v11h-1V6H9z' },
  { id: 'challenge', label: 'Challenge', long: 'Daily challenge', url: 'aisec:///practice', glyph: 'M10,5v8h2v6l5,-9h-3l3,-5z' },
  { id: 'tutor', label: 'Ask tutor', long: 'Ask the tutor', url: 'aisec:///tutor', glyph: 'M17,6H7c-0.6,0 -1,0.4 -1,1v11l3,-3h8c0.6,0 1,-0.4 1,-1V7c0,-0.6 -0.4,-1 -1,-1z' },
];

const ACCENT = '#2DD4BF';
const INK = '#04111A';

function iconXml(glyph) {
  return `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="48dp" android:height="48dp" android:viewportWidth="24" android:viewportHeight="24">
  <path android:fillColor="${ACCENT}" android:pathData="M12,1a11,11 0 1,0 0.01,0z"/>
  <path android:fillColor="${INK}" android:pathData="${glyph}"/>
</vector>
`;
}

function shortcutsXml(pkg) {
  const items = SHORTCUTS.map(
    (s) => `  <shortcut android:shortcutId="${s.id}" android:enabled="true" android:icon="@drawable/shortcut_${s.id}"
    android:shortcutShortLabel="@string/shortcut_${s.id}_short" android:shortcutLongLabel="@string/shortcut_${s.id}_long">
    <intent android:action="android.intent.action.VIEW" android:targetPackage="${pkg}" android:targetClass="${pkg}.MainActivity" android:data="${s.url}" />
  </shortcut>`,
  );
  return `<?xml version="1.0" encoding="utf-8"?>
<shortcuts xmlns:android="http://schemas.android.com/apk/res/android">
${items.join('\n')}
</shortcuts>
`;
}

const withShortcutFiles = (config) =>
  withDangerousMod(config, [
    'android',
    async (cfg) => {
      const res = path.join(cfg.modRequest.platformProjectRoot, 'app', 'src', 'main', 'res');
      fs.mkdirSync(path.join(res, 'xml'), { recursive: true });
      fs.mkdirSync(path.join(res, 'drawable'), { recursive: true });
      fs.writeFileSync(path.join(res, 'xml', 'shortcuts.xml'), shortcutsXml(cfg.android.package));
      for (const s of SHORTCUTS) fs.writeFileSync(path.join(res, 'drawable', `shortcut_${s.id}.xml`), iconXml(s.glyph));
      return cfg;
    },
  ]);

const withShortcutStrings = (config) =>
  withStringsXml(config, (cfg) => {
    for (const s of SHORTCUTS) {
      cfg.modResults = AndroidConfig.Strings.setStringItem(
        [
          { $: { name: `shortcut_${s.id}_short`, translatable: 'false' }, _: s.label },
          { $: { name: `shortcut_${s.id}_long`, translatable: 'false' }, _: s.long },
        ],
        cfg.modResults,
      );
    }
    return cfg;
  });

const withShortcutMeta = (config) =>
  withAndroidManifest(config, (cfg) => {
    const activity = AndroidConfig.Manifest.getMainActivityOrThrow(cfg.modResults);
    activity['meta-data'] = (activity['meta-data'] ?? []).filter((m) => m.$['android:name'] !== 'android.app.shortcuts');
    activity['meta-data'].push({ $: { 'android:name': 'android.app.shortcuts', 'android:resource': '@xml/shortcuts' } });
    return cfg;
  });

module.exports = (config) => withShortcutMeta(withShortcutStrings(withShortcutFiles(config)));
module.exports.SHORTCUTS = SHORTCUTS;
