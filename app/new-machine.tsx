import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MachineImage } from '../src/components/MachineImage';
import { MACHINE_PRESETS, MachinePreset } from '../src/features/machines/presets';
import { defaultAdjustmentLabel, MAX_SETTINGS, MUSCLE_GROUPS, pickMachinePhoto } from '../src/features/machines/machineUtils';
import { MUSCLE_LABELS } from '../src/i18n/translations';
import { useCopy } from '../src/i18n/useCopy';
import { useGymCrushStore } from '../src/store/useGymCrushStore';
import { gutter, radius, space, useTheme } from '../src/theme/theme';
import { MuscleGroup, PartnerId } from '../src/types/gym';
import { AppText, Avatar, Button, Card, Chip, Icon, IconButton, TextField } from '../src/ui/primitives';

type Row = { id: string; label: string; markusValue: string; partnerValue: string };
const PARTNERS: PartnerId[] = ['markus', 'partner'];
const newRow = (n: number): Row => ({ id: `adj-${Date.now()}-${n}`, label: '', markusValue: '', partnerValue: '' });

export default function NewMachineScreen() {
  const router = useRouter();
  const c = useCopy();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const store = useGymCrushStore();
  const { language, profiles, activeUser } = store;
  const isZh = language === 'zh-TW';

  const [name, setName] = useState('');
  const [nameZh, setNameZh] = useState('');
  const [nameTouched, setNameTouched] = useState(false);
  const [muscleGroup, setMuscleGroup] = useState<MuscleGroup>('Chest');
  const [locationNote, setLocationNote] = useState('');
  const [photoUri, setPhotoUri] = useState(MACHINE_PRESETS[0].uri);
  const [photoProblem, setPhotoProblem] = useState<'denied' | 'unavailable' | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [rows, setRows] = useState<Row[]>([newRow(1)]);

  const hasName = !!(name.trim() || nameZh.trim());
  const nameError = nameTouched && !hasName ? c('Give the machine a name', '請輸入器材名稱') : undefined;

  const takeOrChoose = async (source: 'camera' | 'library') => {
    setPhotoBusy(true);
    const result = await pickMachinePhoto(source);
    setPhotoBusy(false);
    if (result === 'denied' || result === 'unavailable') setPhotoProblem(result);
    else if (result) { setPhotoProblem(null); setPhotoUri(result.uri); }
  };

  const applyPreset = (p: MachinePreset) => {
    setPhotoUri(p.uri);
    const nameIsPreset = MACHINE_PRESETS.some((x) => x.nameEn === name || x.nameZh === name);
    if (name.trim() && !nameIsPreset) return; // Only the photo when the user already typed their own name.
    setName(p.nameEn);
    setNameZh(p.nameZh);
    setMuscleGroup(p.muscleGroup);
    setLocationNote(isZh ? p.locationZh : p.locationEn);
    const presetRows = [
      { label: isZh ? p.adj1Zh : p.adj1En, markusValue: p.markusSeat, partnerValue: p.partnerSeat },
      { label: isZh ? p.adj2Zh : p.adj2En, markusValue: p.markusPin, partnerValue: p.partnerPin },
    ];
    setRows((prev) => [
      ...presetRows.map((r, i) => ({ ...(prev[i] ?? newRow(i + 1)), ...r })),
      ...prev.slice(2),
    ]);
  };

  const updateRow = (idx: number, patch: Partial<Row>) => setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));

  const save = () => {
    if (!hasName) { setNameTouched(true); return; }
    // Same cleanup and payload shape as AddMachineModalProps.onAddMachine.
    const cleaned = rows.map((r, idx) => ({
      label: r.label.trim() || defaultAdjustmentLabel(idx, language),
      markusValue: r.markusValue.trim() || '1',
      partnerValue: r.partnerValue.trim() || '1',
    }));
    store.addMachine({
      name: name.trim(),
      nameZh: nameZh.trim(),
      muscleGroup,
      locationNote: locationNote.trim(),
      photoUri: photoUri.trim() || MACHINE_PRESETS[0].uri,
      adjustment1Label: cleaned[0]?.label,
      adjustment2Label: cleaned[1]?.label,
      markusSeat: cleaned[0]?.markusValue || '',
      markusPin: cleaned[1]?.markusValue || '',
      partnerSeat: cleaned[0]?.partnerValue || '',
      partnerPin: cleaned[1]?.partnerValue || '',
      customAdjustments: cleaned,
    });
    router.back();
  };

  const tint = colors.partners[activeUser];

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* iOS page sheets sit below the status bar already; Android full screen needs the inset. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.sm, paddingTop: (Platform.OS === 'android' ? insets.top : 0) + space.sm, paddingBottom: space.sm }}>
        <Button title={c('Cancel', '取消')} variant="plain" size="small" onPress={() => router.back()} haptic={false} />
        <AppText variant="headline" accessibilityRole="header" numberOfLines={1} style={{ flex: 1, textAlign: 'center' }}>{c('New machine', '新增器材')}</AppText>
        <Button title={c('Save', '儲存')} size="small" tint={tint} disabled={!hasName || photoBusy} onPress={save} style={{ marginRight: space.sm }} />
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        contentContainerStyle={{ paddingHorizontal: gutter, paddingBottom: insets.bottom + space.xxxl, gap: space.xl }}
      >
        {/* Photo */}
        <View style={{ gap: space.md }}>
          <MachineImage source={{ uri: photoUri }} style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: radius.card }} accessibilityLabel={c('Machine photo preview', '器材照片預覽')} />
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Button style={{ flex: 1 }} variant="tinted" tint={tint} icon={{ ios: 'camera', android: 'photo_camera' }} title={c('Take photo', '拍照')} loading={photoBusy} onPress={() => void takeOrChoose('camera')} />
            <Button style={{ flex: 1 }} variant="tinted" tint={tint} icon={{ ios: 'photo.on.rectangle', android: 'photo_library' }} title={c('Choose photo', '選擇照片')} disabled={photoBusy} onPress={() => void takeOrChoose('library')} />
          </View>
          {photoProblem && (
            <Card style={{ backgroundColor: colors.dangerSubtle, flexDirection: 'row', gap: space.sm }}>
              <Icon name={{ ios: 'exclamationmark.triangle', android: 'warning' }} size={18} color={colors.danger} />
              <AppText variant="subhead" style={{ flex: 1 }} accessibilityLiveRegion="polite">
                {photoProblem === 'denied'
                  ? c('GymCrush doesn’t have access. Allow camera or photos in Settings, or pick a preset below.', 'GymCrush 沒有存取權限。請到設定允許相機或相簿，或從下方選擇預設照片。')
                  : c('The camera or photo library isn’t available on this device. Pick a preset below.', '此裝置無法使用相機或相簿，請從下方選擇預設照片。')}
              </AppText>
            </Card>
          )}
          <AppText variant="footnote" tone="secondary" style={{ fontWeight: '600', paddingHorizontal: space.xs }}>{c('Or start from a preset', '或從預設器材開始')}</AppText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -gutter }} contentContainerStyle={{ gap: space.sm, paddingHorizontal: gutter }}>
            {MACHINE_PRESETS.map((p) => {
              const selected = photoUri === p.uri;
              const label = isZh ? p.nameZh : p.nameEn;
              return (
                <Pressable key={p.id} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected }} onPress={() => applyPreset(p)} style={{ width: 120, gap: space.xs }}>
                  <MachineImage source={{ uri: p.uri }} style={{ width: 120, aspectRatio: 4 / 3, borderRadius: radius.md, borderWidth: 3, borderColor: selected ? colors.text : 'transparent' }} />
                  <AppText variant="caption" tone="secondary" numberOfLines={2}>{label}</AppText>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Name, muscle, location */}
        <View style={{ gap: space.md }}>
          <TextField
            label={c('Name', '名稱')}
            placeholder={c('e.g. Chest press', '例如：Chest press')}
            value={name}
            onChangeText={(v) => {
              // A preset's Chinese name no longer applies once the English name is customized.
              if (MACHINE_PRESETS.some((p) => p.nameEn === name && p.nameZh === nameZh)) setNameZh('');
              setName(v);
            }}
            onBlur={() => setNameTouched(true)}
            error={nameError}
            returnKeyType="next"
          />
          <TextField label={c('Chinese name (optional)', '中文名稱（選填）')} placeholder="例如：胸推機" value={nameZh} onChangeText={setNameZh} />
        </View>

        <View style={{ gap: space.sm }}>
          <AppText variant="footnote" tone="secondary" style={{ fontWeight: '600', paddingHorizontal: space.xs }}>{c('Muscle group', '肌群')}</AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {MUSCLE_GROUPS.map((g) => (
              <Chip key={g} label={MUSCLE_LABELS[language][g]} selected={muscleGroup === g} onPress={() => setMuscleGroup(g)} />
            ))}
          </View>
        </View>

        <TextField label={c('Location (optional)', '位置（選填）')} placeholder={c('e.g. Upstairs, by the windows', '例如：二樓靠窗')} value={locationNote} onChangeText={setLocationNote} />

        {/* Settings for both partners */}
        <View style={{ gap: space.md }}>
          <View style={{ paddingHorizontal: space.xs, gap: space.xxs }}>
            <AppText variant="headline" accessibilityRole="header">{c('Settings', '設定')}</AppText>
            <AppText variant="footnote" tone="secondary">{c('Seat height, pin, pad: whatever you adjust. Save both of yours.', '座椅高度、插銷、靠墊：把你們兩人的設定都存起來。')}</AppText>
          </View>
          {rows.map((r, idx) => (
            <Card key={r.id} style={{ gap: space.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space.sm }}>
                <TextField
                  style={{ flex: 1 }}
                  label={c(`Setting ${idx + 1}`, `設定 ${idx + 1}`)}
                  placeholder={defaultAdjustmentLabel(idx, language)}
                  value={r.label}
                  onChangeText={(v) => updateRow(idx, { label: v })}
                />
                <IconButton
                  icon={{ ios: 'minus.circle', android: 'remove_circle_outline' }}
                  label={c(`Remove setting ${idx + 1}`, `移除設定 ${idx + 1}`)}
                  color={{ color: colors.danger, onColor: colors.surface, subtle: colors.dangerSubtle }}
                  onPress={() => setRows((prev) => prev.filter((_, i) => i !== idx))}
                />
              </View>
              <View style={{ flexDirection: 'row', gap: space.md }}>
                {PARTNERS.map((pid) => (
                  <View key={pid} style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-end', gap: space.sm }}>
                    <View style={{ paddingBottom: space.sm }}>
                      <Avatar partnerId={pid} name={profiles[pid].name} size={32} />
                    </View>
                    <TextField
                      style={{ flex: 1 }}
                      label={profiles[pid].name}
                      placeholder="1"
                      value={pid === 'markus' ? r.markusValue : r.partnerValue}
                      onChangeText={(v) => updateRow(idx, pid === 'markus' ? { markusValue: v } : { partnerValue: v })}
                    />
                  </View>
                ))}
              </View>
            </Card>
          ))}
          {rows.length < MAX_SETTINGS ? (
            <Button title={c('Add setting', '新增設定')} variant="tinted" tint={tint} icon={{ ios: 'plus', android: 'add' }} onPress={() => setRows((prev) => [...prev, newRow(prev.length + 1)])} />
          ) : (
            <AppText variant="footnote" tone="secondary" style={{ textAlign: 'center' }}>{c('Up to 5 settings per machine.', '每台器材最多 5 項設定。')}</AppText>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
