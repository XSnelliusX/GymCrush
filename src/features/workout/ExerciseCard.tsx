import React, { useState } from 'react';
import { ActionSheetIOS, Alert, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useGymCrushStore } from '../../store/useGymCrushStore';
import { MachineImage } from '../../components/MachineImage';
import { MUSCLE_LABELS } from '../../i18n/translations';
import { useCopy } from '../../i18n/useCopy';
import { radius, space, touch, useTheme } from '../../theme/theme';
import { AppText, Button, Card, Icon, IconButton } from '../../ui/primitives';
import { GymMachine, PartnerId, WorkoutSetLog } from '../../types/gym';
import { adjustmentSummary, defaultDraft, formatWeight, machineName, previousSet } from './workoutHelpers';
import { ExerciseTimingAnalytics, formatClockTime, formatShortDuration } from './exerciseTiming';
import { KeyboardDoneBar, Stepper } from './Stepper';

type Draft = { weight: string; reps: string };

/** One exercise in the session. Only the focused card (`focused`) shows the next-set input, keeping one filled button on screen. */
export function ExerciseCard({ machine, sessionSets, workoutId, focused, timing }: {
  machine: GymMachine; sessionSets: WorkoutSetLog[]; workoutId: string | null; focused: boolean; timing?: ExerciseTimingAnalytics;
}) {
  const store = useGymCrushStore();
  const router = useRouter();
  const { colors } = useTheme();
  const c = useCopy();
  const lang = store.language;
  const me = store.activeUser;
  const unit = store.profiles[me].unit;
  const user = colors.partners[me];
  const name = machineName(machine, lang);
  const sets = sessionSets.filter((s) => s.machineId === machine.id);
  const nextNumber = sets.filter((s) => s.userId === me).length + 1;

  // Drafts per partner so switching "Logging as" keeps each person's numbers.
  const [drafts, setDrafts] = useState<Partial<Record<PartnerId, Draft>>>({});
  const [error, setError] = useState('');
  const base = defaultDraft(machine, me, unit, sessionSets);
  const draft = drafts[me] ?? { weight: formatWeight(base.weight), reps: String(base.reps) };
  const setDraft = (patch: Partial<Draft>) => { setError(''); setDrafts((d) => ({ ...d, [me]: { ...draft, ...patch } })); };
  const prevForNext = previousSet(store.sets, machine.id, me, nextNumber, workoutId);

  const complete = () => {
    const weight = Number(draft.weight.replace(',', '.'));
    const reps = Number(draft.reps);
    if (!draft.weight.trim() || !Number.isFinite(weight) || weight < 0 || !Number.isSafeInteger(reps) || reps < 1) {
      setError(c('Enter a weight (zero is fine) and whole reps.', '請輸入重量（可為 0）與整數次數。'));
      return;
    }
    if (store.selectedMachineId !== machine.id) store.setSelectedMachineId(machine.id);
    // The store fires the medium / PR success haptic and starts the rest timer.
    store.logSet(weight, reps, machine.id);
    setDrafts((d) => ({ ...d, [me]: undefined }));
  };

  const remove = () => Alert.alert(
    c(`Remove ${name}?`, `移除「${name}」？`),
    c('Logged sets stay in your history.', '已記錄的組數會保留在紀錄中。'),
    [
      { text: c('Cancel', '取消'), style: 'cancel' },
      { text: c('Remove', '移除'), style: 'destructive', onPress: () => store.removeMachineFromSession(machine.id) },
    ],
  );

  const openMenu = () => {
    const settingsTitle = c('Machine settings', '器材設定');
    const removeTitle = c('Remove from workout', '從訓練移除');
    const openSettings = () => router.push({ pathname: '/machine-settings/[id]', params: { id: machine.id } });
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { title: name, options: [settingsTitle, removeTitle, c('Cancel', '取消')], destructiveButtonIndex: 1, cancelButtonIndex: 2 },
        (i) => { if (i === 0) openSettings(); else if (i === 1) remove(); },
      );
    } else {
      Alert.alert(name, undefined, [
        { text: settingsTitle, onPress: openSettings },
        { text: removeTitle, style: 'destructive', onPress: remove },
        { text: c('Cancel', '取消'), style: 'cancel' },
      ]);
    }
  };

  const settings = adjustmentSummary(machine, me);
  const startClock = formatClockTime(timing?.startedAt, lang);
  const endClock = sets.length > 0 ? formatClockTime(timing?.endedAt, lang) : '';
  const timingSummary = [
    startClock ? (endClock && endClock !== startClock ? `${startClock} – ${endClock}` : `${c('Started', '開始')} ${startClock}`) : null,
    timing?.avgSetSeconds !== undefined ? `${c('Avg/set', '每組平均')} ${formatShortDuration(timing.avgSetSeconds)}` : null,
    timing?.avgBreakSeconds !== undefined ? `${c('Avg break', '平均休息')} ${formatShortDuration(timing.avgBreakSeconds)}` : null,
  ].filter(Boolean);

  return (
    <Card style={{ borderWidth: 2, borderColor: focused ? user.color : 'transparent' }}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={name}
          accessibilityHint={focused ? undefined : c('Log the next set here', '在這裡記錄下一組')}
          accessibilityState={{ selected: focused }}
          onPress={() => store.setSelectedMachineId(machine.id)}
          style={styles.identity}
        >
          <View style={[styles.thumb, { backgroundColor: colors.fill }]}>
            {machine.photoUri ? (
              <MachineImage source={{ uri: machine.photoUri }} style={styles.thumb} resizeMode="cover" accessibilityIgnoresInvertColors />
            ) : <Icon name={{ ios: 'dumbbell', android: 'fitness_center' }} size={22} color={colors.textSecondary} />}
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <AppText variant="headline" numberOfLines={2}>{name}</AppText>
            <AppText variant="footnote" tone="secondary">{MUSCLE_LABELS[lang][machine.muscleGroup]}</AppText>
          </View>
        </Pressable>
        <IconButton icon={{ ios: 'ellipsis', android: 'more_vert' }} label={c(`More options for ${name}`, `「${name}」更多選項`)} onPress={openMenu} />
      </View>

      <View style={styles.chipRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={settings || c('Add settings', '新增設定')}
          onPress={() => router.push({ pathname: '/machine-settings/[id]', params: { id: machine.id } })}
          android_ripple={{ color: colors.separator }}
          style={[styles.settingsChip, { backgroundColor: colors.fill }]}
        >
          <Icon name={{ ios: 'slider.horizontal.3', android: 'tune' }} size={14} color={colors.text} />
          <AppText variant="subhead" numberOfLines={1} style={{ flexShrink: 1, fontWeight: '500' }}>{settings || c('Add settings', '新增設定')}</AppText>
        </Pressable>
      </View>

      {timingSummary.length > 0 && (
        <AppText variant="caption" tone="secondary" style={{ marginTop: space.sm }}>
          {timingSummary.join(' · ')}
        </AppText>
      )}

      {sets.length > 0 && (
        <View style={{ marginTop: space.md }}>
          <View style={[styles.setRow, styles.tableHead]} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
            <AppText variant="caption" tone="secondary" style={styles.colSet}>{c('Set', '組')}</AppText>
            <AppText variant="caption" tone="secondary" style={styles.colPrev}>{c('Previous', '上次')}</AppText>
            <AppText variant="caption" tone="secondary" style={styles.colValue}>{c('Weight × reps', '重量 × 次數')}</AppText>
          </View>
          {sets.map((s) => <SetRow key={s.id} set={s} workoutId={workoutId} />)}
        </View>
      )}

      {focused ? (
        <View style={{ marginTop: space.lg, gap: space.md }}>
          <KeyboardDoneBar />
          <View style={styles.nextHead}>
            <AppText variant="subhead" style={{ fontWeight: '600' }}>{c(`Set ${nextNumber}`, `第 ${nextNumber} 組`)} · {store.profiles[me].name}</AppText>
            {prevForNext && (
              <AppText variant="footnote" tone="tertiary">
                {c('Previous', '上次')} {formatWeight(prevForNext.weight)} {prevForNext.unit} × {prevForNext.reps}
              </AppText>
            )}
          </View>
          <Stepper label={c('weight', '重量')} unitLabel={unit} text={draft.weight} onChangeText={(weight) => setDraft({ weight })} step={unit === 'kg' ? 2.5 : 5} min={0} decimal placeholder={prevForNext ? formatWeight(prevForNext.weight) : undefined} />
          <Stepper label={c('reps', '次數')} unitLabel={c('reps', '次')} text={draft.reps} onChangeText={(reps) => setDraft({ reps: reps.replace(/[^0-9]/g, '') })} step={1} min={1} placeholder={prevForNext ? String(prevForNext.reps) : undefined} />
          {!!error && <AppText variant="footnote" color={colors.danger} accessibilityLiveRegion="polite">{error}</AppText>}
          <Button
            title={c('Complete set', '完成這組')}
            icon={{ ios: 'checkmark', android: 'check' }}
            size="large"
            tint={user}
            haptic={false}
            onPress={complete}
            accessibilityHint={c(`Logs ${draft.weight} ${unit} × ${draft.reps} for ${store.profiles[me].name}`, `為 ${store.profiles[me].name} 記錄 ${draft.weight} ${unit} × ${draft.reps}`)}
          />
        </View>
      ) : (
        <Button
          title={c('Log next set', '記錄下一組')}
          variant="tinted"
          tint={user}
          style={{ marginTop: space.md }}
          onPress={() => store.setSelectedMachineId(machine.id)}
        />
      )}
    </Card>
  );
}

