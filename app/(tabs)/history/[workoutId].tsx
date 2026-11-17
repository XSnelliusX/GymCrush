import React, { useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { MachineImage } from '../../../src/components/MachineImage';
import { AppText, Avatar, Button, Card, Chip, EmptyState, haptics, Icon, IconButton, ScreenScroll, SegmentedControl, TextField } from '../../../src/ui/primitives';
import { gutter, radius, space, touch, useTheme } from '../../../src/theme/theme';
import { useGymCrushStore } from '../../../src/store/useGymCrushStore';
import { plural, useCopy } from '../../../src/i18n/useCopy';
import { workoutDuration, workoutStart } from '../../../src/services/workoutHistory';
import { formatDuration } from '../../../src/features/history/helpers';
import { computeWorkoutExerciseAnalytics, formatClockTime, formatShortDuration } from '../../../src/features/workout/exerciseTiming';
import { KeyboardDoneBar, Stepper } from '../../../src/features/workout/Stepper';
import { formatWeight, machineName } from '../../../src/features/workout/workoutHelpers';
import { MUSCLE_GROUPS } from '../../../src/features/machines/machineUtils';
import { MUSCLE_LABELS } from '../../../src/i18n/translations';
import { MuscleGroup, PartnerId } from '../../../src/types/gym';

const MUSCLES: (MuscleGroup | 'All')[] = ['All', ...MUSCLE_GROUPS];
const PARTNERS: PartnerId[] = ['markus', 'partner'];

export default function WorkoutDetailScreen() {
  const { workoutId } = useLocalSearchParams<{ workoutId: string }>();
  const store = useGymCrushStore();
  const { colors } = useTheme();
  const c = useCopy();
  const router = useRouter();
  const zh = store.language === 'zh-TW';
  const w = store.completedWorkouts.find((x) => x.id === workoutId);

  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [addingExercise, setAddingExercise] = useState(false);
  const [query, setQuery] = useState('');
  const [muscleFilter, setMuscleFilter] = useState<MuscleGroup | 'All'>('All');

  const [addSetMachineId, setAddSetMachineId] = useState<string | null>(null);
  const [addSetPartner, setAddSetPartner] = useState<PartnerId>(store.activeUser ?? 'markus');
  const [addSetWeight, setAddSetWeight] = useState('');
  const [addSetReps, setAddSetReps] = useState('');
  const [addSetError, setAddSetError] = useState('');

  if (!w) {
    return (
      <>
        <Stack.Screen options={{ title: c('Workout', '訓練') }} />
        <EmptyState icon={{ ios: 'questionmark.circle', android: 'help' }} title={c('Workout not found', '找不到這次訓練')} action={{ title: c('Back to history', '返回紀錄'), onPress: () => router.replace('/history') }} />
      </>
    );
  }

  const machines = store.machines ?? [];
  const profiles = store.profiles;
  const activeUser: PartnerId = store.activeUser ?? 'markus';
  const title = w.title || c('Workout', '訓練');
  const sets = store.sets.filter((s) => s.workoutId === w.id);
  const machineIds = [...new Set([...(w.machineIds ?? []), ...sets.map((s) => s.machineId)])];
  const dur = formatDuration(workoutDuration(w));
  const startIso = workoutStart(w);
  const sortedSets = [...sets].sort((a, b) => Date.parse(a.loggedAt) - Date.parse(b.loggedAt));
  const endIso = sortedSets.at(-1)?.loggedAt ?? w.finishedAt;
  const startClock = formatClockTime(startIso, store.language);
  const endClock = formatClockTime(endIso, store.language);
  const date = new Date(startIso ?? w.finishedAt).toLocaleDateString(zh ? 'zh-TW' : 'en', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const analytics = computeWorkoutExerciseAnalytics(sets, machineIds, w.exerciseTimings, startIso);

  const save = () => {
    store.changeWorkout(w.id, draftTitle);
    setEditing(false);
  };

  const remove = () => {
    const heading = c('Delete this session?', '刪除這次訓練？');
    const message = c('This deletes the session and all its sets for both of you, and updates your progress and records. This can’t be undone.', '這會刪除這次訓練及雙方的所有組數，並更新進度與個人紀錄。刪除後無法復原。');
    const confirm = () => {
      haptics.warning();
      store.changeWorkout(w.id, null);
      router.replace('/history');
    };
    if (Platform.OS === 'web') {
      if (window.confirm(`${heading}\n\n${message}`)) confirm();
      return;
    }
    Alert.alert(heading, message, [
      { text: c('Cancel', '取消'), style: 'cancel' },
      { text: c('Delete session', '刪除訓練'), style: 'destructive', onPress: confirm },
    ]);
  };

  const confirmRemoveExercise = (machineId: string, name: string) => {
    const heading = c(`Remove ${name}?`, `從訓練移除「${name}」？`);
    const message = c('This removes the exercise and its sets from this workout.', '這會從這次訓練移除該動作與組數。');
    const run = () => {
      haptics.warning();
      store.removeExerciseFromWorkout(w.id, machineId);
      if (addSetMachineId === machineId) setAddSetMachineId(null);
    };
    if (Platform.OS === 'web') {
      if (window.confirm(`${heading}\n\n${message}`)) run();
      return;
    }
    Alert.alert(heading, message, [
      { text: c('Cancel', '取消'), style: 'cancel' },
      { text: c('Remove', '移除'), style: 'destructive', onPress: run },
    ]);
  };

  const openAddSet = (machineId: string, partnerId: PartnerId = activeUser) => {
    const m = machines.find((x) => x.id === machineId);
    const existingForUser = sets
      .filter((s) => s.machineId === machineId && s.userId === partnerId)
      .sort((a, b) => a.setNumber - b.setNumber);
    const latest = existingForUser.at(-1);
    const setup = m?.partnerSetups?.[partnerId];
    const defaultW = latest ? latest.weight : setup?.lastWorkingWeight ?? 0;
    const defaultR = latest ? latest.reps : setup?.lastReps || 10;
    setAddSetMachineId(machineId);
    setAddSetPartner(partnerId);
    setAddSetWeight(formatWeight(defaultW));
    setAddSetReps(String(defaultR));
    setAddSetError('');
  };

  const switchAddSetPartner = (machineId: string, partnerId: PartnerId) => {
    openAddSet(machineId, partnerId);
  };

  const submitAddSet = (machineId: string) => {
    const wNum = Number(addSetWeight.replace(',', '.'));
    const rNum = Number(addSetReps);
    if (!addSetWeight.trim() || !Number.isFinite(wNum) || wNum < 0 || !Number.isSafeInteger(rNum) || rNum < 1) {
      setAddSetError(c('Enter a weight (zero is fine) and whole reps.', '請輸入重量（可為 0）與整數次數。'));
      return;
    }
    store.addSetToWorkout(w.id, machineId, addSetPartner, Number(wNum.toFixed(2)), rNum);
    setAddSetMachineId(null);
    setAddSetError('');
  };

  const pickExerciseToAdd = (machineId: string) => {
    store.addExerciseToWorkout(w.id, machineId);
    setAddingExercise(false);
    setQuery('');
    openAddSet(machineId, activeUser);
  };

  const q = query.trim().toLowerCase();
  const filteredMachines = machines.filter(
    (m) =>
      (muscleFilter === 'All' || m.muscleGroup === muscleFilter) &&
      (!q || m.name.toLowerCase().includes(q) || (m.nameZh ?? '').toLowerCase().includes(q)),
  );

  const timeParts = [
    startClock ? `${c('Started', '開始')} ${startClock}` : null,
    endClock ? `${c('Ended', '結束')} ${endClock}` : null,
  ].filter(Boolean);

  return (
    <ScreenScroll contentContainerStyle={{ gap: space.lg }}>
      <Stack.Screen options={{ title, headerLargeTitleEnabled: false }} />
      <Card>
        {editing ? (
          <View style={{ gap: space.md, marginBottom: space.lg }}>
            <TextField label={c('Session name', '訓練名稱')} value={draftTitle} onChangeText={setDraftTitle} maxLength={120} autoFocus returnKeyType="done" onSubmitEditing={() => { if (draftTitle.trim()) save(); }} />
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <Button title={c('Cancel', '取消')} variant="tinted" onPress={() => setEditing(false)} style={{ flex: 1 }} />
              <Button title={c('Save', '儲存')} onPress={save} disabled={!draftTitle.trim()} style={{ flex: 1 }} />
            </View>
          </View>
        ) : (
          <Button title={c('Edit session', '編輯訓練')} variant="tinted" icon={{ ios: 'pencil', android: 'edit' }} onPress={() => { setDraftTitle(title); setEditing(true); }} style={{ marginBottom: space.lg }} />
        )}
        <AppText variant="headline">{date}</AppText>
        {timeParts.length > 0 && (
          <AppText variant="subhead" tone="secondary" style={{ marginTop: 2 }}>{timeParts.join(' · ')}</AppText>
        )}
        <AppText tone="secondary" style={{ marginTop: 2 }}>
          {[dur, c(`${plural(sets.length, 'set', 'sets')}`, `${sets.length} 組`)].filter(Boolean).join(' · ')}
        </AppText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md, marginTop: space.md }}>
          {w.participants.map((p) => (
            <View key={p} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
              <Avatar partnerId={p} name={profiles?.[p]?.name ?? p} size={28} />
              <AppText>{profiles?.[p]?.name ?? p}</AppText>
            </View>
          ))}
        </View>
      </Card>

      {sets.length > 0 && (
        <AppText variant="footnote" tone="secondary">
          {c('Tap a set to edit it, or add and remove exercises and sets below.', '點選任一組即可編輯，或在下方新增／移除動作與組數。')}
        </AppText>
      )}

      {analytics.map((item) => {
        const m = machines.find((x) => x.id === item.machineId);
        const ms = sets.filter((s) => s.machineId === item.machineId);
        const name = (m && machineName(m, store.language)) || ms[0]?.machineName || c('Exercise', '動作');
        const people = PARTNERS.filter((p) => ms.some((s) => s.userId === p));
        const exStart = formatClockTime(item.startedAt, store.language);
        const exEnd = formatClockTime(item.endedAt, store.language);
        const hasTiming = Boolean(exStart || item.avgSetSeconds !== undefined || item.avgBreakSeconds !== undefined);
        const isAddingSetHere = addSetMachineId === item.machineId;
        const unit = profiles?.[addSetPartner]?.unit ?? 'kg';

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
            <Card style={{ gap: space.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                {m?.photoUri ? (
                  <MachineImage source={{ uri: m.photoUri }} accessibilityIgnoresInvertColors style={{ width: 48, height: 48, borderRadius: radius.md, backgroundColor: colors.fill }} />
                ) : null}
                <View style={{ flex: 1, gap: 2 }}>
                  <AppText variant="headline">{name}</AppText>
                  {m && <AppText variant="footnote" tone="secondary">{MUSCLE_LABELS[store.language][m.muscleGroup]}</AppText>}
                </View>
                <IconButton
                  icon={{ ios: 'trash', android: 'delete' }}
                  label={c(`Remove ${name}`, `移除 ${name}`)}
                  onPress={() => confirmRemoveExercise(item.machineId, name)}
                  color={{ color: colors.danger, onColor: colors.surface, subtle: colors.dangerSubtle }}
                  size={36}
                  iconSize={16}
                />
              </View>

              {hasTiming && (
                <View style={[styles.timingBar, { backgroundColor: colors.fill }]}>
                  {exStart ? (
                    <View style={styles.timingCell}>
                      <AppText variant="caption" tone="secondary">{c('Time', '時間')}</AppText>
                      <AppText variant="number" style={{ fontSize: 14 }}>
                        {exEnd && exEnd !== exStart ? `${exStart} – ${exEnd}` : exStart}
                      </AppText>
                    </View>
                  ) : null}
                  {item.avgSetSeconds !== undefined ? (
                    <View style={styles.timingCell}>
                      <AppText variant="caption" tone="secondary">{c('Avg / set', '每組平均')}</AppText>
                      <AppText variant="number" style={{ fontSize: 14 }}>{formatShortDuration(item.avgSetSeconds)}</AppText>
                    </View>
                  ) : null}
                  {item.avgBreakSeconds !== undefined ? (
                    <View style={styles.timingCell}>
                      <AppText variant="caption" tone="secondary">{c('Avg break', '平均休息')}</AppText>
                      <AppText variant="number" style={{ fontSize: 14 }}>{formatShortDuration(item.avgBreakSeconds)}</AppText>
                    </View>
                  ) : null}
                </View>
              )}

              {people.map((p) => (
                <View key={p} style={{ gap: space.xs }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
                    <Icon name={{ ios: 'checkmark.circle.fill', android: 'check_circle' }} size={16} color={colors.partners?.[p]?.color} />
                    <AppText variant="subhead" style={{ fontWeight: '600' }} color={colors.partners?.[p]?.color}>{profiles?.[p]?.name ?? p}</AppText>
                  </View>
                  {ms
                    .filter((s) => s.userId === p)
                    .sort((a, b) => a.setNumber - b.setNumber)
                    .map((s) => (
                      <Pressable
                        key={s.id}
                        accessibilityRole="button"
                        accessibilityLabel={c(`Edit ${profiles?.[p]?.name ?? p}’s ${name}, set ${s.setNumber}: ${s.weight} ${s.unit}, ${s.reps} reps`, `編輯 ${profiles?.[p]?.name ?? p} 的${name}第 ${s.setNumber} 組：${s.weight} ${s.unit}，${s.reps} 次`)}
                        onPress={() => router.push('/edit-set/' + s.id)}
                        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: touch.min, borderRadius: radius.sm, backgroundColor: pressed ? colors.fill : 'transparent' })}
                      >
                        <AppText variant="number" tone="tertiary" style={{ width: 24 }}>{s.setNumber}</AppText>
                        <AppText variant="number">{s.weight} {s.unit} × {s.reps}</AppText>
                        {s.isPR && (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                            <Icon name={{ ios: 'crown.fill', android: 'workspace_premium' }} size={14} color={colors.gold} />
                            <AppText variant="caption" color={colors.gold} style={{ fontWeight: '700' }}>PR</AppText>
                          </View>
                        )}
                        <View style={{ flex: 1 }} />
                        <AppText variant="caption" tone="tertiary">{formatClockTime(s.loggedAt, store.language)}</AppText>
                        <Icon name={{ ios: 'pencil', android: 'edit' }} size={16} color={colors.textSecondary} />
                      </Pressable>
                    ))}
                </View>
              ))}

              {isAddingSetHere ? (
                <View style={[styles.addSetBox, { borderTopColor: colors.separator }]}>
                  <KeyboardDoneBar />
                  <SegmentedControl
                    accessibilityLabel={c('Partner', '夥伴')}
                    value={addSetPartner}
                    onChange={(p) => switchAddSetPartner(item.machineId, p)}
                    options={PARTNERS.map((pid) => ({ value: pid, label: profiles?.[pid]?.name ?? pid, tint: colors.partners?.[pid] }))}
                  />
                  <Stepper label={c('weight', '重量')} unitLabel={unit} text={addSetWeight} onChangeText={(t) => { setAddSetError(''); setAddSetWeight(t); }} step={unit === 'kg' ? 2.5 : 5} min={0} decimal />
                  <Stepper label={c('reps', '次數')} unitLabel={c('reps', '次')} text={addSetReps} onChangeText={(t) => { setAddSetError(''); setAddSetReps(t.replace(/[^0-9]/g, '')); }} step={1} min={1} />
                  {!!addSetError && <AppText variant="footnote" color={colors.danger} accessibilityLiveRegion="polite">{addSetError}</AppText>}
                  <View style={{ flexDirection: 'row', gap: space.sm }}>
                    <Button title={c('Cancel', '取消')} variant="tinted" size="small" onPress={() => setAddSetMachineId(null)} style={{ flex: 1 }} />
                    <Button title={c('Save set', '儲存這組')} size="small" tint={colors.partners?.[addSetPartner]} onPress={() => submitAddSet(item.machineId)} style={{ flex: 1 }} />
                  </View>
                </View>
              ) : (
                <Button
                  title={c('Add set', '新增一組')}
                  variant="tinted"
                  size="small"
                  tint={colors.partners?.[activeUser]}
                  icon={{ ios: 'plus', android: 'add' }}
                  onPress={() => openAddSet(item.machineId, activeUser)}
                />
              )}
            </Card>
          </React.Fragment>
        );
      })}

      <Button
        title={addingExercise ? c('Close exercise picker', '收起動作選擇') : c('Add exercise', '新增動作')}
        variant="tinted"
        tint={colors.partners?.[activeUser]}
        icon={{ ios: addingExercise ? 'xmark' : 'plus', android: addingExercise ? 'close' : 'add' }}
        onPress={() => setAddingExercise((v) => !v)}
      />

      {addingExercise && (
        <Card style={{ gap: space.md }}>
          <TextField label={c('Search machines', '搜尋器材')} placeholder={c('Machine name', '器材名稱')} value={query} onChangeText={setQuery} autoCorrect={false} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -space.lg }} contentContainerStyle={{ gap: space.sm, paddingHorizontal: space.lg }}>
            {MUSCLES.map((g) => (
              <Chip key={g} label={MUSCLE_LABELS[store.language][g]} selected={muscleFilter === g} onPress={() => setMuscleFilter(g)} />
            ))}
          </ScrollView>
          {filteredMachines.length === 0 ? (
            <AppText tone="secondary" style={{ textAlign: 'center', paddingVertical: space.md }}>
              {c('No matching machines.', '沒有符合的器材。')}
            </AppText>
          ) : (
            <View style={{ gap: space.xs }}>
              {filteredMachines.map((m) => {
                const already = machineIds.includes(m.id);
                const label = machineName(m, store.language);
                return (
                  <Pressable
                    key={m.id}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: already }}
                    disabled={already}
                    onPress={() => pickExerciseToAdd(m.id)}
                    style={({ pressed }) => [
                      styles.pickerRow,
                      { backgroundColor: pressed ? colors.fill : 'transparent', opacity: already ? 0.45 : 1 },
                    ]}
                  >
                    {m.photoUri ? <MachineImage source={{ uri: m.photoUri }} style={styles.pickerThumb} /> : null}
                    <View style={{ flex: 1 }}>
                      <AppText variant="subhead" style={{ fontWeight: '600' }} numberOfLines={1}>{label}</AppText>
                      <AppText variant="caption" tone="secondary">{MUSCLE_LABELS[store.language][m.muscleGroup]}</AppText>
                    </View>
                    <Icon
                      name={already ? { ios: 'checkmark.circle.fill', android: 'check_circle' } : { ios: 'plus.circle', android: 'add_circle_outline' }}
                      size={22}
                      color={already ? colors.success : colors.partners?.[activeUser]?.color}
                    />
                  </Pressable>
                );
              })}
            </View>
          )}
          <Button title={c('New machine', '新增器材')} variant="plain" size="small" icon={{ ios: 'plus', android: 'add' }} onPress={() => router.push('/new-machine')} />
        </Card>
      )}

      <Button title={c('Delete session', '刪除訓練')} variant="destructive" icon={{ ios: 'trash', android: 'delete' }} onPress={remove} />
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  transitionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.xs, paddingVertical: 2 },
  timingBar: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, padding: space.sm, borderRadius: radius.md },
  timingCell: { gap: 1, minWidth: 84 },
  addSetBox: { gap: space.md, paddingTop: space.md, borderTopWidth: StyleSheet.hairlineWidth },
  pickerRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: touch.min + 4, paddingVertical: space.xs, paddingHorizontal: space.xs, borderRadius: radius.md },
  pickerThumb: { width: 40, height: 40, borderRadius: radius.sm },
});
