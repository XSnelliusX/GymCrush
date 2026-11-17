import React from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGymCrushStore } from '../src/store/useGymCrushStore';
import { plural, useCopy } from '../src/i18n/useCopy';
import { gutter, space, useTheme } from '../src/theme/theme';
import { AppText, Button, Card, Icon } from '../src/ui/primitives';
import { DuoRings } from '../src/ui/DuoRings';
import { formatTime } from '../src/components/RestTimerBar';
import { PartnerId } from '../src/types/gym';
import { formatWeight, machineName } from '../src/features/workout/workoutHelpers';

const PARTNERS: PartnerId[] = ['markus', 'partner'];

export default function WorkoutSummaryScreen() {
  const store = useGymCrushStore();
  const router = useRouter();
  const { colors } = useTheme();
  const c = useCopy();
  const insets = useSafeAreaInsets();

  const workout = store.completedWorkouts.at(-1);
  const sets = workout ? store.sets.filter((s) => s.workoutId === workout.id) : [];
  const prs = sets.filter((s) => s.isPR);
  const done = () => (router.canDismiss() ? router.dismissAll() : router.replace('/today'));

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: (Platform.OS === 'ios' ? 0 : insets.top) + space.xxl }]}>
        <View style={styles.hero}>
          <Icon name={{ ios: 'checkmark.seal.fill', android: 'verified' }} size={44} color={colors.success} />
          <AppText variant="title1" accessibilityRole="header" style={{ textAlign: 'center' }}>{c('Workout complete', '訓練完成')}</AppText>
          {workout?.durationSeconds !== undefined && (
            <AppText variant="number" tone="secondary" accessibilityLabel={c(`Duration ${formatTime(workout.durationSeconds)}`, `時間 ${formatTime(workout.durationSeconds)}`)}>
              {workout.title ? `${workout.title} · ` : ''}{formatTime(workout.durationSeconds, true)}
            </AppText>
          )}
        </View>

        <View style={styles.row}>
          {PARTNERS.map((pid) => {
            const n = sets.filter((s) => s.userId === pid).length;
            return (
              <Card key={pid} style={{ flex: 1 }}>
                <View accessible accessibilityLabel={c(`${store.profiles[pid].name}: ${plural(n, 'set', 'sets')}`, `${store.profiles[pid].name}：${n} 組`)}>
                  <AppText variant="subhead" color={colors.partners[pid].color} style={{ fontWeight: '600' }} numberOfLines={1}>{store.profiles[pid].name}</AppText>
                  <AppText variant="metric">{n}</AppText>
                  <AppText variant="footnote" tone="secondary">{c('sets', '組')}</AppText>
                </View>
              </Card>
            );
          })}
        </View>

        {prs.length > 0 && (
          <Card style={{ gap: space.sm }}>
            <AppText variant="headline">{c('Personal records', '個人紀錄')}</AppText>
            {prs.map((s) => (
              <View key={s.id} style={styles.prRow} accessible accessibilityLabel={`PR, ${store.profiles[s.userId].name}, ${machineName(store.machines.find((m) => m.id === s.machineId), store.language) || s.machineName}, ${formatWeight(s.weight)} ${s.unit} × ${s.reps}`}>
                <Icon name={{ ios: 'crown.fill', android: 'workspace_premium' }} size={18} color={colors.gold} />
                <AppText variant="caption" color={colors.gold} style={{ fontWeight: '700' }}>PR</AppText>
                <AppText variant="subhead" style={{ flex: 1 }} numberOfLines={2}>
                  <AppText variant="subhead" color={colors.partners[s.userId].color} style={{ fontWeight: '600' }}>{store.profiles[s.userId].name}</AppText>
                  {' · '}{machineName(store.machines.find((m) => m.id === s.machineId), store.language) || s.machineName}
                </AppText>
                <AppText variant="number">{formatWeight(s.weight)} {s.unit} × {s.reps}</AppText>
              </View>
            ))}
          </Card>
        )}

        <Card style={styles.week}>
          <DuoRings
            size={128}
            stroke={12}
            rings={PARTNERS.map((pid) => ({ progress: store.profiles[pid].completedThisWeek / Math.max(1, store.profiles[pid].weeklyGoal), color: colors.partners[pid].color }))}
            accessibilityLabel={PARTNERS.map((pid) => c(`${store.profiles[pid].name} ${store.profiles[pid].completedThisWeek} of ${plural(store.profiles[pid].weeklyGoal, 'workout', 'workouts')} this week`, `${store.profiles[pid].name} 本週 ${store.profiles[pid].completedThisWeek}/${store.profiles[pid].weeklyGoal} 次`)).join(', ')}
          >
            <AppText variant="metric">{store.streak.currentStreakWeeks}</AppText>
          </DuoRings>
          <View style={{ flex: 1, gap: space.xs }}>
            <AppText variant="headline">{c(`${store.streak.currentStreakWeeks}-week streak`, `連續 ${store.streak.currentStreakWeeks} 週`)}</AppText>
            {PARTNERS.map((pid) => (
              <AppText key={pid} variant="subhead" tone="secondary">
                <AppText variant="subhead" color={colors.partners[pid].color} style={{ fontWeight: '600' }}>{store.profiles[pid].name}</AppText>
                {c(` ${store.profiles[pid].completedThisWeek}/${store.profiles[pid].weeklyGoal} this week`, ` 本週 ${store.profiles[pid].completedThisWeek}/${store.profiles[pid].weeklyGoal}`)}
              </AppText>
            ))}
          </View>
        </Card>
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, space.lg) }]}>
        <Button title={c('Done', '完成')} size="large" tint={colors.partners[store.activeUser]} onPress={done} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: gutter, gap: space.lg, paddingBottom: space.xxl },
  hero: { alignItems: 'center', gap: space.sm, paddingBottom: space.md },
  row: { flexDirection: 'row', gap: space.md },
  prRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' },
  week: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  footer: { paddingHorizontal: gutter, paddingTop: space.md },
});
