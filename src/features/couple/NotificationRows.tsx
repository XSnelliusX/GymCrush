import React, { useEffect, useState } from 'react';
import { AppState, Linking } from 'react-native';
import { ListRow, ListSection } from '../../ui/primitives';
import { enableSetNotifications, setNotificationsEnabled } from '../../services/setNotifications';
import { useCopy } from '../../i18n/useCopy';

export function NotificationRows() {
  const c = useCopy();
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [denied, setDenied] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    const refresh = () => { void setNotificationsEnabled().then(setEnabled).catch(() => setError(true)); };
    refresh();
    const l = AppState.addEventListener('change', (s) => { if (s === 'active') refresh(); });
    return () => l.remove();
  }, []);
  const enable = async () => {
    setBusy(true); setError(false);
    try { const ok = await enableSetNotifications(); setEnabled(ok); setDenied(!ok); }
    catch { setError(true); }
    finally { setBusy(false); }
  };
  const openSettings = () => { void Linking.openSettings().catch(() => setError(true)); };
  const footer = error ? c('Notifications are unavailable. Try again or install the updated native build.', '目前無法存取通知。請重試或使用新的原生版本。')
    : denied ? c('Allow notifications in phone settings. In-app alerts still work.', '請在手機設定中允許通知。應用程式內通知仍可正常使用。')
    : c('The workout alarm and rest timer alert you even with the app in the background. Partner activity needs the app running, so a locked iPhone catches up when you reopen it.', '訓練提醒與休息計時在應用程式位於背景時仍會通知。夥伴動態需要應用程式執行中，iPhone 鎖定時會在重新開啟後同步。');
  return (
    <ListSection header={c('Notifications', '通知')} footer={footer}>
      <ListRow
        icon={{ ios: 'bell.badge', android: 'notifications' }}
        title={busy ? c('Enabling…', '啟用中…') : enabled ? c('Phone alerts on', '手機通知已開啟') : denied ? c('Open notification settings', '開啟通知設定') : c('Enable phone alerts', '啟用手機通知')}
        value={enabled ? c('Manage', '管理') : undefined}
        disabled={busy}
        onPress={enabled || denied ? openSettings : () => void enable()}
      />
    </ListSection>
  );
}
