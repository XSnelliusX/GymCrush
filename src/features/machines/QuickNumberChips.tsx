import React from 'react';
import { ScrollView } from 'react-native';
import { gutter, space } from '../../theme/theme';
import { Chip } from '../../ui/primitives';

const NUMBERS = Array.from({ length: 10 }, (_, i) => String(i + 1));

/** One-tap 1–10 values for gym-floor entry (seat notches, pin holes). */
export function QuickNumberChips({ value, onChange, bleed = true }: { value: string; onChange: (v: string) => void; bleed?: boolean }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      style={bleed ? { marginHorizontal: -gutter } : undefined}
      contentContainerStyle={{ gap: space.sm, paddingHorizontal: bleed ? gutter : 0, paddingVertical: space.xs }}
    >
      {NUMBERS.map((n) => (
        <Chip key={n} label={n} selected={value.trim() === n} onPress={() => onChange(n)} />
      ))}
    </ScrollView>
  );
}
