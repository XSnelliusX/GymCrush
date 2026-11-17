import React, { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGymCrushStore } from '../../src/store/useGymCrushStore';
import { useCopy } from '../../src/i18n/useCopy';
import { gutter, space, useTheme } from '../../src/theme/theme';
import { AppText, Button, EmptyState, haptics, SheetHeader } from '../../src/ui/primitives';
import { KeyboardAwareScrollView } from '../../src/ui/keyboard';
import { KeyboardDoneBar, Stepper } from '../../src/features/workout/Stepper';
import { formatWeight, machineName } from '../../src/features/workout/workoutHelpers';

export default function EditSetSheet() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const store = useGymCrushStore();
  const router = useRouter();
  const { colors } = useTheme();
  const c = useCopy();
  const insets = useSafeAreaInsets();
  const set = store.sets.find((s) => s.id === id);
  const [weight, setWeight] = useState(set ? formatWeight(set.weight) : '');
  const [reps, setReps] = useState(set ? String(set.reps) : '');
  const [error, setError] = useState('');
  const close = () => router.back();

  if (!set) {
    return (
      <>
        <View collapsable={false} style={{ backgroundColor: colors.bg }}>
          <SheetHeader title={c('Edit set', '編輯組數')} onClose={close} closeLabel={c('Close', '關閉')} />
        </View>
        <KeyboardAwareScrollView style={{ backgroundColor: colors.bg }}>
          <EmptyState icon={{ ios: 'questionmark.circle', android: 'help' }} title={c('This set was removed', '這組已被刪除')} action={{ title: c('Close', '關閉'), onPress: close }} />
        </KeyboardAwareScrollView>
      </>
    );
  }

  const owner = store.profiles[set.userId];
  // Active workout sets are editable by the active user; completed workout sets can be edited for either partner.
  const inCompletedWorkout = store.completedWorkouts.some((w) => w.id === set.workoutId);
  const canEdit = set.userId === store.activeUser || inCompletedWorkout;
  const tint = colors.partners[set.userId];

  const save = () => {
    const w = Number(weight.replace(',', '.'));
    const r = Number(reps);
    if (!weight.trim() || !Number.isFinite(w) || w < 0 || !Number.isSafeInteger(r) || r < 1) {
      setError(c('Enter a weight (zero is fine) and whole reps.', '請輸入重量（可為 0）與整數次數。'));
      return;
    }
    store.changeSet(set.id, { weight: Number(w.toFixed(2)), reps: r });
    close();
  };

  const remove = () => Alert.alert(
    c('Delete this set?', '刪除這組？'),
    c('This can’t be undone.', '刪除後無法復原。'),
    [
      { text: c('Cancel', '取消'), style: 'cancel' },
      { text: c('Delete set', '刪除這組'), style: 'destructive', onPress: () => { haptics.warning(); store.changeSet(set.id, null); close(); } },
    ],
  );

  // react-native-screens form sheets lay out exactly [header (collapsable={false}), ScrollView].
  return (
    <>
      <View collapsable={false} style={{ backgroundColor: colors.bg }}>
        <SheetHeader
          title={c(`Edit set ${set.setNumber}`, `編輯第 ${set.setNumber} 組`)}
          onClose={close}
          closeLabel={c('Close', '關閉')}
          action={canEdit ? { label: c('Save', '儲存'), onPress: save, tint } : undefined}
        />
      </View>
      <KeyboardAwareScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={[styles.body, { paddingBottom: Math.max(insets.bottom, space.lg) + space.lg }]}>
        <KeyboardDoneBar />
        <AppText variant="subhead" tone="secondary">
          <AppText variant="subhead" color={tint.color} style={{ fontWeight: '600' }}>{owner.name}</AppText>
          {' · '}{machineName(store.machines.find((m) => m.id === set.machineId), store.language) || set.machineName}
        </AppText>
        {canEdit ? (
          <>
            <Stepper label={c('weight', '重量')} unitLabel={set.unit} text={weight} onChangeText={(t) => { setError(''); setWeight(t); }} step={set.unit === 'kg' ? 2.5 : 5} min={0} decimal />
            <Stepper label={c('reps', '次數')} unitLabel={c('reps', '次')} text={reps} onChangeText={(t) => { setError(''); setReps(t.replace(/[^0-9]/g, '')); }} step={1} min={1} />
            {!!error && <AppText variant="footnote" color={colors.danger} accessibilityLiveRegion="polite">{error}</AppText>}
            <Button title={c('Delete set', '刪除這組')} variant="destructive" icon={{ ios: 'trash', android: 'delete' }} onPress={remove} />
          </>
        ) : (
          <>
            <AppText variant="metric">{formatWeight(set.weight)} {set.unit} × {set.reps}</AppText>
            <AppText tone="secondary">{c(`Switch “Logging as” to ${owner.name} to edit this set.`, `請將「記錄者」切換為 ${owner.name} 才能編輯這組。`)}</AppText>
            <Button title={c(`Log as ${owner.name}`, `切換為 ${owner.name}`)} variant="tinted" tint={tint} onPress={() => store.switchActiveUser(set.userId)} />
          </>
        )}
      </KeyboardAwareScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: gutter, gap: space.lg },
});
