import { DELETE_ACCOUNT, LEGAL, PRIVACY_POLICY, type LegalSection } from '@laas/content';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { ChevronLeft } from '@/components/icons';
import { Button, Card, Screen, T } from '@/components/ui';
import { useTheme } from '@/theme/ThemeProvider';

function Section({ s }: { s: LegalSection }) {
  return (
    <Card>
      <T v="heading">{s.title}</T>
      {s.paragraphs.map((p) => (
        <T key={p}>{p}</T>
      ))}
      {s.bullets ? (
        <View style={{ gap: 6 }}>
          {s.bullets.map((b) => (
            <T key={b}>• {b}</T>
          ))}
        </View>
      ) : null}
    </Card>
  );
}

/** The privacy policy, bundled so it is readable offline; same text as the hosted page. */
export default function Privacy() {
  const { theme } = useTheme();
  const back = (
    <Pressable accessibilityRole="button" accessibilityLabel="Back" hitSlop={12} onPress={() => router.back()}>
      <ChevronLeft size={28} color={theme.text} />
    </Pressable>
  );
  return (
    <Screen title="Privacy" subtitle={`Effective ${LEGAL.effectiveDate}`} right={back}>
      {PRIVACY_POLICY.map((s) => (
        <Section key={s.title} s={s} />
      ))}
      {DELETE_ACCOUNT.map((s) => (
        <Section key={s.title} s={s} />
      ))}
      <Button kind="secondary" label="Account & data controls" onPress={() => router.push('/account')} />
    </Screen>
  );
}
