import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGymCrushStore } from '../../store/useGymCrushStore';
import { plural, useCopy } from '../../i18n/useCopy';
import { gutter, radius, space, useTheme } from '../../theme/theme';
import { AppText, Avatar, Button, Card, EmptyState, Icon } from '../../ui/primitives';
import { MachineImage } from '../../components/MachineImage';
import { formatTime } from '../../components/RestTimerBar';
import { MUSCLE_LABELS } from '../../i18n/translations';
import { formatWeight, machineName, otherPartner, sessionWorkoutId } from './workoutHelpers';
import { computeWorkoutExerciseAnalytics, formatClockTime, formatShortDuration } from './exerciseTiming';

/** Read-only view of the partner's live workout progress (used inside Workout tab and standalone modal). */
export function PartnerProgressView({ embedded = false }: { embedded?: boolean }) {
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
  const workoutId = sessionWorkoutId(status.sessionStartedAt ?? store.sessionStartedAt);
  const sets = useMemo(
    () =>
      store.sets
        .filter((s) => s.workoutId === workoutId && s.userId === pid)
        .sort((a, b) => Date.parse(a.loggedAt) - Date.parse(b.loggedAt) || a.setNumber - b.setNumber),
    [store.sets, workoutId, pid],
  );
  const machineIds = useMemo(
    () => [...new Set([...(status.sessionMachineIds ?? []), ...sets.map((s) => s.machineId)])],
    [status.sessionMachineIds, sets],
  );
  const active = !!status.isSessionActive || sets.length > 0;
  const current = store.machines.find((m) => m.id === status.currentMachineId);
  const where = machineName(current, store.language) || status.currentMachineName || c('Getting ready', '準備中');
  const onBreak = status.restSecondsRemaining > 0;
  const statusLine = onBreak
    ? c(`On a break · ${formatTime(status.restSecondsRemaining)} · ${where}`, `休息中 · ${formatTime(status.restSecondsRemaining)} · ${where}`)
    : status.currentMachineId || status.currentMachineName
    ? `${where} · ${c(`Set ${Math.max(1, status.currentSetNumber)}`, `第 ${Math.max(1, status.currentSetNumber)} 組`)}`
    : c('Getting ready', '準備中');

  const analytics = useMemo(
    () =>
      computeWorkoutExerciseAnalytics(
        sets,
        machineIds,
        status.exerciseTimings,
        status.sessionStartedAt ? new Date(status.sessionStartedAt).toISOString() : undefined,
      ),
    [sets, machineIds, status.exerciseTimings, status.sessionStartedAt],
  );

  const elapsed = status.sessionStartedAt ? Math.max(0, Math.floor((now - status.sessionStartedAt) / 1000)) : 0;

  if (!active) {
    return (
      <View style={styles.emptyWrap}>
        <EmptyState
          icon={{ ios: 'figure.strengthtraining.traditional', android: 'fitness_center' }}
          title={c(`${name} isn't training right now`, `${name} 目前沒有在訓練`)}
          body={c('Their exercises, sets, and current station will appear here live.', '對方的動作、組數與目前所在器材會即時顯示在這裡。')}
          action={
            store.isSessionActive
              ? { title: c(`Cheer ${name}`, `為 ${name} 加油`), onPress: () => router.push('/cheer') }
              : undefined
          }
        />
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={{
        paddingHorizontal: gutter,
        gap: space.md,
        paddingTop: embedded ? space.xs : 0,
        paddingBottom: Math.max(insets.bottom, space.md) + space.xxl,
      }}
    >
      <Card style={{ gap: space.md }}>
        <View style={styles.row}>
          <Avatar partnerId={pid} name={name} size={44} online={status.isOnline} />
          <View style={{ flex: 1, gap: 2 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
              <AppText variant="headline" numberOfLines={1}>{name}</AppText>
              <View style={[styles.badge, { backgroundColor: colors.fill }]}>
                <Icon name={{ ios: 'eye', android: 'visibility' }} size={12} color={colors.textSecondary} />
                <AppText variant="caption" tone="secondary">{c('Read-only', '僅供檢視')}</AppText>
              </View>
            </View>
            <AppText
              variant="subhead"
              color={onBreak ? colors.gold : colors.textSecondary}
              style={onBreak ? { fontWeight: '600' } : undefined}
              numberOfLines={2}
            >
              {statusLine}
            </AppText>
          </View>
          <Button
            title={c('Cheer', '加油')}
            size="small"
            variant="tinted"
            tint={tint}
            icon={{ ios: 'hands.clap.fill', android: 'celebration' }}
            onPress={() => router.push('/cheer')}
          />
        </View>

        <View style={[styles.summaryStrip, { borderTopColor: colors.separator }]}>
          <View style={styles.summaryStat}>
            <AppText variant="caption" tone="secondary">{c('Sets done', '已完成組數')}</AppText>
            <AppText variant="number">{sets.length}</AppText>
          </View>
          <View style={styles.summaryStat}>
            <AppText variant="caption" tone="secondary">{c('Exercises', '動作數')}</AppText>
            <AppText variant="number">{machineIds.length}</AppText>
          </View>
          {status.sessionStartedAt ? (
            <View style={styles.summaryStat}>
              <AppText variant="caption" tone="secondary">{c('Started', '開始時間')}</AppText>
              <AppText variant="number">
                {formatClockTime(status.sessionStartedAt, store.language)}
                {!embedded && elapsed > 0 ? ` · ${formatTime(elapsed, true)}` : ''}
              </AppText>
            </View>
          ) : null}
        </View>
      </Card>

      {analytics.length === 0 && (
        <EmptyState
          icon={{ ios: 'dumbbell', android: 'fitness_center' }}
          title={c('No exercises yet', '還沒有動作')}
          body={c(`${name} hasn't picked an exercise yet.`, `${name} 還沒選擇訓練動作。`)}
        />
      )}

      {analytics.map((item) => {
        const machine = store.machines.find((m) => m.id === item.machineId);
        const machineSets = sets.filter((s) => s.machineId === item.machineId);
        const focused = item.machineId === status.currentMachineId;
        const startStr = formatClockTime(item.startedAt, store.language);
        const endStr = formatClockTime(item.endedAt, store.language);
        const timingParts = [
          startStr ? (endStr && endStr !== startStr ? `${startStr} – ${endStr}` : `${c('Started', '開始')} ${startStr}`) : null,
          item.avgSetSeconds !== undefined ? `${c('Avg/set', '每組平均')} ${formatShortDuration(item.avgSetSeconds)}` : null,
          item.avgBreakSeconds !== undefined ? `${c('Avg break', '平均休息')} ${formatShortDuration(item.avgBreakSeconds)}` : null,
        ].filter(Boolean);

        return (
          <React.Fragment key={item.machineId}>
            {item.timeSincePreviousExerciseSeconds !== undefined && (
              <View style={styles.transitionRow}>
                <Icon name={{ ios: 'arrow.down', android: 'south' }} size={13} color={colors.textTertiary} />
                <AppText variant="caption" tone="secondary">
                  {c(
                    `Between exercises · ${formatShortDuration(item.timeSincePreviousExerciseSeconds)}`,
                    `換動作間隔 · ${formatShortDuration(item.timeSincePreviousExerciseSeconds)}`,
                  )}
                </AppText>
              </View>
            )}
            <Card style={{ borderWidth: 2, borderColor: focused ? tint.color : 'transparent', gap: space.md }}>
              <View style={styles.row}>
                <View style={[styles.thumb, { backgroundColor: colors.fill }]}>
                  {machine?.photoUri ? (
                    <MachineImage source={{ uri: machine.photoUri }} style={styles.thumb} resizeMode="cover" accessibilityIgnoresInvertColors />
                  ) : (
                    <Icon name={{ ios: 'dumbbell', android: 'fitness_center' }} size={22} color={colors.textSecondary} />
                  )}
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' }}>
                    <AppText variant="headline" numberOfLines={2} style={{ flexShrink: 1 }}>
                      {machineName(machine, store.language) || machineSets[0]?.machineName || c('Exercise', '動作')}
                    </AppText>
                    {focused && (
                      <View style={[styles.badge, { backgroundColor: tint.subtle }]}>
                        <AppText variant="caption" color={tint.color} style={{ fontWeight: '700' }}>
                          {c('Current', '目前')}
                        </AppText>
                      </View>
                    )}
                  </View>
                  {machine && <AppText variant="footnote" tone="secondary">{MUSCLE_LABELS[store.language][machine.muscleGroup]}</AppText>}
                </View>
                <AppText variant="number" tone="secondary">{c(plural(machineSets.length, 'set', 'sets'), `${machineSets.length} 組`)}</AppText>
              </View>

              {timingParts.length > 0 && (
                <AppText variant="caption" tone="secondary">{timingParts.join(' · ')}</AppText>
              )}

              {machineSets.length === 0 ? (
                <AppText variant="footnote" tone="tertiary">{c('No sets logged yet', '尚無組數')}</AppText>
              ) : (
                <View>
                  {machineSets.map((s) => (
                    <View
                      key={s.id}
                      style={[styles.setRow, { borderTopColor: colors.separator }]}
                      accessible
                      accessibilityLabel={`${c(`Set ${s.setNumber}`, `第 ${s.setNumber} 組`)}, ${formatWeight(s.weight)} ${s.unit} × ${s.reps}${s.isPR ? ', PR' : ''}`}
                    >
                      <AppText variant="number" style={{ width: 28 }}>{s.setNumber}</AppText>
                      <AppText variant="number" style={{ flex: 1 }}>
                        {formatWeight(s.weight)} <AppText variant="footnote" tone="secondary">{s.unit}</AppText> × {s.reps}
                      </AppText>
                      <AppText variant="caption" tone="tertiary">{formatClockTime(s.loggedAt, store.language)}</AppText>
                      {s.isPR && (
                        <View style={[styles.pr, { backgroundColor: colors.goldSubtle }]}>
                          <Icon name={{ ios: 'crown.fill', android: 'workspace_premium' }} size={12} color={colors.gold} />
                          <AppText variant="caption" color={colors.gold} style={{ fontWeight: '700' }}>PR</AppText>
                        </View>
                      )}
                      <Icon name={{ ios: 'checkmark.circle.fill', android: 'check_circle' }} size={22} color={tint.color} />
                    </View>
                  ))}
                </View>
              )}
            </Card>
          </React.Fragment>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  emptyWrap: { flex: 1, justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: space.sm, paddingVertical: 2, borderRadius: radius.pill },
  summaryStrip: { flexDirection: 'row', gap: space.lg, paddingTop: space.md, borderTopWidth: StyleSheet.hairlineWidth },
  summaryStat: { flex: 1, gap: 2 },
  transitionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.xs, paddingVertical: 2 },
  thumb: { width: 48, height: 48, borderRadius: radius.md, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 44, borderTopWidth: StyleSheet.hairlineWidth },
  pr: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: space.xs + 2, paddingVertical: 1, borderRadius: radius.pill },
});
