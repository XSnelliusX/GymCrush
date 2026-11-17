import React, { useRef } from 'react';
import { InputAccessoryView, Keyboard, Platform, StyleSheet, TextInput, View } from 'react-native';
import { radius, space, touch, useTheme } from '../../theme/theme';
import { AppText, Button, IconButton } from '../../ui/primitives';
import { useKeyboardFocus } from '../../ui/keyboard';
import { useCopy } from '../../i18n/useCopy';

export const KEYBOARD_ACCESSORY_ID = 'workout-number-done';

/** iOS number pads have no return key; render once per screen so both steppers share a Done bar. */
export function KeyboardDoneBar() {
  const { colors } = useTheme();
  const c = useCopy();
  if (Platform.OS !== 'ios') return null;
  return (
    <InputAccessoryView nativeID={KEYBOARD_ACCESSORY_ID}>
      <View style={[styles.doneBar, { backgroundColor: colors.surfaceRaised, borderTopColor: colors.separator }]}>
        <Button title={c('Done', '完成')} variant="plain" size="small" onPress={Keyboard.dismiss} />
      </View>
    </InputAccessoryView>
  );
}

/** Gym-floor stepper: 56pt −/+ and a typeable value in metric numerals. `text` is the raw input; parent validates. */
export function Stepper({ label, unitLabel, text, onChangeText, step, min, decimal, placeholder }: {
  label: string; unitLabel: string; text: string; onChangeText: (t: string) => void;
  step: number; min: number; decimal?: boolean; placeholder?: string;
}) {
  const { colors, type } = useTheme();
  const c = useCopy();
  const wrapRef = useRef<React.ComponentRef<typeof View> | null>(null);
  const keyboardFocus = useKeyboardFocus();
  const value = Number(text.replace(',', '.'));
  const bump = (d: number) => {
    const base = Number.isFinite(value) ? value : min;
    onChangeText(String(Number(Math.max(min, base + d).toFixed(2))));
  };
  return (
    <View ref={wrapRef} collapsable={false} style={styles.wrap}>
      <View style={styles.row}>
        <IconButton icon={{ ios: 'minus', android: 'remove' }} label={c(`Decrease ${label}`, `減少${label}`)} onPress={() => bump(-step)} variant="tinted" size={touch.large} iconSize={22} />
        <TextInput
          accessibilityLabel={`${label}, ${unitLabel}`}
          value={text}
          onChangeText={onChangeText}
          onFocus={() => keyboardFocus?.scrollToInput(wrapRef.current, 96)}
          keyboardType={decimal ? 'decimal-pad' : 'number-pad'}
          selectTextOnFocus
          returnKeyType="done"
          onSubmitEditing={Keyboard.dismiss}
          inputAccessoryViewID={KEYBOARD_ACCESSORY_ID}
          placeholder={placeholder}
          placeholderTextColor={colors.textTertiary}
          selectionColor={colors.text}
          maxFontSizeMultiplier={1.6}
          style={[type.metric, styles.input, { color: colors.text, backgroundColor: colors.fill }]}
        />
        <IconButton icon={{ ios: 'plus', android: 'add' }} label={c(`Increase ${label}`, `增加${label}`)} onPress={() => bump(step)} variant="tinted" size={touch.large} iconSize={22} />
      </View>
      <AppText variant="caption" tone="secondary" style={{ textAlign: 'center' }}>{unitLabel}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  doneBar: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: space.md, borderTopWidth: StyleSheet.hairlineWidth },
  wrap: { gap: space.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  input: { flex: 1, minWidth: 0, minHeight: touch.large, borderRadius: radius.md, textAlign: 'center', paddingHorizontal: space.xs },
});
