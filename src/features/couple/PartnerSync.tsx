import React, { useState, useSyncExternalStore } from 'react';
import { Share, View } from 'react-native';
import { AppText, Button, ListRow, ListSection, TextField } from '../../ui/primitives';
import { space, useTheme } from '../../theme/theme';
import { syncEngine } from '../../services/syncEngine';
import { useGymCrushStore } from '../../store/useGymCrushStore';
import { useCopy } from '../../i18n/useCopy';

const noop = () => () => {};

export function PartnerSync() {
  const store = useGymCrushStore();
  const { colors } = useTheme();
  const c = useCopy();
  const cloud = syncEngine.cloud;
  const status = useSyncExternalStore(cloud?.subscribe || noop, cloud?.getSnapshot || (() => null));
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const tint = colors.partners[store.activeUser];

  const run = async (join: boolean) => {
    if (!cloud || busy) return;
    setBusy(true); setError('');
    try {
      if (join) await cloud.joinCouple(code);
      else { await cloud.createCouple(store.activeUser); await store.syncLocalData(); }
    } catch (err) { setError((err as Error).message || String(err)); }
    finally { setBusy(false); }
  };

  const dot = (color: string) => <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />;
  const err = error || status?.error || '';
  const errorRow = err ? <View accessibilityRole="alert" style={{ padding: space.lg }}><AppText variant="footnote" color={colors.danger}>{err}</AppText></View> : null;

  if (!status) {
    return <ListSection header={c('Partner sync', '夥伴同步')}><ListRow title={c('Cloud sync is not configured.', '尚未設定雲端連線。')} icon={{ ios: 'icloud.slash', android: 'cloud_off' }} /></ListSection>;
  }
  if (status.coupleId) {
    const text = status.pending ? c(`${status.pending} changes waiting to sync`, `${status.pending} 筆資料等待同步`)
      : status.connected ? c('Cloud connected', '雲端已連線') : c('Offline. Changes are saved and will retry.', '離線，變更會保留並重試');
    const ok = status.connected && !status.pending;
    return (
      <ListSection
        header={c('Partner sync', '夥伴同步')}
        footer={c('Keep the app and its data installed to preserve this device’s sign-in.', '請勿移除 App 或清除資料，否則此裝置的登入身分會遺失。')}
      >
        <ListRow title={text} accessory={dot(ok ? colors.success : status.connected ? colors.textTertiary : colors.danger)} />
        <ListRow title={c('This phone belongs to', '此手機的身分')} value={status.deviceUser ? store.profiles[status.deviceUser].name : '–'} />
        <View style={{ padding: space.lg, gap: space.md }}>
          <AppText variant="footnote" tone="secondary">{c('Invite code', '邀請碼')}</AppText>
          <AppText variant="number" selectable>{status.inviteCode}</AppText>
          <Button title={c('Share invite code', '分享邀請碼')} variant="tinted" tint={tint} icon={{ ios: 'square.and.arrow.up', android: 'share' }}
            onPress={() => { void Share.share({ message: status.inviteCode! }).catch((e) => setError(e.message)); }} />
        </View>
        {errorRow}
      </ListSection>
    );
  }
  return (
    <ListSection
      header={c('Partner sync', '夥伴同步')}
      footer={c('Choose your name under “On this phone”, then create a couple on one phone and enter its invite code on the other.', '先在「這支手機」選擇你的名字，然後在一支手機建立連線，另一支輸入邀請碼加入。')}
    >
      <View style={{ padding: space.lg, gap: space.md }}>
        <Button title={busy ? c('Connecting…', '連線中…') : c('Create couple', '建立雙人連線')} tint={tint} disabled={busy} onPress={() => void run(false)} />
      </View>
      <View style={{ padding: space.lg, gap: space.md }}>
        <TextField label={c('Invite code', '邀請碼')} placeholder={c('32-character invite code', '輸入 32 字元邀請碼')} value={code} onChangeText={setCode} autoCapitalize="none" autoCorrect={false} maxLength={32} />
        <Button title={c('Join partner', '加入伴侶')} variant="tinted" tint={tint} disabled={busy || code.trim().length !== 32} onPress={() => void run(true)} />
      </View>
      {errorRow}
    </ListSection>
  );
}
