import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGymCrushStore } from '../src/store/useGymCrushStore';
import { useCopy } from '../src/i18n/useCopy';
import { space, useTheme } from '../src/theme/theme';
import { AppText, Button, IconButton } from '../src/ui/primitives';
import { ReactionBanner } from '../src/components/ReactionBanner';
import { formatTime } from '../src/components/RestTimerBar';
import { otherPartner } from '../src/features/workout/workoutHelpers';
import { PartnerProgressView } from '../src/features/workout/PartnerProgressView';

/** Read-only standalone screen for the other person's live workout (also linked from notifications). */
export default function PartnerWorkoutScreen() {
  const store = useGymCrushStore();
  const router = useRouter();
  const { colors } = useTheme();
  const c = useCopy();
  const insets = useSafeAreaInsets();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const pid = otherPartner(store.activeUser);
  const name = store.profiles[pid].name;
  const tint = colors.partners[pid];
  const status = store.partnerStatus;
  const active = !!status.isSessionActive && !!status.sessionStartedAt;
  const elapsed = status.sessionStartedAt ? Math.max(0, Math.floor((now - status.sessionStartedAt) / 1000)) : 0;

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <View style={[styles.topBar, { paddingTop: Platform.OS === 'ios' ? space.md : insets.top + space.sm }]}>
        <IconButton icon={{ ios: 'chevron.down', android: 'keyboard_arrow_down' }} label={c('Close', '關閉')} onPress={() => router.back()} variant="tinted" />
        <View style={styles.titleBlock}>
          <AppText variant="headline" numberOfLines={1} accessibilityRole="header">{c(`${name}'s workout`, `${name} 的訓練`)}</AppText>
          {active && (
            <AppText variant="number" tone="secondary" accessibilityLabel={c(`Elapsed ${formatTime(elapsed)}`, `已進行 ${formatTime(elapsed)}`)}>
              {formatTime(elapsed, true)}
            </AppText>
          )}
        </View>
        <Button title={c('Cheer', '加油')} size="small" variant="tinted" tint={tint} icon={{ ios: 'hands.clap.fill', android: 'celebration' }} onPress={() => router.push('/cheer')} />
      </View>

      <PartnerProgressView />
      {/* iOS page sheets cover the root banner. */}
      {Platform.OS === 'ios' && <ReactionBanner inSheet />}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md, paddingBottom: space.md },
  titleBlock: { flex: 1, alignItems: 'center' },
});
