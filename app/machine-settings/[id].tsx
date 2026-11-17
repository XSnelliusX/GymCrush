import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MAX_SETTINGS, machineName, resolveAdjustments, sanitizeAdjustments } from '../../src/features/machines/machineUtils';
import { QuickNumberChips } from '../../src/features/machines/QuickNumberChips';
import { useCopy } from '../../src/i18n/useCopy';
import { useGymCrushStore } from '../../src/store/useGymCrushStore';
import { gutter, space, useTheme } from '../../src/theme/theme';
import { MachineAdjustment, PartnerId } from '../../src/types/gym';
import { AppText, Button, Card, EmptyState, IconButton, SegmentedControl, SheetHeader, TextField } from '../../src/ui/primitives';

const PARTNERS: PartnerId[] = ['markus', 'partner'];

export default function MachineSettingsSheet() {
  const params = useLocalSearchParams<{ id: string; partner?: string }>();
  const router = useRouter();
  const c = useCopy();
  const { colors } = useTheme();
  const store = useGymCrushStore();
  const { language, profiles } = store;
  const machine = store.machines.find((m) => m.id === params.id);
  const [partner, setPartner] = useState<PartnerId>(params.partner === 'markus' || params.partner === 'partner' ? params.partner : store.activeUser);
  // Drafts for both partners so switching the segment never drops unsaved edits.
  const [initial] = useState(() => machine
    ? { markus: resolveAdjustments(machine, 'markus', language), partner: resolveAdjustments(machine, 'partner', language) }
    : { markus: [], partner: [] } as Record<PartnerId, MachineAdjustment[]>);
  const [drafts, setDrafts] = useState(initial);

  const close = () => router.back();
  if (!machine) {
    return (
      <View style={{ backgroundColor: colors.surface }}>
        <SheetHeader title={c('Machine settings', '器材設定')} onClose={close} closeLabel={c('Close', '關閉')} />
        <EmptyState icon={{ ios: 'questionmark.circle', android: 'help' }} title={c('Machine not found', '找不到器材')} body={c('It may have been deleted.', '它可能已被刪除。')} action={{ title: c('Close', '關閉'), onPress: close }} />
      </View>
    );
  }

  const rows = drafts[partner];
  const setRows = (next: MachineAdjustment[]) => setDrafts((d) => ({ ...d, [partner]: next }));
  const update = (idx: number, field: 'label' | 'value', v: string) => setRows(rows.map((a, i) => (i === idx ? { ...a, [field]: v } : a)));
  const addRow = () => {
    if (rows.length >= MAX_SETTINGS) return;
    // Label left blank on purpose: sanitizeAdjustments fills the localized default on save.
    setRows([...rows, { id: `adj-${Date.now()}-${rows.length + 1}`, label: '', value: '' }]);
  };

  const save = () => {
    for (const pid of PARTNERS) {
      if (JSON.stringify(drafts[pid]) === JSON.stringify(initial[pid])) continue;
      const clean = sanitizeAdjustments(drafts[pid], language);
      store.updatePartnerSetup(machine.id, pid, clean[0]?.value || '', clean[1]?.value || '', clean);
    }
    close();
  };

  const tint = colors.partners[partner];
  // react-native-screens form sheets lay out exactly [header (collapsable={false}), ScrollView]; any other shape renders blank or overlapped on iOS 26+.
  return (
    <>
      <View collapsable={false} style={{ backgroundColor: colors.surface }}>
        <SheetHeader
          title={c('Machine settings', '器材設定')}
          onClose={close}
          closeLabel={c('Cancel', '取消')}
          action={{ label: c('Save', '儲存'), onPress: save, tint: colors.partners[store.activeUser] }}
        />
      </View>
      <ScrollView style={{ backgroundColor: colors.surface }} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" contentContainerStyle={{ paddingBottom: space.xxxl }}>
        <View style={{ paddingHorizontal: gutter, gap: space.lg }}>
        <AppText tone="secondary" numberOfLines={2}>{machineName(machine, language)}</AppText>
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
      </ScrollView>
    </>
  );
}
