import React, { useState } from 'react';
import { Alert, Platform, Pressable, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { MachineImage } from '../../../src/components/MachineImage';
import { AppText, Avatar, Button, Card, EmptyState, haptics, Icon, ScreenScroll, TextField } from '../../../src/ui/primitives';
import { radius, space, touch, useTheme } from '../../../src/theme/theme';
import { useGymCrushStore } from '../../../src/store/useGymCrushStore';
import { plural, useCopy } from '../../../src/i18n/useCopy';
import { workoutDuration } from '../../../src/services/workoutHistory';
import { formatDuration } from '../../../src/features/history/helpers';
import { PartnerId } from '../../../src/types/gym';

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
  if (!w) return <><Stack.Screen options={{ title: c('Workout', '訓練') }} /><EmptyState icon={{ ios: 'questionmark.circle', android: 'help' }} title={c('Workout not found', '找不到這次訓練')} action={{ title: c('Back to history', '返回紀錄'), onPress: () => router.replace('/history') }} /></>;

  const title = w.title || c('Workout', '訓練');
  const sets = store.sets.filter((s) => s.workoutId === w.id);
  const machineIds = [...new Set(sets.map((s) => s.machineId))];
  const dur = formatDuration(workoutDuration(w));
  const date = new Date(w.finishedAt).toLocaleDateString(zh ? 'zh-TW' : 'en', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
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
        <AppText tone="secondary">{[dur, c(`${plural(sets.length, 'set', 'sets')}`, `${sets.length} 組`)].filter(Boolean).join(' · ')}</AppText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md, marginTop: space.md }}>
          {w.participants.map((p) => (
            <View key={p} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
              <Avatar partnerId={p} name={store.profiles[p].name} size={28} />
              <AppText>{store.profiles[p].name}</AppText>
            </View>
          ))}
        </View>
      </Card>
      {sets.length > 0 && <AppText variant="footnote" tone="secondary">{c('Tap a set to edit its weight or reps, or delete it.', '點選任一組即可編輯重量、次數或刪除。')}</AppText>}
      {machineIds.map((id) => {
        const m = store.machines.find((x) => x.id === id);
        const ms = sets.filter((s) => s.machineId === id);
        const name = (m && ((zh ? m.nameZh : m.name) || m.name)) || ms[0].machineName;
        const people = (['markus', 'partner'] as PartnerId[]).filter((p) => ms.some((s) => s.userId === p));
        return (
          <Card key={id} style={{ gap: space.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
              {m?.photoUri ? <MachineImage source={{ uri: m.photoUri }} accessibilityIgnoresInvertColors style={{ width: 48, height: 48, borderRadius: radius.md, backgroundColor: colors.fill }} /> : null}
              <AppText variant="headline" style={{ flex: 1 }}>{name}</AppText>
            </View>
            {people.map((p) => (
              <View key={p} style={{ gap: space.xs }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
                  <Icon name={{ ios: 'checkmark.circle.fill', android: 'check_circle' }} size={16} color={colors.partners[p].color} />
                  <AppText variant="subhead" style={{ fontWeight: '600' }} color={colors.partners[p].color}>{store.profiles[p].name}</AppText>
                </View>
                {ms.filter((s) => s.userId === p).sort((a, b) => a.setNumber - b.setNumber).map((s) => (
                  <Pressable
                    key={s.id} accessibilityRole="button"
                    accessibilityLabel={c(`Edit ${store.profiles[p].name}’s ${name}, set ${s.setNumber}: ${s.weight} ${s.unit}, ${s.reps} reps`, `編輯 ${store.profiles[p].name} 的${name}第 ${s.setNumber} 組：${s.weight} ${s.unit}，${s.reps} 次`)}
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
                    <Icon name={{ ios: 'pencil', android: 'edit' }} size={16} color={colors.textSecondary} />
                  </Pressable>
                ))}
              </View>
            ))}
          </Card>
        );
      })}
      <Button title={c('Delete session', '刪除訓練')} variant="destructive" icon={{ ios: 'trash', android: 'delete' }} onPress={remove} />
    </ScreenScroll>
  );
}
