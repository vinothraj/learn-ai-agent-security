// App entry: Expo Router, plus the Android widget's headless task when the widget module is present.
import 'expo-router/entry';

import { widgetApi } from './src/widget';

widgetApi()?.registerWidget();
