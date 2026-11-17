import React, { useState } from 'react';
import { ActionSheetIOS, Alert, Platform, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { MachineImage } from '../../../src/components/MachineImage';
import { machineLocation, machineName, MUSCLE_GROUPS, pickMachinePhoto, resolveAdjustments } from '../../../src/features/machines/machineUtils';
import { MUSCLE_LABELS } from '../../../src/i18n/translations';
import { useCopy } from '../../../src/i18n/useCopy';
import { useGymCrushStore } from '../../../src/store/useGymCrushStore';
import { radius, space, useTheme } from '../../../src/theme/theme';
import { MuscleGroup, PartnerId } from '../../../src/types/gym';
import {
  AppText, Button, Card, Chip, Icon, IconButton, ListRow, ListSection, ScreenScroll, SegmentedControl, TextField, haptics,
} from '../../../src/ui/primitives';

const PARTNERS: PartnerId[] = ['markus', 'partner'];

export default function MachineDetailScreen() {
  const { id, edit } = useLocalSearchParams<{ id: string; edit?: string }>();
  const router = useRouter();
  const c = useCopy();
  const { colors } = useTheme();
  const store = useGymCrushStore();
  const { language, profiles, activeUser } = store;
  const machine = store.machines.find((m) => m.id === id);
  const [partner, setPartner] = useState<PartnerId>(activeUser);
  const [editing, setEditing] = useState<{ name: string; nameZh: string; muscleGroup: MuscleGroup; locationNote: string } | null>(() =>
    edit === '1' && machine
      ? {
          name: machine.name,
          nameZh: machine.nameZh || '',
          muscleGroup: machine.muscleGroup,
          locationNote: machineLocation(machine, language),
        }
      : null,
  );
  const [busy, setBusy] = useState(false);

  // Deleted (here or by the partner's device): render nothing while we pop back.
  if (!machine) return <Stack.Screen options={{ title: '' }} />;

  const name = machineName(machine, language);
  const location = machineLocation(machine, language);
  const adjustments = resolveAdjustments(machine, partner, language);
  const setup = machine.partnerSetups?.[partner];
  const unit = profiles[partner].unit;
  const inWorkout = store.isSessionActive && store.sessionMachineIds.includes(machine.id);

  const changePhoto = async () => {
    const result = await pickMachinePhoto('library', () => setBusy(true));
    setBusy(false);
    if (result === 'denied') Alert.alert(c('Photo access needed', '需要相簿權限'), c('Allow photo library access in Settings to change this photo.', '請在設定中允許相簿權限以更換照片。'));
    else if (result === 'unavailable') Alert.alert(c('Could not update photo', '無法更新照片'));
    else if (result) store.updateMachinePhoto(machine.id, result.uri);
  };

  const confirmDelete = () => {
    haptics.warning();
    Alert.alert(
      c(`Delete ${name}?`, `刪除「${name}」？`),
      c('Both partners’ settings for this machine are removed. Your workout history is kept.', '兩人在這台器材的設定都會刪除，訓練紀錄會保留。'),
      [
        { text: c('Cancel', '取消'), style: 'cancel' },
        { text: c('Delete', '刪除'), style: 'destructive', onPress: () => { store.deleteMachine(machine.id); router.back(); } },
      ],
    );
  };

  const startEdit = () => setEditing({
    name: machine.name,
    nameZh: machine.nameZh || '',
    muscleGroup: machine.muscleGroup,
    locationNote: machineLocation(machine, language),
  });

  const openMenu = () => {
    const edit = c('Edit exercise', '編輯動作');
    const photo = c('Change photo', '更換照片');
    const del = c('Delete machine', '刪除器材');
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: [c('Cancel', '取消'), edit, photo, del], cancelButtonIndex: 0, destructiveButtonIndex: 3, title: name },
        (i) => { if (i === 1) startEdit(); if (i === 2) void changePhoto(); if (i === 3) confirmDelete(); },
      );
    } else {
      // Android alerts hold at most 3 buttons; tapping outside cancels.
      Alert.alert(name, undefined, [
        { text: del, style: 'destructive', onPress: confirmDelete },
        { text: photo, onPress: () => void changePhoto() },
        { text: edit, onPress: startEdit },
      ], { cancelable: true });
    }
  };

  const editError = editing && !editing.name.trim() && !editing.nameZh.trim() ? c('Enter a name', '請輸入名稱') : undefined;
  const saveEdit = () => {
    if (!editing || editError) return;
    store.updateMachine(machine.id, {
      name: editing.name,
      nameZh: editing.nameZh,
      muscleGroup: editing.muscleGroup,
      ...(language === 'zh-TW' && machine.locationNoteZh ? { locationNoteZh: editing.locationNote } : { locationNote: editing.locationNote }),
    });
    setEditing(null);
  };

  const primary = () => {
    if (store.isSessionActive) {
      store.addMachineToSession(machine.id);
      store.setSelectedMachineId(machine.id);
    } else {
      store.startSession([machine.id]);
    }
    router.push('/workout');
  };

  const hasStats = !!setup && (setup.lastWorkingWeight > 0 || setup.personalRecordWeight > 0);

  return (
    <>
      <Stack.Screen
        options={{
          title: name,
          headerLargeTitleEnabled: false,
          headerRight: () => (
            <IconButton icon={{ ios: 'ellipsis.circle', android: 'more_vert' }} label={c('More actions', '更多動作')} onPress={openMenu} />
          ),
        }}
      />
      <ScreenScroll>
        <View>
          <MachineImage source={{ uri: machine.photoUri }} style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: radius.card }} accessibilityLabel={c(`Photo of ${name}`, `${name} 的照片`)} />
          {busy && <AppText variant="footnote" tone="secondary" style={{ marginTop: space.xs }}>{c('Saving photo…', '正在儲存照片…')}</AppText>}
        </View>

        {editing ? (
          <Card style={{ marginTop: space.lg, gap: space.md }}>
            <TextField label={c('Name', '名稱')} value={editing.name} onChangeText={(v) => setEditing({ ...editing, name: v })} error={editError} autoFocus returnKeyType="next" />
            <TextField label={c('Chinese name (optional)', '中文名稱（選填）')} value={editing.nameZh} onChangeText={(v) => setEditing({ ...editing, nameZh: v })} returnKeyType="next" />
            <View style={{ gap: space.sm }}>
              <AppText variant="footnote" tone="secondary" style={{ fontWeight: '600', paddingHorizontal: space.xs }}>{c('Workout type', '訓練部位 / 肌群')}</AppText>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
                {MUSCLE_GROUPS.map((g) => (
                  <Chip key={g} label={MUSCLE_LABELS[language][g]} selected={editing.muscleGroup === g} onPress={() => setEditing({ ...editing, muscleGroup: g })} />
                ))}
              </View>
            </View>
            <TextField label={c('Location (optional)', '位置（選填）')} value={editing.locationNote} onChangeText={(v) => setEditing({ ...editing, locationNote: v })} returnKeyType="done" onSubmitEditing={saveEdit} />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: space.sm }}>
              <Button title={c('Cancel', '取消')} variant="plain" size="small" onPress={() => setEditing(null)} />
              <Button title={c('Save', '儲存')} size="small" disabled={!!editError} tint={colors.partners[activeUser]} onPress={saveEdit} />
            </View>
          </Card>
        ) : null}

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.md, marginBottom: space.xl, gap: space.sm }}>
          <AppText tone="secondary" style={{ flex: 1 }}>
            {[MUSCLE_LABELS[language][machine.muscleGroup], location].filter(Boolean).join(' · ')}
          </AppText>
          {!editing && (
            <Button title={c('Edit', '編輯')} variant="plain" size="small" icon={{ ios: 'pencil', android: 'edit' }} onPress={startEdit} />
          )}
        </View>

        <SegmentedControl
          accessibilityLabel={c('Whose settings', '誰的設定')}
          value={partner}
          onChange={setPartner}
          options={PARTNERS.map((pid) => ({ value: pid, label: profiles[pid].name, tint: colors.partners[pid] }))}
          style={{ marginBottom: space.lg }}
        />

        <ListSection header={c(`${profiles[partner].name}’s settings`, `${profiles[partner].name} 的設定`)}>
          {adjustments.map((a) => <ListRow key={a.id} title={a.label} value={a.value} />)}
          <ListRow
            title={c('Edit settings', '編輯設定')}
            icon={{ ios: 'slider.horizontal.3', android: 'tune' }}
            iconColor={colors.partners[partner].color}
            onPress={() => router.push({ pathname: '/machine-settings/[id]', params: { id: machine.id, partner } })}
          />
        </ListSection>

        <Card style={{ marginBottom: space.xxl }}>
          {hasStats ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xl }}>
              <View style={{ flex: 1, minWidth: 120, gap: space.xs }}>
                <AppText variant="footnote" tone="secondary">{c('Last working set', '上次訓練組')}</AppText>
                <AppText variant="metric">
                  {setup!.lastWorkingWeight}
                  <AppText variant="number" tone="secondary"> {unit} × {setup!.lastReps}</AppText>
                </AppText>
              </View>
              <View style={{ flex: 1, minWidth: 120, gap: space.xs }} accessible accessibilityLabel={c(`Personal record ${setup!.personalRecordWeight} ${unit}`, `個人紀錄 ${setup!.personalRecordWeight} ${unit}`)}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
                  <Icon name={{ ios: 'crown.fill', android: 'workspace_premium' }} size={14} color={colors.gold} />
                  <AppText variant="footnote" color={colors.gold} style={{ fontWeight: '700' }}>PR</AppText>
                </View>
                <AppText variant="metric">
                  {setup!.personalRecordWeight}
                  <AppText variant="number" tone="secondary"> {unit}</AppText>
                </AppText>
              </View>
            </View>
          ) : (
            <AppText tone="secondary">
              {c(`No sets logged by ${profiles[partner].name} on this machine yet.`, `${profiles[partner].name} 還沒在這台器材上記錄訓練組。`)}
            </AppText>
          )}
        </Card>

        <Button
          size="large"
          tint={colors.partners[activeUser]}
          disabled={inWorkout}
          icon={inWorkout ? { ios: 'checkmark', android: 'check' } : { ios: 'plus', android: 'add' }}
          title={inWorkout ? c('In workout', '已在訓練中') : store.isSessionActive ? c('Add to workout', '加入訓練') : c('Start workout with this', '用這台開始訓練')}
          onPress={primary}
        />
      </ScreenScroll>
    </>
  );
}
