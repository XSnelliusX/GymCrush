import React, { useEffect } from 'react';
import { LogBox, Platform, View } from 'react-native';
import { DarkTheme, DefaultTheme, router, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useTheme } from '../src/theme/theme';
import { sheetOptions } from '../src/ui/navigation';
import { ReactionBanner } from '../src/components/ReactionBanner';
import { useGymCrushStore } from '../src/store/useGymCrushStore';
import { onNotificationOpened } from '../src/services/setNotifications';

// Dev-only noise: the number pad's Done bar uses InputAccessoryView, which RN 0.88 marks deprecated but still ships.
LogBox.ignoreLogs(['InputAccessoryView is deprecated', 'Sending `onAnimatedValueUpdate` with no listeners registered']);

export default function RootLayout() {
  const { scheme, colors } = useTheme();
  const store = useGymCrushStore();
  const needsOnboarding = store.isOnboardingOpen && !store.hasCompletedOnboarding;
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  useEffect(() => onNotificationOpened((url) => router.navigate(url as never)), []);
  const navTheme = { ...base, colors: { ...base.colors, background: colors.bg, card: colors.surface, text: colors.text, border: colors.separator, primary: colors.text } };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider value={navTheme}>
          <StatusBar style="auto" />
          <View style={{ flex: 1, backgroundColor: colors.bg }}>
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
              <Stack.Protected guard={needsOnboarding}>
                <Stack.Screen name="onboarding" options={{ gestureEnabled: false, animation: 'fade' }} />
              </Stack.Protected>
              <Stack.Protected guard={!needsOnboarding}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="index" />
              {/* Workout: iOS page sheet (swipe down = minimize), Android full screen sliding up. */}
              <Stack.Screen name="workout" options={{ presentation: Platform.OS === 'ios' ? 'modal' : 'card', animation: Platform.OS === 'ios' ? 'default' : 'slide_from_bottom' }} />
              <Stack.Screen name="partner-workout" options={{ presentation: Platform.OS === 'ios' ? 'modal' : 'card', animation: Platform.OS === 'ios' ? 'default' : 'slide_from_bottom' }} />
              <Stack.Screen name="workout-summary" options={{ presentation: Platform.OS === 'ios' ? 'modal' : 'card', animation: Platform.OS === 'ios' ? 'default' : 'slide_from_bottom', gestureEnabled: false }} />
              <Stack.Screen name="new-machine" options={{ presentation: Platform.OS === 'ios' ? 'modal' : 'card', animation: Platform.OS === 'ios' ? 'default' : 'slide_from_bottom' }} />
              <Stack.Screen name="profile" options={{ presentation: Platform.OS === 'ios' ? 'modal' : 'card', animation: Platform.OS === 'ios' ? 'default' : 'slide_from_bottom' }} />
              <Stack.Screen name="routine" options={{ presentation: Platform.OS === 'ios' ? 'modal' : 'card', animation: Platform.OS === 'ios' ? 'default' : 'slide_from_bottom' }} />
              <Stack.Screen name="add-exercise" options={sheetOptions([0.7, 1])} />
              <Stack.Screen name="machine-settings/[id]" options={sheetOptions([0.7, 1])} />
              <Stack.Screen name="edit-set/[id]" options={sheetOptions([0.7, 1])} />
              <Stack.Screen name="cheer" options={sheetOptions([0.7, 1])} />
              </Stack.Protected>
            </Stack>
            <ReactionBanner />
          </View>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
