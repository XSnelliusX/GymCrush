import React, { useEffect, useMemo, useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGymCrushStore } from '../src/store/useGymCrushStore';
import { plural, useCopy } from '../src/i18n/useCopy';
import { gutter, radius, space, useTheme } from '../src/theme/theme';
import { AppText, Avatar, Button, Card, EmptyState, Icon, IconButton } from '../src/ui/primitives';
import { MachineImage } from '../src/components/MachineImage';
import { ReactionBanner } from '../src/components/ReactionBanner';
import { formatTime } from '../src/components/RestTimerBar';
import { MUSCLE_LABELS } from '../src/i18n/translations';
import { formatWeight, machineName, otherPartner, sessionWorkoutId } from '../src/features/workout/workoutHelpers';

/** Read-only view of the other person's live workout. */
export default function PartnerWorkoutScreen() {
  const store = useGymCrushStore();
  const router = useRouter();
  const { colors } = useTheme();
  const c = useCopy();
  const insets = useSafeAreaInsets();
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);

  const pid = otherPartner(store.activeUser);
  const name = store.profiles[pid].name;
  const tint = colors.partners[pid];
  const status = store.partnerStatus;
  const active = !!status.isSessionActive && !!status.sessionStartedAt;
  const workoutId = sessionWorkoutId(status.sessionStartedAt ?? null);
  const sets = useMemo(
    () => store.sets.filter((s) => s.workoutId === workoutId && s.userId === pid).sort((a, b) => a.setNumber - b.setNumber),
    [store.sets, workoutId, pid],
  );
  const machineIds = [...new Set([...(status.sessionMachineIds ?? []), ...sets.map((s) => s.machineId)])];
  const elapsed = status.sessionStartedAt ? Math.max(0, Math.floor((now - status.sessionStartedAt) / 1000)) : 0;
  const current = store.machines.find((m) => m.id === status.currentMachineId);
  const where = machineName(current, store.language) || status.currentMachineName || c('Getting ready', '準備中');
  const line = status.restSecondsRemaining > 0 ? c(`Resting ${formatTime(status.restSecondsRemaining)}`, `休息 ${formatTime(status.restSecondsRemaining)}`) : where;

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <View style={[styles.topBar, { paddingTop: Platform.OS === 'ios' ? space.md : insets.top + space.sm }]}>
        <IconButton icon={{ ios: 'chevron.down', android: 'keyboard_arrow_down' }} label={c('Close', '關閉')} onPress={() => router.back()} variant="tinted" />
        <View style={styles.titleBlock}>
          <AppText variant="headline" numberOfLines={1} accessibilityRole="header">{c(`${name}'s workout`, `${name} 的訓練`)}</AppText>
          {active && <AppText variant="number" tone="secondary" accessibilityLabel={c(`Elapsed ${formatTime(elapsed)}`, `已進行 ${formatTime(elapsed)}`)}>{formatTime(elapsed, true)}</AppText>}
        </View>
        <Button title={c('Cheer', '加油')} size="small" variant="tinted" tint={tint} icon={{ ios: 'hands.clap.fill', android: 'celebration' }} onPress={() => router.push('/cheer')} />
      </View>

      {!active ? (
        <EmptyState icon={{ ios: 'figure.strengthtraining.traditional', android: 'fitness_center' }} title={c(`${name} isn't training right now`, `${name} 目前沒有在訓練`)} body={c('Their workout appears here as soon as they start.', '對方開始訓練後會顯示在這裡。')} />
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: gutter, gap: space.lg, paddingBottom: Math.max(insets.bottom, space.md) + space.xxl }}>
          <Card>
            <View style={styles.row}>
              <Avatar partnerId={pid} name={name} size={44} online={status.isOnline} />
              <View style={{ flex: 1, gap: 2 }}>
                <AppText variant="headline" numberOfLines={1}>{status.routineTitle || c('Workout', '訓練')}</AppText>
                <AppText variant="subhead" tone="secondary" numberOfLines={1}>{line}</AppText>
              </View>
              <AppText variant="number" tone="secondary">{c(plural(sets.length, 'set', 'sets'), `${sets.length} 組`)}</AppText>
            </View>
          </Card>

          {machineIds.length === 0 && <EmptyState icon={{ ios: 'dumbbell', android: 'fitness_center' }} title={c('No exercises yet', '還沒有動作')} />}

          {machineIds.map((id) => {
            const machine = store.machines.find((m) => m.id === id);
            const machineSets = sets.filter((s) => s.machineId === id);
            const focused = id === status.currentMachineId;
            return (
              <Card key={id} style={{ borderWidth: 2, borderColor: focused ? tint.color : 'transparent' }}>
                <View style={styles.row}>
                  <View style={[styles.thumb, { backgroundColor: colors.fill }]}>
                    {machine?.photoUri
                      ? <MachineImage source={{ uri: machine.photoUri }} style={styles.thumb} resizeMode="cover" accessibilityIgnoresInvertColors />
                      : <Icon name={{ ios: 'dumbbell', android: 'fitness_center' }} size={22} color={colors.textSecondary} />}
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <AppText variant="headline" numberOfLines={2}>{machineName(machine, store.language) || machineSets[0]?.machineName || c('Exercise', '動作')}</AppText>
                    {machine && <AppText variant="footnote" tone="secondary">{MUSCLE_LABELS[store.language][machine.muscleGroup]}</AppText>}
                  </View>
                </View>
                {machineSets.length === 0 ? (
                  <AppText variant="footnote" tone="tertiary" style={{ marginTop: space.md }}>{c('No sets yet', '尚無組數')}</AppText>
                ) : machineSets.map((s) => (
                  <View key={s.id} style={[styles.setRow, { borderTopColor: colors.separator }]} accessible accessibilityLabel={`${c(`Set ${s.setNumber}`, `第 ${s.setNumber} 組`)}, ${formatWeight(s.weight)} ${s.unit} × ${s.reps}${s.isPR ? ', PR' : ''}`}>
                    <AppText variant="number" style={{ width: 28 }}>{s.setNumber}</AppText>
                    <AppText variant="number" style={{ flex: 1 }}>{formatWeight(s.weight)} <AppText variant="footnote" tone="secondary">{s.unit}</AppText> × {s.reps}</AppText>
                    {s.isPR && <View style={[styles.pr, { backgroundColor: colors.goldSubtle }]}><Icon name={{ ios: 'crown.fill', android: 'workspace_premium' }} size={12} color={colors.gold} /><AppText variant="caption" color={colors.gold} style={{ fontWeight: '700' }}>PR</AppText></View>}
                    <Icon name={{ ios: 'checkmark.circle.fill', android: 'check_circle' }} size={22} color={tint.color} />
                  </View>
                ))}
              </Card>
            );
          })}
        </ScrollView>
      )}
      {/* iOS page sheets cover the root banner. */}
      {Platform.OS === 'ios' && <ReactionBanner inSheet />}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md, paddingBottom: space.md },
  titleBlock: { flex: 1, alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  thumb: { width: 48, height: 48, borderRadius: radius.md, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 44, borderTopWidth: StyleSheet.hairlineWidth },
  pr: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: space.xs + 2, paddingVertical: 1, borderRadius: radius.pill },
});
