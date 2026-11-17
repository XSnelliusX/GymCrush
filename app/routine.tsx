import React, { useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText, Button, Icon, TextField, haptics } from '../src/ui/primitives';
import { MachineImage } from '../src/components/MachineImage';
import { gutter, radius, space, touch, useTheme } from '../src/theme/theme';
import { useCopy } from '../src/i18n/useCopy';
import { useGymCrushStore } from '../src/store/useGymCrushStore';
import { machineLabel, routineMachineIds } from '../src/features/today/routines';

export default function RoutineScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const store = useGymCrushStore();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const c = useCopy();
  const zh = store.language === 'zh-TW';
  const existing = id ? store.quickRoutines.find((r) => r.id === id) : undefined;
  const isNew = !existing;
  const [routineId] = useState(() => existing?.id ?? `routine_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
  const [name, setName] = useState(existing?.name ?? '');
  const [ids, setIds] = useState<string[]>(() => (existing ? routineMachineIds(existing, store.machines) : []));
  const [touched, setTouched] = useState(false);
  const tint = colors.partners[store.activeUser];
  const nameError = touched && !name.trim() ? c('Enter a routine name.', '請輸入課表名稱。') : undefined;

  const save = () => {
    if (!name.trim()) { setTouched(true); return; }
    store.saveQuickRoutine({ id: routineId, name: name.trim(), machineIds: ids });
    router.back();
  };
  const remove = () => Alert.alert(c('Delete routine?', '刪除課表？'), c('This cannot be undone.', '此動作無法復原。'), [
    { text: c('Cancel', '取消'), style: 'cancel' },
    { text: c('Delete', '刪除'), style: 'destructive', onPress: () => { store.deleteQuickRoutine(routineId); router.back(); } },
  ]);
  const toggle = (mid: string) => { haptics.selection(); setIds((cur) => (cur.includes(mid) ? cur.filter((x) => x !== mid) : [...cur, mid])); };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: gutter, paddingTop: Platform.OS === 'android' ? insets.top + space.sm : space.lg, paddingBottom: space.md }}>
        <Button title={c('Cancel', '取消')} variant="plain" size="small" onPress={() => router.back()} />
        <AppText variant="headline" accessibilityRole="header" style={{ flex: 1, textAlign: 'center' }}>{isNew ? c('New routine', '新增課表') : c('Edit routine', '編輯課表')}</AppText>
        <Button title={c('Save', '儲存')} size="small" tint={tint} disabled={!name.trim()} onPress={save} />
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" contentContainerStyle={{ padding: gutter, gap: space.xl, paddingBottom: insets.bottom + space.xxxl }}>
        <TextField label={c('Routine name', '課表名稱')} placeholder={c('e.g. Upper body', '例如：上肢')} value={name} onChangeText={(v) => { setName(v); }} onBlur={() => setTouched(true)} maxLength={40} error={nameError} />
        <View style={{ gap: space.sm }}>
          <AppText variant="footnote" tone="secondary" style={{ fontWeight: '600', paddingHorizontal: space.xs }}>
            {c('Machines', '器材')}{ids.length ? ` · ${ids.length}` : ''}
          </AppText>
          {store.machines.length === 0 ? (
            <AppText tone="secondary" style={{ paddingHorizontal: space.xs }}>{c('Add a machine first, then pick it here.', '請先新增器材，再回來選擇。')}</AppText>
          ) : (
            <View style={{ backgroundColor: colors.surface, borderRadius: radius.card, overflow: 'hidden' }}>
              {store.machines.map((m, i) => {
                const selected = ids.includes(m.id);
                const label = machineLabel(m, zh);
                return (
                  <Pressable
                    key={m.id}
                    accessibilityRole="checkbox"
                    accessibilityLabel={label}
                    accessibilityState={{ checked: selected }}
                    onPress={() => toggle(m.id)}
                    android_ripple={{ color: colors.fill }}
                    style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: touch.large + 8, paddingHorizontal: space.lg, paddingVertical: space.sm, borderTopWidth: i ? 0.5 : 0, borderTopColor: colors.separator }, Platform.OS === 'ios' && pressed && { opacity: 0.6 }]}
                  >
                    <View style={{ width: 44, height: 44, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.fill }}>
                      {m.photoUri ? <MachineImage source={{ uri: m.photoUri }} style={{ width: 44, height: 44 }} /> : null}
                    </View>
                    <AppText style={{ flex: 1 }}>{label}</AppText>
                    <Icon name={selected ? { ios: 'checkmark.circle.fill', android: 'check_circle' } : { ios: 'circle', android: 'radio_button_unchecked' }} size={24} color={selected ? tint.color : colors.textTertiary} />
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
        {!isNew && <Button title={c('Delete routine', '刪除課表')} variant="destructive" onPress={remove} />}
      </ScrollView>
    </View>
  );
}