function SetRow({ set, workoutId }: { set: WorkoutSetLog; workoutId: string | null }) {
  const store = useGymCrushStore();
  const router = useRouter();
  const { colors } = useTheme();
  const c = useCopy();
  const owner = colors.partners[set.userId];
  const ownerName = store.profiles[set.userId].name;
  const isPR = set.isPR; // store is the single PR source (banners, sync, history use it too)
  const prev = previousSet(store.sets, set.machineId, set.userId, set.setNumber, workoutId);
  const prevText = prev ? `${formatWeight(prev.weight)} × ${prev.reps}` : '—';
  const label = [
    c(`Set ${set.setNumber}`, `第 ${set.setNumber} 組`), ownerName,
    `${formatWeight(set.weight)} ${set.unit} × ${set.reps}`,
    isPR ? c('Personal record', '個人紀錄') : null,
    prev ? `${c('Previous', '上次')} ${prevText}` : null,
  ].filter(Boolean).join(', ');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={c('Edit or delete this set', '編輯或刪除這組')}
      onPress={() => router.push({ pathname: '/edit-set/[id]', params: { id: set.id } })}
      android_ripple={{ color: colors.fill, foreground: true }}
      style={({ pressed }) => [styles.setRow, { borderTopColor: colors.separator }, pressed && { backgroundColor: colors.fill }]}
    >
      <AppText variant="number" style={styles.colSet}>{set.setNumber}</AppText>
      <AppText variant="number" tone="tertiary" style={[styles.colPrev, { fontWeight: '400' }]} numberOfLines={1}>{prevText}</AppText>
      <View style={[styles.valueCell, styles.colValue]}>
        <AppText variant="number">{formatWeight(set.weight)} <AppText variant="footnote" tone="secondary">{set.unit}</AppText> × {set.reps}</AppText>
        {isPR && (
          <View style={[styles.pr, { backgroundColor: colors.goldSubtle }]}>
            <Icon name={{ ios: 'crown.fill', android: 'workspace_premium' }} size={12} color={colors.gold} />
            <AppText variant="caption" color={colors.gold} style={{ fontWeight: '700' }}>PR</AppText>
          </View>
        )}
      </View>
      <AppText variant="caption" tone="tertiary">{formatClockTime(set.loggedAt, store.language)}</AppText>
      <Icon name={{ ios: 'checkmark.circle.fill', android: 'check_circle' }} size={22} color={owner.color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  identity: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: touch.min },
  thumb: { width: 48, height: 48, borderRadius: radius.md, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  chipRow: { flexDirection: 'row', marginTop: space.md },
  settingsChip: { flexDirection: 'row', alignItems: 'center', gap: space.xs, maxWidth: '100%', minHeight: touch.min - 8, paddingHorizontal: space.md, borderRadius: radius.pill, overflow: 'hidden' },
  tableHead: { minHeight: 24 },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: touch.min, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'transparent' },
  colSet: { width: 44 },
  colPrev: { flex: 1.1, minWidth: 0 },
  colValue: { flex: 1.3, minWidth: 0 },
  valueCell: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space.sm },
  pr: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: space.xs + 2, paddingVertical: 1, borderRadius: radius.pill },
  nextHead: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: space.sm },
});
