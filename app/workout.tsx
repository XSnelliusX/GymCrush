import React, { useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGymCrushStore } from '../src/store/useGymCrushStore';
import { plural, useCopy } from '../src/i18n/useCopy';
import { gutter, radius, space, useTheme } from '../src/theme/theme';
import { AppText, Avatar, Button, EmptyState, Icon, IconButton } from '../src/ui/primitives';
import { formatTime } from '../src/components/RestTimerBar';
import { ExerciseCard } from '../src/features/workout/ExerciseCard';
import { RestPanel } from '../src/features/workout/RestPanel';
import { ReactionBanner } from '../src/components/ReactionBanner';
import { machineName, otherPartner, sessionWorkoutId } from '../src/features/workout/workoutHelpers';

export default function WorkoutScreen() {
  const store = useGymCrushStore();
  const router = useRouter();
  const { colors } = useTheme();
  const c = useCopy();
  const insets = useSafeAreaInsets();
  const [restHeight, setRestHeight] = useState(0);

  const me = store.activeUser;
  const user = colors.partners[me];
  const workoutId = sessionWorkoutId(store.sessionStartedAt);
  const sessionSets = useMemo(
    () => store.sets.filter((s) => s.workoutId === workoutId && s.userId === me).sort((a, b) => Date.parse(a.loggedAt) - Date.parse(b.loggedAt)),
    [store.sets, workoutId, me],
  );
  const sessionMachines = store.sessionMachineIds.map((id) => store.machines.find((m) => m.id === id)).filter((m) => !!m);
  const focusedId = sessionMachines.some((m) => m.id === store.selectedMachineId) ? store.selectedMachineId : sessionMachines[0]?.id;
  const topPad = Platform.OS === 'ios' ? space.md : insets.top + space.sm;

  const totalSets = store.sets.filter((s) => s.workoutId === workoutId).length;
  const finish = () => Alert.alert(
    totalSets ? c('Finish workout?', '結束訓練？') : c('End workout?', '結束訓練？'),
    totalSets ? c(`${plural(totalSets, 'set', 'sets')} logged between you. This stops the timer for both of you.`, `你們共記錄 ${totalSets} 組。兩人的計時都會停止。`) : c('No sets were logged, so nothing will be saved.', '尚未記錄任何組數，本次訓練不會儲存。'),
    [
      { text: c('Keep going', '繼續訓練'), style: 'cancel' },
      totalSets
        ? { text: c('Finish', '結束'), onPress: () => { store.finishSession(); router.replace('/workout-summary'); } }
        : { text: c('End workout', '結束'), style: 'destructive', onPress: () => { store.finishSession(); router.back(); } },
    ],
  );

  const topBar = (
    <View style={[styles.topBar, { paddingTop: topPad }]}>
      <IconButton icon={{ ios: 'chevron.down', android: 'keyboard_arrow_down' }} label={c('Minimize workout', '縮小訓練畫面')} onPress={() => router.back()} variant="tinted" />
      <View style={styles.titleBlock}>
        <AppText variant="headline" numberOfLines={1} accessibilityRole="header">{store.sessionTitle || c('Workout', '訓練')}</AppText>
        {store.isSessionActive && (
          <AppText variant="number" tone="secondary" accessibilityLabel={c(`Elapsed ${formatTime(store.sessionElapsedSeconds)}`, `已進行 ${formatTime(store.sessionElapsedSeconds)}`)}>
            {formatTime(store.sessionElapsedSeconds, true)}
          </AppText>
        )}
      </View>
      {store.isSessionActive && <Button title={c('Finish', '結束')} size="small" tint={user} onPress={finish} />}
    </View>
  );

  if (!store.isSessionActive) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.bg }]}>
        {topBar}
        <EmptyState
          icon={{ ios: 'figure.strengthtraining.traditional', android: 'fitness_center' }}
          title={c('No workout running', '目前沒有進行中的訓練')}
          body={c('Start one and the timer runs for both of you.', '開始訓練，兩人共用同一個計時。')}
          action={{ title: c('Start workout', '開始訓練'), onPress: () => store.startSession() }}
        />
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      {topBar}
      <PartnerStrip />
      {/* iOS: ScrollView insets itself; Android edge-to-edge: adjustResize may not apply, so shrink via KAV "height". */}
      <KeyboardAvoidingView style={{ flex: 1 }} enabled={Platform.OS === 'android'} behavior="height">
        <ScrollView
          automaticallyAdjustKeyboardInsets
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          contentContainerStyle={{ paddingHorizontal: gutter, gap: space.lg, paddingBottom: Math.max(insets.bottom, space.md) + restHeight + space.xxl }}
        >
          <AlarmRow />

          {sessionMachines.length === 0 ? (
            <EmptyState
              icon={{ ios: 'dumbbell', android: 'fitness_center' }}
              title={c('No exercises yet', '還沒有動作')}
              body={c('Add a machine to start logging sets.', '新增器材開始記錄組數。')}
              action={{ title: c('Add exercise', '新增動作'), onPress: () => router.push('/add-exercise') }}
            />
          ) : (
            <>
              {sessionMachines.map((m) => (
                <ExerciseCard key={m.id} machine={m} sessionSets={sessionSets} workoutId={workoutId} focused={m.id === focusedId} />
              ))}
              <Button title={c('Add exercise', '新增動作')} icon={{ ios: 'plus', android: 'add' }} variant="tinted" tint={user} onPress={() => router.push('/add-exercise')} />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
      <RestPanel onHeight={setRestHeight} />
      {/* iOS page sheets cover the root banner. */}
      {Platform.OS === 'ios' && <ReactionBanner inSheet />}
    </View>
  );
}

