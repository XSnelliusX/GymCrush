import React from 'react';
import { View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { TabScreen } from '../../../src/components/TabScreen';
import { AppText, Avatar, Card, Icon, ListRow, ListSection, ScreenScroll, SegmentedControl } from '../../../src/ui/primitives';
import { space, useTheme } from '../../../src/theme/theme';
import { useGymCrushStore } from '../../../src/store/useGymCrushStore';
import { plural, useCopy } from '../../../src/i18n/useCopy';
import { PartnerSync } from '../../../src/features/couple/PartnerSync';
import { NotificationRows } from '../../../src/features/couple/NotificationRows';
import { PartnerId } from '../../../src/types/gym';

const PIDS: PartnerId[] = ['markus', 'partner'];

export default function CoupleScreen() {
  const store = useGymCrushStore();
  const { colors } = useTheme();
  const router = useRouter();
  const c = useCopy();
  const { profiles, streak } = store;

  return (
    <TabScreen>
      <Stack.Screen options={{ title: c('Couple', '我們') }} />
      <ScreenScroll>
        <Card style={{ marginBottom: space.xxl, alignItems: 'center', gap: space.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <Avatar partnerId="markus" name={profiles.markus.name} size={64} />
            <Icon name={{ ios: 'heart.fill', android: 'favorite' }} size={24} color={colors.textSecondary} />
            <Avatar partnerId="partner" name={profiles.partner.name} size={64} />
          </View>
          <AppText variant="headline" style={{ textAlign: 'center' }}>{profiles.markus.name} + {profiles.partner.name}</AppText>
          <AppText tone="secondary" accessibilityLabel={c(`${streak.currentStreakWeeks} week streak, best ${streak.bestStreakWeeks}`, `連續 ${streak.currentStreakWeeks} 週，最長 ${streak.bestStreakWeeks} 週`)}>
            {c(`${streak.currentStreakWeeks}-week streak · best ${streak.bestStreakWeeks}`, `連續 ${streak.currentStreakWeeks} 週 · 最長 ${streak.bestStreakWeeks} 週`)}
          </AppText>
        </Card>

        <PartnerSync />

        <ListSection
          header={c('On this phone', '這支手機')}
          footer={c('Sets you log are saved for this person, and the app takes their color.', '你記錄的組數會歸於所選的人，App 也會換上對應的顏色。')}
        >
          <View style={{ padding: space.md }}>
            <SegmentedControl
              accessibilityLabel={c('Logging as', '記錄身分')} value={store.activeUser} onChange={store.switchActiveUser}
              options={PIDS.map((p) => ({ value: p, label: profiles[p].name, tint: colors.partners[p] }))}
            />
          </View>
        </ListSection>

        <ListSection header={c('Profiles & goals', '個人資料與目標')}>
          {PIDS.map((p) => (
            <ListRow
              key={p} title={profiles[p].name}
              subtitle={c(`${plural(profiles[p].weeklyGoal, 'day', 'days')} a week · ${profiles[p].unit}`, `每週 ${profiles[p].weeklyGoal} 天 · ${profiles[p].unit}`)}
              accessory={<Avatar partnerId={p} name={profiles[p].name} size={32} />}
              onPress={() => router.push('/profile')}
            />
          ))}
        </ListSection>

        <NotificationRows />

        <ListSection header={c('Language', '語言')}>
          {([['en', 'English'], ['zh-TW', '繁體中文']] as const).map(([lang, label]) => (
            <ListRow
              key={lang} title={label} onPress={() => store.setLanguage(lang)} accessory={store.language === lang ? <Icon name={{ ios: 'checkmark', android: 'check' }} size={18} color={colors.text} /> : 'none'}
              accessibilityHint={store.language === lang ? c('Selected', '已選取') : undefined}
            />
          ))}
        </ListSection>

        {__DEV__ && (
          <ListSection header={c('Developer', '開發者')}>
            <ListRow title={c('Simulate partner set', '模擬伴侶完成一組')} icon={{ ios: 'wand.and.stars', android: 'auto_fix_high' }} onPress={store.simulatePartnerSet} />
          </ListSection>
        )}
      </ScreenScroll>
    </TabScreen>
  );
}
