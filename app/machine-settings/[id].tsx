import React, { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MAX_SETTINGS, MUSCLE_GROUPS, machineLocation, machineName, pickMachinePhoto, resolveAdjustments, sanitizeAdjustments } from '../../src/features/machines/machineUtils';
import { MACHINE_PRESETS, MachinePreset } from '../../src/features/machines/presets';
import { QuickNumberChips } from '../../src/features/machines/QuickNumberChips';
import { MachineImage } from '../../src/components/MachineImage';
import { MUSCLE_LABELS } from '../../src/i18n/translations';
import { useCopy } from '../../src/i18n/useCopy';
import { useGymCrushStore } from '../../src/store/useGymCrushStore';
import { gutter, radius, space, useTheme } from '../../src/theme/theme';
import { MachineAdjustment, MuscleGroup, PartnerId } from '../../src/types/gym';
import { AppText, Button, Card, Chip, EmptyState, Icon, IconButton, SegmentedControl, SheetHeader, TextField } from '../../src/ui/primitives';
import { KeyboardAwareScrollView } from '../../src/ui/keyboard';

const PARTNERS: PartnerId[] = ['markus', 'partner'];

export default function MachineSettingsSheet() {
  const params = useLocalSearchParams<{ id: string; partner?: string }>();
  const router = useRouter();
  const c = useCopy();
  const { colors } = useTheme();
  const store = useGymCrushStore();
  const { language, profiles } = store;
  const isZh = language === 'zh-TW';
  const machine = store.machines.find((m) => m.id === params.id);
  const [partner, setPartner] = useState<PartnerId>(params.partner === 'markus' || params.partner === 'partner' ? params.partner : store.activeUser);

  const [name, setName] = useState(machine?.name ?? '');
  const [nameZh, setNameZh] = useState(machine?.nameZh ?? '');
  const [muscleGroup, setMuscleGroup] = useState<MuscleGroup>(machine?.muscleGroup ?? 'Chest');
  const [locationNote, setLocationNote] = useState(machine ? machineLocation(machine, language) : '');
  const [photoUri, setPhotoUri] = useState(machine?.photoUri ?? MACHINE_PRESETS[0].uri);
  const [photoProblem, setPhotoProblem] = useState<'denied' | 'unavailable' | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);

  // Drafts for both partners so switching the segment never drops unsaved edits.
  const [initial] = useState(() => machine
    ? { markus: resolveAdjustments(machine, 'markus', language), partner: resolveAdjustments(machine, 'partner', language) }
    : { markus: [], partner: [] } as Record<PartnerId, MachineAdjustment[]>);
  const [drafts, setDrafts] = useState(initial);

  const close = () => router.back();
  if (!machine) {
    return (
      <>
        <View collapsable={false} style={{ backgroundColor: colors.surface }}>
          <SheetHeader title={c('Edit exercise', '編輯動作')} onClose={close} closeLabel={c('Close', '關閉')} />
        </View>
        <KeyboardAwareScrollView style={{ backgroundColor: colors.surface }}>
          <EmptyState icon={{ ios: 'questionmark.circle', android: 'help' }} title={c('Machine not found', '找不到器材')} body={c('It may have been deleted.', '它可能已被刪除。')} action={{ title: c('Close', '關閉'), onPress: close }} />
        </KeyboardAwareScrollView>
      </>
    );
  }

  const hasName = !!(name.trim() || nameZh.trim());
  const nameError = !hasName ? c('Give the exercise a name', '請輸入動作名稱') : undefined;

  const takeOrChoose = async (source: 'camera' | 'library') => {
    setPhotoBusy(true);
    const result = await pickMachinePhoto(source);
    setPhotoBusy(false);
    if (result === 'denied' || result === 'unavailable') setPhotoProblem(result);
    else if (result) { setPhotoProblem(null); setPhotoUri(result.uri); }
  };

  const applyPresetPhoto = (p: MachinePreset) => {
    setPhotoProblem(null);
    setPhotoUri(p.uri);
  };

  const rows = drafts[partner];
  const setRows = (next: MachineAdjustment[]) => setDrafts((d) => ({ ...d, [partner]: next }));
  const update = (idx: number, field: 'label' | 'value', v: string) => setRows(rows.map((a, i) => (i === idx ? { ...a, [field]: v } : a)));
  const addRow = () => {
    if (rows.length >= MAX_SETTINGS) return;
    // Label left blank on purpose: sanitizeAdjustments fills the localized default on save.
    setRows([...rows, { id: `adj-${Date.now()}-${rows.length + 1}`, label: '', value: '' }]);
  };

  const save = () => {
    if (!hasName) return;
    const origLocation = machineLocation(machine, language);
    const machineChanged =
      name.trim() !== machine.name ||
      (nameZh.trim() || undefined) !== machine.nameZh ||
      muscleGroup !== machine.muscleGroup ||
      locationNote.trim() !== origLocation.trim() ||
      photoUri !== machine.photoUri;

    if (machineChanged) {
      store.updateMachine(machine.id, {
        name,
        nameZh,
        muscleGroup,
        photoUri,
        ...(isZh && machine.locationNoteZh ? { locationNoteZh: locationNote } : { locationNote }),
      });
    }

    for (const pid of PARTNERS) {
      if (JSON.stringify(drafts[pid]) === JSON.stringify(initial[pid])) continue;
      const clean = sanitizeAdjustments(drafts[pid], language);
      store.updatePartnerSetup(machine.id, pid, clean[0]?.value || '', clean[1]?.value || '', clean);
    }
    close();
  };

  const tint = colors.partners[partner];
  const activeTint = colors.partners[store.activeUser];

  // react-native-screens form sheets lay out exactly [header (collapsable={false}), ScrollView]; any other shape renders blank or overlapped on iOS 26+.
  return (
    <>
      <View collapsable={false} style={{ backgroundColor: colors.surface }}>
        <SheetHeader
          title={c('Edit exercise', '編輯動作')}
          onClose={close}
          closeLabel={c('Cancel', '取消')}
          action={{ label: c('Save', '儲存'), onPress: save, disabled: !hasName || photoBusy, tint: activeTint }}
        />
      </View>
      <KeyboardAwareScrollView style={{ backgroundColor: colors.surface }} contentContainerStyle={{ paddingBottom: space.xxxl }}>
        <View style={{ paddingHorizontal: gutter, gap: space.lg }}>
          <AppText tone="secondary" numberOfLines={2}>{machineName(machine, language)}</AppText>

          {/* Photo */}
          <View style={{ gap: space.sm }}>
            <MachineImage source={{ uri: photoUri }} style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: radius.card }} accessibilityLabel={c('Exercise photo preview', '動作照片預覽')} />
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <Button style={{ flex: 1 }} variant="tinted" tint={activeTint} icon={{ ios: 'camera', android: 'photo_camera' }} title={c('Take photo', '拍照')} loading={photoBusy} onPress={() => void takeOrChoose('camera')} />
              <Button style={{ flex: 1 }} variant="tinted" tint={activeTint} icon={{ ios: 'photo.on.rectangle', android: 'photo_library' }} title={c('Choose photo', '選擇照片')} disabled={photoBusy} onPress={() => void takeOrChoose('library')} />
            </View>
            {photoProblem && (
              <Card style={{ backgroundColor: colors.dangerSubtle, flexDirection: 'row', gap: space.sm }}>
                <Icon name={{ ios: 'exclamationmark.triangle', android: 'warning' }} size={18} color={colors.danger} />
                <AppText variant="subhead" style={{ flex: 1 }} accessibilityLiveRegion="polite">
                  {photoProblem === 'denied'
                    ? c('Allow camera or photos in Settings, or pick a preset photo below.', '請到設定允許相機或相簿，或從下方選擇預設照片。')
                    : c('The camera or photo library isn’t available on this device.', '此裝置無法使用相機或相簿。')}
                </AppText>
              </Card>
            )}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -gutter }} contentContainerStyle={{ gap: space.sm, paddingHorizontal: gutter }}>
              {MACHINE_PRESETS.map((p) => {
                const selected = photoUri === p.uri;
                const label = isZh ? p.nameZh : p.nameEn;
                return (
                  <Pressable key={p.id} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected }} onPress={() => applyPresetPhoto(p)} style={{ width: 92, gap: space.xs }}>
                    <MachineImage source={{ uri: p.uri }} style={{ width: 92, aspectRatio: 4 / 3, borderRadius: radius.md, borderWidth: 2, borderColor: selected ? activeTint.color : 'transparent' }} />
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {/* Exercise Details */}
          <TextField label={c('Name', '名稱')} value={name} onChangeText={setName} error={nameError} returnKeyType="next" />
          <TextField label={c('Chinese name (optional)', '中文名稱（選填）')} value={nameZh} onChangeText={setNameZh} returnKeyType="next" />

          <View style={{ gap: space.sm }}>
            <AppText variant="footnote" tone="secondary" style={{ fontWeight: '600', paddingHorizontal: space.xs }}>{c('Workout type', '訓練部位 / 肌群')}</AppText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
              {MUSCLE_GROUPS.map((g) => (
                <Chip key={g} label={MUSCLE_LABELS[language][g]} selected={muscleGroup === g} onPress={() => setMuscleGroup(g)} />
              ))}
            </View>
          </View>

          <TextField label={c('Location (optional)', '位置（選填）')} placeholder={c('e.g. Upstairs, by the windows', '例如：二樓靠窗')} value={locationNote} onChangeText={setLocationNote} />

          {/* Partner Machine Settings */}
          <View style={{ gap: space.md, paddingTop: space.sm }}>
            <AppText variant="headline" accessibilityRole="header">{c('Partner machine settings', '兩人器材設定')}</AppText>
            <SegmentedControl
              accessibilityLabel={c('Whose settings', '誰的設定')}
              value={partner}
              onChange={setPartner}
              options={PARTNERS.map((pid) => ({ value: pid, label: profiles[pid].name, tint: colors.partners[pid] }))}
            />
            {rows.map((a, idx) => (
              <Card key={a.id} style={{ backgroundColor: colors.surfaceRaised, gap: space.sm }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space.sm }}>
                  <TextField
                    style={{ flex: 1 }}
                    label={c(`Setting ${idx + 1}`, `設定 ${idx + 1}`)}
                    placeholder={c('e.g. Seat height', '例如：座椅高度')}
                    value={a.label}
                    onChangeText={(v) => update(idx, 'label', v)}
                  />
                  <TextField
                    style={{ flex: 1 }}
                    label={c('Value', '數值')}
                    value={a.value}
                    onChangeText={(v) => update(idx, 'value', v)}
                    selectTextOnFocus
                  />
                  <IconButton
                    icon={{ ios: 'minus.circle', android: 'remove_circle_outline' }}
                    label={c(`Remove ${a.label || `setting ${idx + 1}`}`, `移除${a.label || `設定 ${idx + 1}`}`)}
                    color={{ color: colors.danger, onColor: colors.surface, subtle: colors.dangerSubtle }}
                    onPress={() => setRows(rows.filter((_, i) => i !== idx))}
                  />
                </View>
                <QuickNumberChips value={a.value} onChange={(v) => update(idx, 'value', v)} />
              </Card>
            ))}
            {rows.length < MAX_SETTINGS ? (
              <Button title={c('Add setting', '新增設定')} variant="tinted" tint={tint} icon={{ ios: 'plus', android: 'add' }} onPress={addRow} />
            ) : (
              <AppText variant="footnote" tone="secondary" style={{ textAlign: 'center' }}>{c('Up to 5 settings per machine.', '每台器材最多 5 項設定。')}</AppText>
            )}
          </View>
        </View>
      </KeyboardAwareScrollView>
    </>
  );
}
