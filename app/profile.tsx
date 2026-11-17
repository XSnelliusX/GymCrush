import React, { useState } from 'react';
import { Platform, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText, Button } from '../src/ui/primitives';
import { KeyboardAwareScrollView } from '../src/ui/keyboard';
import { gutter, space, useTheme } from '../src/theme/theme';
import { useCopy } from '../src/i18n/useCopy';
import { useGymCrushStore } from '../src/store/useGymCrushStore';
import { NamesFields, PrefsFields, ProfileDraft } from '../src/features/onboarding/ProfileFields';

export default function ProfileScreen() {
  const store = useGymCrushStore();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const c = useCopy();
  const [draft, setDraft] = useState<ProfileDraft>(() => ({
    markusName: store.profiles.markus.name,
    partnerName: store.profiles.partner.name,
    unit: store.profiles.markus.unit,
    weeklyGoal: store.profiles.markus.weeklyGoal,
  }));
  const tint = colors.partners[store.activeUser];

  const save = () => {
    // Same action the old edit mode used; with onboarding already completed it keeps machines and history and converts units.
    store.completeOnboarding({ ...draft, loadDemoMachines: false });
    router.back();
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: gutter, paddingTop: Platform.OS === 'android' ? insets.top + space.sm : space.lg, paddingBottom: space.md }}>
        <Button title={c('Cancel', '取消')} variant="plain" size="small" onPress={() => router.back()} />
        <AppText variant="headline" accessibilityRole="header" style={{ flex: 1, textAlign: 'center' }}>{c('Profiles', '個人檔案')}</AppText>
        <Button title={c('Save', '儲存')} size="small" tint={tint} onPress={save} />
      </View>
      <KeyboardAwareScrollView contentContainerStyle={{ padding: gutter, gap: space.xxl, paddingBottom: insets.bottom + space.xxxl }}>
        <NamesFields draft={draft} onChange={setDraft} />
        <PrefsFields draft={draft} onChange={setDraft} />
        <AppText variant="footnote" tone="secondary" style={{ paddingHorizontal: space.xs }}>{c('Your machines and workout history are preserved.', '你的器材與訓練紀錄會完整保留。')}</AppText>
      </KeyboardAwareScrollView>
    </View>
  );
}
