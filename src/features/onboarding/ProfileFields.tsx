import React from 'react';
import { View } from 'react-native';
import { AppText, SegmentedControl, TextField } from '../../ui/primitives';
import { space, useTheme } from '../../theme/theme';
import { useCopy } from '../../i18n/useCopy';
import type { PartnerId } from '../../types/gym';

export type ProfileDraft = { markusName: string; partnerName: string; unit: 'kg' | 'lbs'; weeklyGoal: number };

/** Name field whose label is led by that partner's color dot (the name is still the label, so color is never the only cue). */
function NameField({ pid, label, value, onChange, placeholder }: { pid: PartnerId; label: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  const { colors } = useTheme();
  return (
    <View>
      <View style={{ position: 'absolute', left: space.xs, top: 4, width: 10, height: 10, borderRadius: 5, backgroundColor: colors.partners[pid].color, zIndex: 1 }} />
      <TextField label={` ${label}`} value={value} onChangeText={onChange} placeholder={placeholder} maxLength={24} autoCapitalize="words" returnKeyType="done" />
    </View>
  );
}

export function NamesFields({ draft, onChange }: { draft: ProfileDraft; onChange: (d: ProfileDraft) => void }) {
  const c = useCopy();
  return (
    <View style={{ gap: space.lg }}>
      <NameField pid="markus" label={c('You', '你')} value={draft.markusName} onChange={(markusName) => onChange({ ...draft, markusName })} placeholder="Markus" />
      <NameField pid="partner" label={c('Partner', '伴侶')} value={draft.partnerName} onChange={(partnerName) => onChange({ ...draft, partnerName })} placeholder="Abby" />
    </View>
  );
}

export function PrefsFields({ draft, onChange }: { draft: ProfileDraft; onChange: (d: ProfileDraft) => void }) {
  const c = useCopy();
  return (
    <View style={{ gap: space.xl }}>
      <View style={{ gap: space.sm }}>
        <AppText variant="footnote" tone="secondary" style={{ fontWeight: '600', paddingHorizontal: space.xs }}>{c('Weight unit', '重量單位')}</AppText>
        <SegmentedControl
          accessibilityLabel={c('Weight unit', '重量單位')}
          options={[{ value: 'kg', label: 'kg' }, { value: 'lbs', label: 'lbs' }]}
          value={draft.unit}
          onChange={(unit) => onChange({ ...draft, unit })}
        />
      </View>
      <View style={{ gap: space.sm }}>
        <AppText variant="footnote" tone="secondary" style={{ fontWeight: '600', paddingHorizontal: space.xs }}>{c('Weekly goal for each of you (days)', '兩人各自的每週目標（天）')}</AppText>
        <SegmentedControl
          accessibilityLabel={c('Weekly goal in days', '每週目標天數')}
          options={[2, 3, 4, 5, 6].map((n) => ({ value: String(n), label: String(n) }))}
          value={String(draft.weeklyGoal)}
          onChange={(v) => onChange({ ...draft, weeklyGoal: Number(v) })}
        />
      </View>
    </View>
  );
}
