import React from 'react';
import { Alert, Pressable, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { TabScreen } from '../../../src/components/TabScreen';
import { AppText, Avatar, Button, Card, Icon, IconButton, ListRow, ListSection, ScreenScroll } from '../../../src/ui/primitives';
import { DuoRings } from '../../../src/ui/DuoRings';
import { radius, space, useTheme } from '../../../src/theme/theme';
import { plural, useCopy } from '../../../src/i18n/useCopy';
import { useGymCrushStore } from '../../../src/store/useGymCrushStore';
import { machineLabel, routineMachineIds, routineName } from '../../../src/features/today/routines';
import { formatShortDate } from '../../../src/features/today/date';
import type { PartnerId } from '../../../src/types/gym';

const clock = (s: number) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const p = (n: number) => String(n).padStart(2, '0');
  return h ? `${h}:${p(m)}:${p(sec)}` : `${m}:${p(sec)}`;
};

export default function TodayScreen() {
  const store = useGymCrushStore();
  const router = useRouter();
  const { colors } = useTheme();
  const c = useCopy();
  const zh = store.language === 'zh-TW';
  const { profiles, machines, activeUser, partnerStatus } = store;
  const tint = colors.partners[activeUser];
  const pids: PartnerId[] = ['markus', 'partner'];
  const prog = (pid: PartnerId) => (profiles[pid].weeklyGoal > 0 ? profiles[pid].completedThisWeek / profiles[pid].weeklyGoal : 0);
  const daysText = (pid: PartnerId) => c(`${profiles[pid].completedThisWeek} of ${plural(profiles[pid].weeklyGoal, 'day', 'days')}`, `${profiles[pid].completedThisWeek} / ${profiles[pid].weeklyGoal} 天`);
  const streak = store.streak.currentStreakWeeks;

  const livePid: PartnerId = activeUser === 'markus' ? 'partner' : 'markus';
  const partnerLive = !!partnerStatus.isSessionActive; // a locked phone drops presence but is still training
  const last = [...store.completedWorkouts].sort((a, b) => Date.parse(b.finishedAt) - Date.parse(a.finishedAt))[0];

  const begin = (ids?: string[], title?: string) => {
    if (store.isSessionActive) {
      Alert.alert(
        c('Workout in progress', '訓練進行中'),
        c('Add this routine\'s exercises to your current workout?', '要把這份課表的動作加入目前的訓練嗎？'),
        [
          { text: c('Cancel', '取消'), style: 'cancel' },
          {
            text: c('Add to current workout', '加入目前訓練'),
            onPress: () => {
              (ids ?? []).filter((id) => !store.sessionMachineIds.includes(id)).forEach((id) => store.addMachineToSession(id));
              router.push('/workout');
            },
          },
        ],
      );
      return;
    }
    store.startSession(ids, title);
    router.push('/workout');
  };

  const steps = [
    c('Add a machine with a photo and each of your settings.', '新增器材，附上照片與你們各自的設定。'),
    c('Start a workout to begin the timer.', '開始訓練，啟動計時。'),
    c('Log weight and reps for each set.', '紀錄每組的重量與次數。'),
  ];

  return (
    <TabScreen>
      <Stack.Screen options={{ title: c('Today', '今天') }} />
      <ScreenScroll>
        <Card style={{ marginBottom: space.lg }}>
          <AppText variant="footnote" tone="secondary" style={{ fontWeight: '600', marginBottom: space.lg }}>{c('This week', '本週')}</AppText>
          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space.xl, justifyContent: 'center' }}>
            <DuoRings
              size={148} stroke={14}
              accessibilityLabel={c(
                `${streak} week streak. ${pids.map((p) => `${profiles[p].name}: ${daysText(p)}`).join('. ')}`,
                `連續 ${streak} 週。${pids.map((p) => `${profiles[p].name}：${daysText(p)}`).join('。')}`,
              )}
              rings={pids.map((p) => ({ progress: prog(p), color: colors.partners[p].color }))}
            >
              <View style={{ alignItems: 'center' }}>
                <AppText variant="metric" style={{ fontSize: 34, lineHeight: 38 }}>{streak}</AppText>
                <AppText variant="caption" tone="secondary">{c('week streak', '連續週數')}</AppText>
              </View>
            </DuoRings>
            <View style={{ gap: space.md, flexGrow: 1, flexShrink: 1, minWidth: 140 }}>
              {pids.map((p) => (
                <View key={p} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                  <Avatar partnerId={p} name={profiles[p].name} size={32} />
                  <View style={{ flex: 1 }}>
                    <AppText variant="headline" numberOfLines={1}>{profiles[p].name}</AppText>
                    <AppText variant="subhead" tone="secondary">{daysText(p)}</AppText>
                  </View>
                </View>
              ))}
            </View>
          </View>
        </Card>

        {partnerLive && (
          <Card style={{ marginBottom: space.lg }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
              <Pressable
                accessibilityRole="button"
                accessibilityHint={c(`Opens ${profiles[livePid].name}'s workout`, `開啟 ${profiles[livePid].name} 的訓練`)}
                onPress={() => router.push('/partner-workout')}
                style={({ pressed }) => [{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md }, pressed && { opacity: 0.6 }]}
              >
              <Avatar partnerId={livePid} name={profiles[livePid].name} size={44} online={partnerStatus.isOnline} />
              <View style={{ flex: 1, gap: 2 }}>
                <AppText variant="headline">{c(`${profiles[livePid].name} is training`, `${profiles[livePid].name} 正在訓練`)}</AppText>
                <AppText variant="subhead" tone="secondary" numberOfLines={2}>
                  {[partnerStatus.currentMachineName, partnerStatus.currentSetNumber ? c(`Set ${partnerStatus.currentSetNumber}`, `第 ${partnerStatus.currentSetNumber} 組`) : null].filter(Boolean).join(' · ') || c('Getting ready', '準備中')}
                </AppText>
                {partnerStatus.restSecondsRemaining > 0 && (
                  <AppText variant="number" color={colors.gold}>{c('On a break', '休息中')} {clock(partnerStatus.restSecondsRemaining)}</AppText>
                )}
              </View>
              </Pressable>
              <Button title={c('Cheer', '加油')} variant="tinted" size="small" tint={colors.partners[livePid]} onPress={() => router.push('/cheer')} />
            </View>
          </Card>
        )}

        {machines.length === 0 ? (
          <Card style={{ marginBottom: space.lg, gap: space.lg }}>
            <AppText variant="title3" accessibilityRole="header">{c('Set up your gym', '設定你的健身房')}</AppText>
            {steps.map((s, i) => (
              <View key={i} style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
                <View style={{ width: 28, height: 28, borderRadius: radius.pill, backgroundColor: tint.subtle, alignItems: 'center', justifyContent: 'center' }}>
                  <AppText variant="number" color={tint.color}>{i + 1}</AppText>
                </View>
                <AppText style={{ flex: 1 }}>{s}</AppText>
              </View>
            ))}
            <Button title={c('Add your first machine', '新增第一台器材')} size="large" tint={tint} icon={{ ios: 'plus', android: 'add' }} onPress={() => router.push('/new-machine')} />
          </Card>
        ) : (
          <>
            {store.isSessionActive ? (
              <Card onPress={() => router.push('/workout')} accessibilityLabel={c('Resume workout', '繼續訓練')} style={{ marginBottom: space.xxl }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <AppText variant="headline">{c('Resume workout', '繼續訓練')}</AppText>
                    <AppText variant="subhead" tone="secondary" numberOfLines={1}>
                      {store.sessionTitle ? `${store.sessionTitle} · ` : ''}{c(`${plural(store.sessionMachineIds.length, 'exercise', 'exercises')}`, `${store.sessionMachineIds.length} 項動作`)}
                    </AppText>
                  </View>
                  <AppText variant="timer" color={tint.color}>{clock(store.sessionElapsedSeconds)}</AppText>
                </View>
              </Card>
            ) : (
              <Button title={c('Start workout', '開始訓練')} size="large" tint={tint} icon={{ ios: 'play.fill', android: 'play_arrow' }} onPress={() => begin()} style={{ marginBottom: space.xxl }} />
            )}

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg, marginBottom: -space.xs }}>
              <AppText variant="footnote" tone="secondary" accessibilityRole="header" style={{ fontWeight: '600' }}>{c('Routines', '課表')}</AppText>
              <Button title={c('New', '新增')} variant="plain" size="small" tint={tint} onPress={() => router.push('/routine')} />
            </View>
            <ListSection>
              {store.quickRoutines.length === 0 ? (
                <ListRow title={c('No routines yet', '尚無課表')} subtitle={c('Tap New to create one.', '點選「新增」建立課表。')} />
              ) : store.quickRoutines.map((r) => {
                const ids = routineMachineIds(r, machines);
                const names = ids.map((id) => machines.find((m) => m.id === id)).filter((m) => !!m).map((m) => machineLabel(m!, zh)).join(' · ');
                return (
                  <ListRow
                    key={r.id}
                    title={routineName(r, zh)}
                    subtitle={ids.length ? `${c(`${plural(ids.length, 'machine', 'machines')}`, `${ids.length} 台器材`)} · ${names}` : c('No machines', '尚無器材')}
                    accessibilityHint={c('Opens the routine editor', '開啟課表編輯')}
                    onPress={() => router.push({ pathname: '/routine', params: { id: r.id } })}
                    accessory={<IconButton icon={{ ios: 'play.fill', android: 'play_arrow' }} label={`${c('Start', '開始')} ${routineName(r, zh)}`} variant="tinted" color={tint} iconSize={16} onPress={() => begin(ids, routineName(r, zh))} />}
                  />
                );
              })}
            </ListSection>

            {last && (
              <ListSection header={c('Last workout', '上次訓練')}>
                <ListRow
                  icon={{ ios: 'clock', android: 'schedule' }}
                  title={last.title || c('Workout', '訓練')}
                  subtitle={[formatShortDate(last.finishedAt, store.language), last.durationSeconds ? c(`${Math.round(last.durationSeconds / 60)} min`, `${Math.round(last.durationSeconds / 60)} 分鐘`) : null].filter(Boolean).join(' · ')}
                  onPress={() => router.push(`/history/${last.id}`)}
                />
              </ListSection>
            )}
          </>
        )}
      </ScreenScroll>
    </TabScreen>
  );
}
