import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';

import { useTheme } from '@/theme/ThemeProvider';
import { radius } from '@/theme/tokens';
import { sceneFor, type ArtPalette } from './scenes';

/**
 * Decorative topic picture for a roadmap, lesson or lab, drawn from theme colours (so it follows light, dark,
 * AMOLED and high-contrast modes). Each roadmap has its own colour; lessons and labs inherit it.
 * Hidden from screen readers: the title next to it already says what it is.
 */
export function Illustration({ id, height, width, style }: { id: string; height: number; width?: number; style?: StyleProp<ViewStyle> }) {
  const { theme } = useTheme();
  const { scene, roadmapId } = sceneFor(id);
  const hues: Record<string, [string, string]> = {
    'ai-security-foundations': [theme.info, theme.accent],
    'genai-llm-security': [theme.accent, theme.ringPractice],
    'agent-security': [theme.ringPractice, theme.info],
    'ai-security-testing': [theme.warning, theme.accent],
    'interview-career': [theme.success, theme.info],
    // The theme has no sixth hue (ringLessons equals warning), so supporting knowledge gets its own pink.
    'ai-fundamentals': [theme.mode === 'light' ? '#BE185D' : '#F472B6', theme.ringPractice],
  };
  const [hue, hue2] = hues[roadmapId] ?? [theme.accent, theme.info];
  const palette: ArtPalette = {
    hue,
    hue2,
    ink: theme.text,
    paper: theme.surface,
    muted: theme.textMuted,
    ok: theme.success,
    bad: theme.danger,
    warn: theme.warning,
  };
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={[{ height, width, borderRadius: radius.md, overflow: 'hidden', backgroundColor: hue + '1F' }, style]}>
      <Svg width="100%" height="100%" viewBox="0 0 120 80" preserveAspectRatio="xMidYMid meet">
        <G opacity={0.35}>
          <Circle cx={6} cy={8} r={1.2} fill={hue} />
          <Circle cx={114} cy={72} r={1.2} fill={hue} />
          <Circle cx={112} cy={6} r={0.9} fill={hue} />
          <Circle cx={8} cy={74} r={0.9} fill={hue} />
        </G>
        {scene(palette)}
      </Svg>
    </View>
  );
}
