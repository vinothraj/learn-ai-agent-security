import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import { router } from 'expo-router';
import { ChevronLeft, Cloud, CloudOff, Download, LogOut, RefreshCw, ShieldCheck, Trash2 } from '@/components/icons';
import { useState } from 'react';
import { Alert, Platform, Pressable, TextInput, View } from 'react-native';

import { Button, Card, IconBadge, Row, Screen, SectionTitle, T, Tag } from '@/components/ui';
import { useSync } from '@/state/sync';
import { useTheme } from '@/theme/ThemeProvider';
import { font, radius, space } from '@/theme/tokens';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function ago(ts: number | null) {
  if (!ts) return 'never';
  const m = Math.round((Date.now() - ts) / 60000);
  return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : new Date(ts).toLocaleString();
}

export default function Account() {
  const { theme } = useTheme();
  const s = useSync();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [stage, setStage] = useState<'email' | 'code'>('email');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const input = [
    font.body,
    { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.lg, minHeight: 52 },
  ];

  const back = (
    <Pressable accessibilityRole="button" accessibilityLabel="Back" hitSlop={12} onPress={() => router.back()}>
      <ChevronLeft size={28} color={theme.text} />
    </Pressable>
  );

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setMessage(null);
    try {
      await fn();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  const doSignIn = (replaceLocal = false) =>
    run(async () => {
      const r = await s.signIn(email, code, { replaceLocal });
      if (r === 'other-account') {
        Alert.alert(
          'Progress from another account',
          'This device holds progress from a different account. To protect privacy it can’t be merged. Remove it from this device and continue?',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Remove and continue', style: 'destructive', onPress: () => doSignIn(true) },
          ],
        );
      }
    });

  const exportData = () =>
    run(async () => {
      const data = await s.exportData();
      const json = JSON.stringify(data, null, 2);
      if (Platform.OS === 'web') {
        setMessage(`Export ready (${Math.round(json.length / 1024)} KB). Exporting files is supported in the phone app.`);
        return;
      }
      const file = new File(Paths.cache, 'learn-ai-security-export.json');
      if (file.exists) file.delete();
      file.create();
      await file.write(json);
      await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Your data export' });
    });

  const confirmDelete = () =>
    Alert.alert(
      'Delete your account?',
      'This permanently deletes your account and all progress stored in the cloud. It cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete account',
          style: 'destructive',
          onPress: () =>
            Alert.alert('Also erase this device?', 'Remove your progress from this phone too, or keep it locally without an account?', [
              { text: 'Keep on this device', onPress: () => run(async () => void (await s.deleteAccount(false), setMessage('Account deleted. Local progress kept.'))) },
              { text: 'Erase everything', style: 'destructive', onPress: () => run(async () => void (await s.deleteAccount(true), setMessage('Account and local progress deleted.'))) },
            ]),
        },
      ],
    );

  if (!s.configured) {
    return (
      <Screen title="Account" right={back}>
        <Card>
          <Row>
            <IconBadge icon={CloudOff} color={theme.textMuted} />
            <T v="heading" style={{ flex: 1 }}>
              Cloud sync isn’t available in this build
            </T>
          </Row>
          <T muted>Everything works offline and your progress stays on this device. Accounts and backup arrive with the cloud-enabled release.</T>
        </Card>
      </Screen>
    );
  }

  if (!s.session) {
    const devMode = s.authMode === 'dev';
    return (
      <Screen title="Account" subtitle="Back up your progress and use it on all your devices." right={back}>
        <Card>
          <Row>
            <IconBadge icon={ShieldCheck} />
            <T style={{ flex: 1 }}>
              We store only your email, display name and learning progress. No passwords: you sign in with a one-time code.
            </T>
          </Row>
        </Card>
        {devMode ? (
          <Tag label="DEVELOPER MODE: local test sign-in, no email is sent" color={theme.warning} />
        ) : null}
        <T v="label" muted>
          EMAIL
        </T>
        <TextInput
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          placeholder="you@example.com"
          placeholderTextColor={theme.textMuted}
          accessibilityLabel="Email address"
          editable={stage === 'email'}
          style={input}
        />
        {stage === 'code' ? (
          <>
            <T v="label" muted>
              6-DIGIT CODE FROM YOUR EMAIL
            </T>
            <TextInput
              value={code}
              onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              autoComplete="one-time-code"
              placeholder="123456"
              placeholderTextColor={theme.textMuted}
              accessibilityLabel="One-time code"
              style={input}
            />
            <Button label={busy ? 'Signing in…' : 'Sign in'} disabled={busy || code.length < 6} onPress={() => doSignIn()} />
            <Button kind="ghost" label="Use a different email" onPress={() => setStage('email')} />
          </>
        ) : (
          <Button
            label={busy ? 'Please wait…' : devMode ? 'Sign in (developer mode)' : 'Email me a code'}
            disabled={busy || !EMAIL.test(email.trim())}
            onPress={() =>
              devMode
                ? doSignIn()
                : run(async () => {
                    await s.sendCode(email);
                    setStage('code');
                  })
            }
          />
        )}
        {message ? <T color={theme.danger}>{message}</T> : null}
      </Screen>
    );
  }

  return (
    <Screen title="Account" right={back}>
      <Card accent>
        <Row>
          <IconBadge icon={Cloud} />
          <View style={{ flex: 1 }}>
            <T v="heading">{s.session.email}</T>
            <T v="caption" muted>
              {s.syncing ? 'Syncing…' : `Last synced ${ago(s.lastSyncAt)}`}
            </T>
          </View>
          {s.profile && s.profile.role !== 'learner' ? <Tag label={s.profile.role.replace('_', ' ').toUpperCase()} color={theme.warning} /> : null}
        </Row>
        {s.error ? <T color={theme.warning}>{s.error}</T> : null}
        <Button kind="secondary" icon={RefreshCw} label={s.syncing ? 'Syncing…' : 'Sync now'} disabled={s.syncing} onPress={s.syncNow} />
      </Card>

      <SectionTitle>Your data</SectionTitle>
      <Card>
        <T>Download everything we store about you as a JSON file (data portability).</T>
        <Button kind="secondary" icon={Download} label="Export my data" disabled={busy} onPress={exportData} />
      </Card>
      <Card>
        <T>Sign out keeps your progress on this device. It syncs again when you sign back in.</T>
        <Button kind="secondary" icon={LogOut} label="Sign out" onPress={() => run(s.signOut)} />
      </Card>
      <Card>
        <T>Deleting your account permanently removes your profile and all cloud-synced progress.</T>
        <Button kind="danger" icon={Trash2} label="Delete account" disabled={busy} onPress={confirmDelete} />
      </Card>
      {message ? <T color={theme.success}>{message}</T> : null}
    </Screen>
  );
}
