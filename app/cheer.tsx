import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGymCrushStore } from '../src/store/useGymCrushStore';
import { t } from '../src/i18n/translations';
import { useCopy } from '../src/i18n/useCopy';
import { gutter, radius, space, touch, useTheme } from '../src/theme/theme';
import { AppText, Button, haptics, SheetHeader, TextField } from '../src/ui/primitives';
import { HypeEmoji } from '../src/types/gym';
import { otherPartner } from '../src/features/workout/workoutHelpers';

// Translations prefix the emoji ("🔥 Strong set!"); the tile shows it separately.
const stripEmoji = (s: string) => s.replace(/^\S+\s+/, '');

export default function CheerSheet() {
  const store = useGymCrushStore();
  const router = useRouter();
  const { colors } = useTheme();
  const c = useCopy();
  const insets = useSafeAreaInsets();
  const tr = t(store.language);
  const [selected, setSelected] = useState<HypeEmoji>('🔥');
  const [message, setMessage] = useState('');
  const me = store.activeUser;
  const to = store.profiles[otherPartner(me)].name;

  const options: { emoji: HypeEmoji; label: string }[] = [
    { emoji: '🔥', label: stripEmoji(tr.quickInteractFire) },
    { emoji: '💪', label: stripEmoji(tr.quickInteractPush) },
    { emoji: '❤️', label: c('Crushing it together', '一起變強') },
    { emoji: '👑', label: c('Heavy and smooth!', '重量很穩！') },
    { emoji: '👀', label: stripEmoji(tr.quickInteractSpot) },
    { emoji: '💧', label: stripEmoji(tr.quickInteractWater) },
  ];
  const label = options.find((o) => o.emoji === selected)!.label;

  const send = () => {
    store.sendReaction(selected, `${store.profiles[me].name}: ${message.trim() || label}`);
    haptics.success();
    router.back();
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ backgroundColor: colors.bg }}>
      <SheetHeader title={c(`Cheer ${to}`, `為 ${to} 加油`)} onClose={() => router.back()} closeLabel={c('Close', '關閉')} />
      <View style={[styles.body, { paddingBottom: Math.max(insets.bottom, space.lg) }]}>
        <View style={styles.grid} accessibilityRole="radiogroup">
          {options.map((o) => {
            const on = o.emoji === selected;
            return (
              <Pressable
                key={o.emoji}
                accessibilityRole="radio"
                accessibilityLabel={o.label}
                accessibilityState={{ selected: on, checked: on }}
                onPress={() => { haptics.selection(); setSelected(o.emoji); }}
                style={[styles.tile, { backgroundColor: on ? colors.partners[me].subtle : colors.surface, borderColor: on ? colors.partners[me].color : 'transparent' }]}
              >
                <AppText style={styles.emoji} allowFontScaling={false}>{o.emoji}</AppText>
                <AppText variant="footnote" numberOfLines={2} style={{ textAlign: 'center', fontWeight: on ? '600' : '400' }}>{o.label}</AppText>
              </Pressable>
            );
          })}
        </View>
        <TextField label={c('Message (optional)', '訊息（選填）')} value={message} onChangeText={setMessage} placeholder={label} maxLength={200} returnKeyType="send" onSubmitEditing={send} />
        <Button title={c('Send', '送出')} icon={{ ios: 'paperplane.fill', android: 'send' }} size="large" tint={colors.partners[me]} haptic={false} onPress={send} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: gutter, gap: space.lg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tile: { width: '31.5%', flexGrow: 1, minHeight: touch.large * 1.6, borderRadius: radius.lg, borderWidth: 2, alignItems: 'center', justifyContent: 'center', gap: space.xs, padding: space.sm },
  emoji: { fontSize: 28, lineHeight: 34 },
});
