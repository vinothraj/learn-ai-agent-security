import { FlexWidget, TextWidget } from 'react-native-android-widget';

import { widgetLines, type WidgetSnapshot } from './snapshot';

// Widgets render outside the app, so colours are fixed: the dark brand palette (AA contrast verified).
const BG = '#121A33';
const TEXT = '#E8ECF8';
const MUTED = '#9AA4C7';
const ACCENT = '#2DD4BF';

export function ProgressWidget({ snapshot, today }: { snapshot: WidgetSnapshot | null; today: string }) {
  const l = widgetLines(snapshot, today);
  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri: l.action }}
      accessibilityLabel={`${l.headline}. ${l.detail}`}
      style={{ height: 'match_parent', width: 'match_parent', backgroundColor: BG, borderRadius: 22, padding: 16, flexDirection: 'column', justifyContent: 'space-between' }}>
      <TextWidget text="AI Agent Security" style={{ fontSize: 12, color: ACCENT, fontWeight: '700' }} />
      <TextWidget text={l.headline} style={{ fontSize: 18, color: TEXT, fontWeight: '700' }} maxLines={1} truncate="END" />
      <TextWidget text={l.detail} style={{ fontSize: 13, color: MUTED }} maxLines={2} truncate="END" />
    </FlexWidget>
  );
}
