import React, { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { AppText, Card, Chip, EmptyState, SegmentedControl } from '../../ui/primitives';
import { gutter, space, useTheme } from '../../theme/theme';
import { useGymCrushStore } from '../../store/useGymCrushStore';
import { plural, useCopy } from '../../i18n/useCopy';
import { exerciseProgress } from '../../services/workoutHistory';
import { PartnerId } from '../../types/gym';
import { ProgressChart } from './ProgressChart';

type Metric = 'weight' | 'reps';

export function ProgressView() {
  const store = useGymCrushStore();
  const { colors } = useTheme();
  const c = useCopy();
  const zh = store.language === 'zh-TW';
  const [person, setPerson] = useState<PartnerId>(store.activeUser);
  const [metric, setMetric] = useState<Metric>('weight');
  const [exercise, setExercise] = useState<string | null>(null);
  const unit = store.profiles[person].unit;
  const tint = colors.partners[person];

  const exercises = useMemo(() => {
    const done = new Set(store.completedWorkouts.map((w) => w.id));
    const ids = new Set(store.sets.filter((s) => s.userId === person && done.has(s.workoutId)).map((s) => s.machineId));
    return store.machines.filter((m) => ids.has(m.id)).map((m) => ({ id: m.id, name: (zh ? m.nameZh : m.name) || m.name }));
  }, [store.sets, store.completedWorkouts, store.machines, person, zh]);
  const selected = exercises.find((e) => e.id === exercise) ?? exercises[0];
  const points = useMemo(
    () => (selected ? exerciseProgress(store.sets, store.completedWorkouts, selected.id, person, unit).map((p) => ({ t: Date.parse(p.date), v: metric === 'weight' ? Math.round(p.maxWeight * 10) / 10 : p.maxReps })) : []),
    [store.sets, store.completedWorkouts, selected, person, unit, metric],
  );
  const fmt = (v: number) => (metric === 'weight' ? `${v} ${unit}` : `${v}`);
  const first = points[0]?.v, latest = points[points.length - 1]?.v;
  const change = points.length ? latest - first : 0;
  const best = points.length ? Math.max(...points.map((p) => p.v)) : 0;
  const signed = (n: number) => `${n > 0 ? '+' : ''}${Math.round(n * 10) / 10}${metric === 'weight' ? ` ${unit}` : ''}`;
  const metricName = metric === 'weight' ? c('Heaviest weight', '最大重量') : c('Most reps', '最多次數');

  return (
    <View style={{ gap: space.lg }}>
      <SegmentedControl
        accessibilityLabel={c('Partner', '夥伴')} value={person} onChange={(p) => { setPerson(p); setExercise(null); }}
        options={(['markus', 'partner'] as PartnerId[]).map((p) => ({ value: p, label: store.profiles[p].name, tint: colors.partners[p] }))}
      />
      {!selected ? (
        <EmptyState icon={{ ios: 'chart.line.uptrend.xyaxis', android: 'show_chart' }} title={c('No progress yet', '還沒有進步紀錄')} body={c('Finish a workout and your lifts will be charted here.', '完成一次訓練後，這裡會顯示你的進步。')} />
      ) : (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm, paddingHorizontal: gutter }} style={{ flexGrow: 0, marginHorizontal: -gutter }}>
            {exercises.map((e) => <Chip key={e.id} label={e.name} selected={e.id === selected.id} onPress={() => setExercise(e.id)} />)}
          </ScrollView>
          <SegmentedControl
            accessibilityLabel={c('Metric', '指標')} value={metric} onChange={setMetric}
            options={[{ value: 'weight', label: c('Heaviest weight', '最大重量') }, { value: 'reps', label: c('Most reps', '最多次數') }]}
          />
          <Card>
            <AppText variant="headline">{selected.name}</AppText>
            <AppText variant="footnote" tone="secondary" style={{ marginBottom: space.md }}>{metricName}</AppText>
            <ProgressChart
              points={points} color={tint.color} format={fmt}
              accessibilityLabel={c(
                `${selected.name}, ${metricName}: ${plural(points.length, 'workout', 'workouts')}, from ${fmt(first)} to ${fmt(latest)}, change ${signed(change)}.`,
                `${selected.name}，${metricName}：共 ${points.length} 次訓練，從 ${fmt(first)} 到 ${fmt(latest)}，變化 ${signed(change)}。`,
              )}
            />
            <AppText variant="footnote" tone="secondary" style={{ marginTop: space.sm }}>
              {points.length > 1 ? `${fmt(first)} → ${fmt(latest)}` : c('One workout so far', '目前只有一次訓練')}
            </AppText>
          </Card>
          <View style={{ flexDirection: 'row', gap: space.md }}>
            {[[c('Best', '最佳'), fmt(best)], [c('Last', '最近'), fmt(latest)], [c('Change', '變化'), points.length > 1 ? signed(change) : '–']].map(([label, value]) => (
              <Card key={label} style={{ flex: 1 }}>
                <AppText variant="caption" tone="secondary">{label}</AppText>
                <AppText variant="number" adjustsFontSizeToFit numberOfLines={1}>{value}</AppText>
              </Card>
            ))}
          </View>
        </>
      )}
    </View>
  );
}
