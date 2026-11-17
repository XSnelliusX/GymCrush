import { AppState, Platform } from 'react-native';
import type { Language, WorkoutSetLog } from '../types/gym';

// Load native notifications only on phones; web keeps the existing in-app banner.
const native = () => import('expo-notifications');

export type ScheduledAlert = 'workout-alarm' | 'rest-end';

async function prepare() {
  const notifications = await native();
  notifications.setNotificationHandler({ handleNotification: async (item) => {
    // Foreground feedback already appears in the shared header; only the alarm also makes a sound.
    const background = AppState.currentState !== 'active';
    const kind = item?.request.content.data?.kind;
    return { shouldShowBanner: background, shouldShowList: background || kind !== 'rest-end', shouldPlaySound: kind === 'workout-alarm', shouldSetBadge: false };
  } });
  return notifications;
}

export async function enableSetNotifications(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const notifications = await native();
  if (Platform.OS === 'android') {
    await notifications.setNotificationChannelAsync('workout-sets', {
      name: 'Partner activity', importance: notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 150], // channel default sound; a 'default' string is looked up as a custom file on Android
    });
    await notifications.setNotificationChannelAsync('workout-alarm', {
      name: 'Workout timer', importance: notifications.AndroidImportance.HIGH, vibrationPattern: [0, 400, 200, 400],
    });
  }
  const permission = await notifications.requestPermissionsAsync();
  return permission.granted || permission.ios?.status === notifications.IosAuthorizationStatus.PROVISIONAL;
}

export async function setNotificationsEnabled(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const notifications = await native();
  const permission = await notifications.getPermissionsAsync();
  return permission.granted || permission.ios?.status === notifications.IosAuthorizationStatus.PROVISIONAL;
}

/** Shows now if the OS lets this process run. Without APNs nothing can wake a suspended iPhone app, so these need live JS. */
export async function notifyPartnerEvent(identifier: string, title: string, body: string, url: string, data: Record<string, string> = {}): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const notifications = await prepare();
    if (!await setNotificationsEnabled()) return;
    await notifications.scheduleNotificationAsync({
      identifier,
      content: { title, body, sound: true, data: { ...data, url } },
      trigger: Platform.OS === 'android' ? { channelId: 'workout-sets' } : null,
    });
  } catch (error) {
    // OS permissions or native delivery must never prevent saving a set.
    console.warn('[Notifications] Could not present partner event:', error);
  }
}

export function notifyCompletedSet(set: WorkoutSetLog, name: string, language: Language): Promise<void> {
  return notifyPartnerEvent(
    `set-${set.id}`,
    language === 'zh-TW' ? `${name} 完成第 ${set.setNumber} 組` : `${name} finished set ${set.setNumber}`,
    `${set.machineName} · ${set.weight} ${set.unit} × ${set.reps}${set.isPR ? ' · PR' : ''}`,
    '/partner-workout',
    { workoutId: set.workoutId, setId: set.id },
  );
}

let alertQueue: Promise<void> = Promise.resolve();

/** Hands a future alert to the OS so it fires while the app is suspended or closed. `at: null` cancels it. */
export function scheduleAlert(kind: ScheduledAlert, at: number | null, title: string, body: string): Promise<void> {
  if (Platform.OS === 'web') return Promise.resolve();
  // Serialized so rapid alarm adjustments cannot leave an older schedule standing.
  alertQueue = alertQueue.then(async () => {
    try {
      const notifications = await prepare();
      await notifications.cancelScheduledNotificationAsync(kind);
      if (at === null || at <= Date.now() || !await setNotificationsEnabled()) return;
      await notifications.scheduleNotificationAsync({
        identifier: kind,
        content: { title, body, sound: true, data: { kind, url: '/workout' } },
        trigger: { type: notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: 'workout-alarm' },
      });
    } catch (error) {
      console.warn('[Notifications] Could not schedule alert:', error);
    }
  });
  return alertQueue;
}

/** Opens the screen a tapped notification points to, including one that launched the app. */
export function onNotificationOpened(open: (url: string) => void): () => void {
  if (Platform.OS === 'web') return () => {};
  let remove = () => {};
  let cancelled = false;
  const route = (response: { notification: { request: { content: { data?: Record<string, unknown> | null } } } } | null | undefined) => {
    const url = response?.notification.request.content.data?.url;
    if (typeof url === 'string') open(url);
  };
  void native().then((notifications) => {
    if (cancelled) return;
    route(notifications.getLastNotificationResponse());
    const subscription = notifications.addNotificationResponseReceivedListener(route);
    remove = () => subscription.remove();
  }).catch((error) => console.warn('[Notifications] Could not watch taps:', error));
  return () => { cancelled = true; remove(); };
}
