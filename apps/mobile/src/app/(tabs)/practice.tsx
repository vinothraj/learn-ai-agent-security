import { router } from 'expo-router';
import { ChevronRight, FlaskConical, Gamepad2, MessageSquareText, Zap, type LucideIcon } from 'lucide-react-native';
import { View } from 'react-native';

import { Appear, Card, IconBadge, Row, Screen, SectionTitle, T, Tag } from '@/components/ui';
import { useTheme } from '@/theme/ThemeProvider';

function Item({
  icon,
  color,
  title,
  detail,
  onPress,
  soon,
}: {
  icon: LucideIcon;
  color: string;
  title: string;
  detail: string;
  onPress?: () => void;
  soon?: string;
}) {
  const { theme } = useTheme();
  return (
    <Card onPress={onPress} accessibilityLabel={title} style={soon ? { opacity: 0.75 } : undefined}>
      <Row>
        <IconBadge icon={icon} color={color} />
        <View style={{ flex: 1, gap: 2 }}>
          <T v="heading">{title}</T>
          <T v="caption" muted>
            {detail}
          </T>
        </View>
        {soon ? <Tag label={soon} color={theme.textMuted} /> : <ChevronRight size={20} color={theme.textMuted} />}
      </Row>
    </Card>
  );
}

export default function Practice() {
  const { theme } = useTheme();
  return (
    <Screen title="Practice" subtitle="Short, safe exercises on fictional systems.">
      <Appear index={0}>
        <Item
          icon={Zap}
          color={theme.ringPractice}
          title="Quick quiz"
          detail="5 questions, prioritising lessons you've studied"
          onPress={() => router.push('/quiz')}
        />
      </Appear>
      <Appear index={1}>
        <Item
          icon={MessageSquareText}
          color={theme.info}
          title="Interview question bank"
          detail="Model answers, key concepts and evidence labels"
          onPress={() => router.push('/interview')}
        />
      </Appear>
      <Appear index={2}>
        <SectionTitle>On the roadmap</SectionTitle>
      </Appear>
      <Appear index={3}>
        <Item
          icon={FlaskConical}
          color={theme.success}
          title="Security labs"
          detail="Simulated prompt injection, RAG and agent-permission labs with reports"
          soon="Soon"
        />
      </Appear>
      <Appear index={4}>
        <Item
          icon={Gamepad2}
          color={theme.warning}
          title="Mini-games"
          detail="Spot the Injection, Least Privilege, RAG Leak Hunt and more"
          soon="Soon"
        />
      </Appear>
    </Screen>
  );
}
