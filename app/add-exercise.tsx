import React, { useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGymCrushStore } from '../src/store/useGymCrushStore';
import { MUSCLE_LABELS } from '../src/i18n/translations';
import { useCopy } from '../src/i18n/useCopy';
import { gutter, radius, space, useTheme } from '../src/theme/theme';
import { AppText, Button, Chip, EmptyState, Icon, SheetHeader, TextField } from '../src/ui/primitives';
import { KeyboardAwareScrollView } from '../src/ui/keyboard';
import { MachineImage } from '../src/components/MachineImage';
import { MuscleGroup } from '../src/types/gym';
import { machineName } from '../src/features/workout/workoutHelpers';

const MUSCLES: (MuscleGroup | 'All')[] = ['All', 'Chest', 'Back', 'Legs', 'Glutes', 'Shoulders', 'Arms', 'Core', 'Full Body'];

export default function AddExerciseSheet() {
  const store = useGymCrushStore();
  const router = useRouter();
  const { colors } = useTheme();
  const c = useCopy();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState<MuscleGroup | 'All'>('All');
  const lang = store.language;

  const q = query.trim().toLowerCase();
  const machines = store.machines.filter((m) =>
    (muscle === 'All' || m.muscleGroup === muscle) &&
    (!q || m.name.toLowerCase().includes(q) || (m.nameZh ?? '').toLowerCase().includes(q)));

  const pick = (id: string) => {
    store.addMachineToSession(id);
    store.setSelectedMachineId(id);
    router.back();
  };

  const tileWidth = (width - gutter * 2 - space.md) / 2;
  const tile = (m: (typeof machines)[number]) => {
    const added = store.sessionMachineIds.includes(m.id);
    const name = machineName(m, lang);
    return (
      <Pressable
        key={m.id}
        accessibilityRole="button"
        accessibilityLabel={`${name}, ${MUSCLE_LABELS[lang][m.muscleGroup]}`}
        accessibilityHint={added ? c('Already in this workout', '已在本次訓練中') : c('Adds to this workout', '加入本次訓練')}
        accessibilityState={{ disabled: added, selected: added }}
        disabled={added}
        onPress={() => pick(m.id)}
        android_ripple={{ color: colors.fill, foreground: true }}
        style={({ pressed }) => [styles.tile, { width: tileWidth, backgroundColor: colors.surface, opacity: added ? 0.55 : pressed ? 0.7 : 1 }]}
      >
        <View style={[styles.photo, { backgroundColor: colors.fill }]}>
          {m.photoUri ? <MachineImage source={{ uri: m.photoUri }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : <Icon name={{ ios: 'dumbbell', android: 'fitness_center' }} size={28} color={colors.textSecondary} />}
          {added && (
            <View style={[styles.check, { backgroundColor: colors.success }]}>
              <Icon name={{ ios: 'checkmark', android: 'check' }} size={14} color={colors.surface} />
            </View>
          )}
        </View>
        <View style={{ padding: space.md, gap: 2 }}>
          <AppText variant="subhead" style={{ fontWeight: '600' }} numberOfLines={2}>{name}</AppText>
          <AppText variant="caption" tone="secondary">{added ? c('Added', '已加入') : MUSCLE_LABELS[lang][m.muscleGroup]}</AppText>
        </View>
      </Pressable>
    );
  };

  // react-native-screens form sheets lay out exactly [header (collapsable={false}), ScrollView]; any other shape renders blank or overlapped on iOS 26+.
  return (
    <>
      <View collapsable={false} style={{ backgroundColor: colors.bg }}>
        <SheetHeader title={c('Add exercise', '新增動作')} onClose={() => router.back()} closeLabel={c('Close', '關閉')} />
        <View style={{ paddingHorizontal: gutter }}>
          <TextField label={c('Search', '搜尋')} value={query} onChangeText={setQuery} placeholder={c('Machine name', '器材名稱')} returnKeyType="search" autoCorrect={false} clearButtonMode="while-editing" />
        </View>
        <View style={styles.chips}>
          {MUSCLES.map((g) => <Chip key={g} label={MUSCLE_LABELS[lang][g]} selected={muscle === g} onPress={() => setMuscle(g)} />)}
        </View>
      </View>
      <KeyboardAwareScrollView style={{ backgroundColor: colors.bg }} keyboardDismissMode="on-drag" contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, space.lg) + space.lg }}>
        {machines.length === 0 ? (
          <EmptyState
            icon={{ ios: 'magnifyingglass', android: 'search' }}
            title={c('No machines found', '找不到器材')}
            action={{ title: c('New machine', '新增器材'), onPress: () => router.push('/new-machine') }}
          />
        ) : (
          <View style={styles.grid}>{machines.map(tile)}</View>
        )}
        {machines.length > 0 && (
          <Button title={c('New machine', '新增器材')} variant="plain" icon={{ ios: 'plus', android: 'add' }} onPress={() => router.push('/new-machine')} style={{ marginTop: space.lg, alignSelf: 'center' }} />
        )}
      </KeyboardAwareScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, paddingHorizontal: gutter, paddingVertical: space.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, paddingHorizontal: gutter },
  tile: { borderRadius: radius.lg, overflow: 'hidden' },
  photo: { aspectRatio: 4 / 3, alignItems: 'center', justifyContent: 'center' },
  check: { position: 'absolute', top: space.sm, right: space.sm, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