/** Count-up alarm for gyms that bill by the hour. Fires through the OS, so it also rings with the app in the background. */
function AlarmRow() {
  const store = useGymCrushStore();
  const { colors } = useTheme();
  const c = useCopy();
  const minutes = store.sessionAlarmMinutes;
  const remaining = minutes * 60 - store.sessionElapsedSeconds;
  const over = minutes > 0 && remaining <= 0;
  const detail = minutes === 0 ? c('No alert this workout', '本次訓練不提醒')
    : over ? c("Time's up", '時間到了')
    : c(`${formatTime(remaining, true)} left`, `剩餘 ${formatTime(remaining, true)}`);
  const value = minutes === 0 ? c('Off', '關閉') : c(`${minutes} min`, `${minutes} 分鐘`);
  return (
    <View style={[styles.partner, { backgroundColor: colors.surface }]}>
      <Icon name={{ ios: minutes ? 'alarm.fill' : 'alarm', android: 'alarm' }} size={22} color={over ? colors.danger : colors.textSecondary} />
      <View style={{ flex: 1 }} accessible accessibilityLiveRegion="none" accessibilityLabel={`${c('Workout alarm', '訓練提醒')}, ${value}, ${detail}`}>
        <AppText variant="subhead" style={{ fontWeight: '600' }} numberOfLines={1}>{c('Workout alarm', '訓練提醒')}</AppText>
        <AppText variant="footnote" numberOfLines={1} color={over ? colors.danger : colors.textSecondary}>{detail}</AppText>
      </View>
      <IconButton icon={{ ios: 'minus', android: 'remove' }} label={c('5 minutes earlier', '提早 5 分鐘')} variant="tinted" size={36} iconSize={14} disabled={minutes === 0} onPress={() => store.setSessionAlarm(minutes - 5)} />
      <AppText variant="number" style={{ minWidth: 56, textAlign: 'center' }}>{value}</AppText>
      <IconButton icon={{ ios: 'plus', android: 'add' }} label={c('5 minutes later', '延後 5 分鐘')} variant="tinted" size={36} iconSize={14} disabled={minutes >= 240} onPress={() => store.setSessionAlarm(minutes + 5)} />
    </View>
  );
}

function PartnerStrip() {
  const store = useGymCrushStore();
  const router = useRouter();
  const { colors } = useTheme();
  const c = useCopy();
  const status = store.partnerStatus;
  const pid = otherPartner(store.activeUser);
  if (!status.isOnline && !status.isSessionActive) return null;
  const name = store.profiles[pid].name;
  const machine = store.machines.find((m) => m.id === status.currentMachineId);
  const where = machineName(machine, store.language) || status.currentMachineName || c('Getting ready', '準備中');
  const onBreak = status.restSecondsRemaining > 0;
  const line = onBreak
    ? c(`On a break · ${formatTime(status.restSecondsRemaining)}`, `休息中 · ${formatTime(status.restSecondsRemaining)}`)
    : `${where} · ${c(`set ${status.currentSetNumber || 1}`, `第 ${status.currentSetNumber || 1} 組`)}`;
  return (
    <View style={[styles.partner, styles.pinned, { backgroundColor: colors.surface }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${name}, ${line}`}
        accessibilityHint={c(`Opens ${name}'s workout`, `開啟 ${name} 的訓練`)}
        onPress={() => router.push('/partner-workout')}
        style={({ pressed }) => [styles.partnerOpen, pressed && { opacity: 0.6 }]}
      >
        <Avatar partnerId={pid} name={name} size={36} online={status.isOnline} />
        <View style={{ flex: 1 }}>
          <AppText variant="subhead" style={{ fontWeight: '600' }} numberOfLines={1}>{name}</AppText>
          <AppText variant="footnote" color={onBreak ? colors.gold : colors.textSecondary} style={onBreak ? { fontWeight: '600' } : undefined} numberOfLines={1}>{line}</AppText>
        </View>
        <Icon name={{ ios: 'chevron.right', android: 'chevron_right' }} size={14} color={colors.textTertiary} />
      </Pressable>
      <Button title={c('Cheer', '加油')} size="small" variant="tinted" tint={colors.partners[pid]} icon={{ ios: 'hands.clap.fill', android: 'celebration' }} onPress={() => router.push('/cheer')} accessibilityHint={c(`Send ${name} a cheer`, `為 ${name} 加油`)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md, paddingBottom: space.md },
  titleBlock: { flex: 1, alignItems: 'center' },
  partner: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.card },
  pinned: { marginHorizontal: gutter, marginBottom: space.md },
  partnerOpen: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md },
});
