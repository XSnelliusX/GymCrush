import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText, Button, Card, Icon, SegmentedControl } from '../src/ui/primitives';
import { DuoRings } from '../src/ui/DuoRings';
import { gutter, radius, space, useTheme } from '../src/theme/theme';
import { useCopy } from '../src/i18n/useCopy';
import { useGymCrushStore } from '../src/store/useGymCrushStore';
import { NamesFields, PrefsFields, ProfileDraft } from '../src/features/onboarding/ProfileFields';

function WelcomeRings() {
  const { colors } = useTheme();
  const c = useCopy();
  const [p, setP] = useState(0);
  useEffect(() => {
    const v = new Animated.Value(0);
    let anim: Animated.CompositeAnimation | undefined;
    let alive = true;
    const id = v.addListener(({ value }) => setP(value));
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (!alive) return;
      if (reduce) { setP(1); return; }
      anim = Animated.timing(v, { toValue: 1, duration: 1400, easing: Easing.out(Easing.cubic), useNativeDriver: false });
      anim.start();
    }).catch(() => setP(1));
    return () => { alive = false; anim?.stop(); v.removeListener(id); };
  }, []);
  return (
    <DuoRings size={200} stroke={18} accessibilityLabel={c('Two rings filling together', '兩個圓環一起填滿')}
      rings={[{ progress: p, color: colors.partners.markus.color }, { progress: p, color: colors.partners.partner.color }]} />
  );
}

export default function OnboardingScreen() {
  const store = useGymCrushStore();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const c = useCopy();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<ProfileDraft>({ markusName: 'Markus', partnerName: 'Abby', unit: 'kg', weeklyGoal: 4 });
  const [demo, setDemo] = useState(false);
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const tint = colors.partners[store.activeUser];
  const last = step === 2;

  const go = (n: number) => { setStep(n); scroll.current?.scrollTo({ y: 0, animated: false }); };
  const finish = () => {
    store.completeOnboarding({ markusName: draft.markusName.trim() || 'Markus', partnerName: draft.partnerName.trim() || 'Abby', unit: draft.unit, weeklyGoal: draft.weeklyGoal, loadDemoMachines: demo });
    router.replace('/today');
  };

  const choice = (selected: boolean, title: string, body: string, onPress: () => void) => (
    <Card onPress={onPress} accessibilityRole="radio" accessibilityLabel={`${title}. ${body}`} style={selected ? { borderWidth: 2, borderColor: tint.color } : { borderWidth: 2, borderColor: 'transparent' }}>
      <View accessibilityState={{ selected }} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <View style={{ flex: 1, gap: space.xs }}>
          <AppText variant="headline">{title}</AppText>
          <AppText variant="subhead" tone="secondary">{body}</AppText>
        </View>
        <Icon name={selected ? { ios: 'checkmark.circle.fill', android: 'check_circle' } : { ios: 'circle', android: 'radio_button_unchecked' }} size={24} color={selected ? tint.color : colors.textTertiary} />
      </View>
    </Card>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ paddingTop: insets.top + space.sm, paddingHorizontal: gutter, alignItems: 'flex-end' }}>
        <SegmentedControl
          style={{ width: 200 }}
          accessibilityLabel={c('Language', '語言')}
          options={[{ value: 'en', label: 'English' }, { value: 'zh-TW', label: '繁體中文' }]}
          value={store.language}
          onChange={store.setLanguage}
        />
      </View>
      <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" contentContainerStyle={{ flexGrow: 1, padding: gutter, gap: space.xxl, justifyContent: step === 0 ? 'center' : 'flex-start' }}>
        {step === 0 && (
          <View style={{ alignItems: 'center', gap: space.xl }}>
            <WelcomeRings />
            <View style={{ alignItems: 'center', gap: space.sm }}>
              <AppText variant="largeTitle" accessibilityRole="header">GymCrush</AppText>
              <AppText variant="body" tone="secondary" style={{ textAlign: 'center', maxWidth: 320 }}>{c('Train together. Keep your week streak alive.', '一起訓練，維持每週連續紀錄。')}</AppText>
            </View>
          </View>
        )}
        {step === 1 && (
          <>
            <View style={{ gap: space.xs }}>
              <AppText variant="title1" accessibilityRole="header">{c('Who is training?', '誰在訓練？')}</AppText>
              <AppText tone="secondary">{c('Each of you gets a color. You can change names later.', '你們各有一個顏色，名稱之後可以更改。')}</AppText>
            </View>
            <NamesFields draft={draft} onChange={setDraft} />
          </>
        )}
        {step === 2 && (
          <>
            <View style={{ gap: space.xs }}>
              <AppText variant="title1" accessibilityRole="header">{c('Your goal', '你們的目標')}</AppText>
              <AppText tone="secondary">{c('Pick a unit and how many days a week each of you trains.', '選擇單位，以及每人每週訓練幾天。')}</AppText>
            </View>
            <PrefsFields draft={draft} onChange={setDraft} />
            <View accessibilityRole="radiogroup" style={{ gap: space.md }}>
              {choice(!demo, c('Start fresh', '從空白開始'), c('Add your own machines at the gym.', '在健身房新增你自己的器材。'), () => setDemo(false))}
              {choice(demo, c('Load 4 sample machines', '載入 4 台範例器材'), c('Try the app with example machines and history.', '用範例器材與紀錄體驗 App。'), () => setDemo(true))}
            </View>
          </>
        )}
      </ScrollView>
      <View style={{ paddingHorizontal: gutter, paddingBottom: insets.bottom + space.md, paddingTop: space.md, gap: space.lg }}>
        <View accessible accessibilityLabel={c(`Step ${step + 1} of 3`, `第 ${step + 1} 步，共 3 步`)} style={{ flexDirection: 'row', justifyContent: 'center', gap: space.sm }}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={{ width: i === step ? 22 : 8, height: 8, borderRadius: radius.pill, backgroundColor: i === step ? tint.color : colors.fill }} />
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: space.md }}>
          {step > 0 && <Button title={c('Back', '上一步')} variant="tinted" size="large" onPress={() => go(step - 1)} style={{ flex: 1 }} />}
          <Button title={last ? c('Get started', '開始使用') : c('Continue', '繼續')} size="large" tint={tint} onPress={last ? finish : () => go(step + 1)} style={{ flex: 2 }} />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
