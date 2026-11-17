import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { TabScreen } from '../../../src/components/TabScreen';
import { Avatar, AppText, EmptyState, Icon, ListRow, ListSection, ScreenScroll, SegmentedControl } from '../../../src/ui/primitives';
import { space, useTheme } from '../../../src/theme/theme';
import { useGymCrushStore } from '../../../src/store/useGymCrushStore';
import { plural, useCopy } from '../../../src/i18n/useCopy';
import { workoutDuration } from '../../../src/services/workoutHistory';
import { formatDuration, groupByWeek } from '../../../src/features/history/helpers';
import { ProgressView } from '../../../src/features/history/ProgressView';

export default function HistoryScreen() {
  const store = useGymCrushStore();
  const { colors } = useTheme();
  const router = useRouter();
  const c = useCopy();
  const locale = store.language === 'zh-TW' ? 'zh-TW' : 'en';
  const [tab, setTab] = useState<'workouts' | 'progress'>('workouts');
  const groups = useMemo(
    () => groupByWeek(store.completedWorkouts, new Date(), (kind, start) =>
      kind === 'this' ? c('This week', '本週') : kind === 'last' ? c('Last week', '上週') : c('Week of ', '週起 ') + start.toLocaleDateString(locale, { month: 'short', day: 'numeric' })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store.completedWorkouts, store.language],
  );

  return (
    <TabScreen>
      <Stack.Screen options={{ title: c('History', '紀錄') }} />
      <ScreenScroll>
        <SegmentedControl
          accessibilityLabel={c('History view', '紀錄檢視')} value={tab} onChange={setTab} style={{ marginBottom: space.lg }}
          options={[{ value: 'workouts', label: c('Workouts', '訓練') }, { value: 'progress', label: c('Progress', '進步') }]}
        />
        {tab === 'progress' ? <ProgressView /> : !groups.length ? (
          <EmptyState
            icon={{ ios: 'figure.strengthtraining.traditional', android: 'fitness_center' }}
            title={c('Your story starts here', '從這裡開始你們的故事')} body={c('Finished workouts show up here.', '完成的訓練會顯示在這裡。')}
            action={{ title: c('Start workout', '開始訓練'), onPress: () => { store.startSession(); router.push('/workout'); } }}
          />
        ) : groups.map((g) => (
          <ListSection key={g.key} header={g.title}>
            {g.items.map((w) => {
              const sets = store.sets.filter((s) => s.workoutId === w.id);
              const prs = sets.filter((s) => s.isPR).length;
              const dur = formatDuration(workoutDuration(w));
              const meta = [new Date(w.finishedAt).toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric' }), dur, c(`${plural(sets.length, 'set', 'sets')}`, `${sets.length} 組`)].filter(Boolean).join(' · ');
              const title = w.title || c('Workout', '訓練');
              return (
                <ListRow
                  key={w.id} title={title} subtitle={meta} onPress={() => router.push('/history/' + w.id)}
                  accessibilityHint={c('View, edit, or delete this session', '檢視、編輯或刪除這次訓練')}
                  accessory={
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                      {prs > 0 && (
                        <View accessible accessibilityLabel={c(`${prs} personal records`, `${prs} 項個人紀錄`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                          <Icon name={{ ios: 'crown.fill', android: 'workspace_premium' }} size={14} color={colors.gold} />
                          <AppText variant="number" color={colors.gold}>{prs}</AppText>
                        </View>
                      )}
                      <View style={{ flexDirection: 'row' }}>
                        {w.participants.map((p, i) => <View key={p} style={{ marginLeft: i ? -8 : 0 }}><Avatar partnerId={p} name={store.profiles[p].name} size={24} /></View>)}
                      </View>
                      <Icon name={{ ios: 'chevron.right', android: 'chevron_right' }} size={14} color={colors.textTertiary} />
                    </View>
                  }
                />
              );
            })}
          </ListSection>
        ))}
      </ScreenScroll>
    </TabScreen>
  );
}
