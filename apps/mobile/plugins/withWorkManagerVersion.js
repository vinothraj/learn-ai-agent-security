// react-native-android-widget depends on androidx.work:work-runtime 2.8.1, which only works with Room 2.6.
// Other dependencies pull in Room 2.7+, and WorkManager < 2.11 then crashes at app start with
// "Failed to create an instance of class androidx.work.impl.WorkDatabase" (seen on 1.0.0 build 2).
// Declaring a newer WorkManager in the app makes Gradle resolve every request to it.
const { withAppBuildGradle } = require('expo/config-plugins');

const WORK_VERSION = '2.11.2';
const LINE = `    implementation("androidx.work:work-runtime:${WORK_VERSION}") // withWorkManagerVersion: Room 2.7+ compatibility`;

module.exports = (config) =>
  withAppBuildGradle(config, (cfg) => {
    const gradle = cfg.modResults.contents;
    if (gradle.includes('withWorkManagerVersion')) return cfg;
    const match = gradle.match(/^dependencies\s*\{\s*$/m);
    if (!match) throw new Error('withWorkManagerVersion: could not find the dependencies block in app/build.gradle');
    const at = match.index + match[0].length;
    cfg.modResults.contents = `${gradle.slice(0, at)}\n${LINE}${gradle.slice(at)}`;
    return cfg;
  });
module.exports.WORK_VERSION = WORK_VERSION;
