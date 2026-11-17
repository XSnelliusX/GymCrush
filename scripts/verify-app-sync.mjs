// Real app stores and sync code against Supabase; native APIs are adapters, not device tests.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const reportPath = '/tmp/gymcrush-app-sync-smoke.json';
if (fs.existsSync(reportPath)) fs.appendFileSync('/tmp/gymcrush-app-sync-runs.jsonl', `${fs.readFileSync(reportPath, 'utf8')}\n`, { mode: 0o600 });
const report = { startedAt: new Date().toISOString(), userIds: [], coupleIds: [], checks: [] };
const save = () => fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), { mode: 0o600 });
const check = (label) => { report.checks.push(label); save(); console.log(`PASS ${label}`); };
async function until(label, condition, timeout = 20000) {
  const deadline = Date.now() + timeout;
  while (!condition()) {
    assert.ok(Date.now() < deadline, `Timed out: ${label}`);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

function device(os, saved = new Map()) {
  const modules = new Map();
  const timers = [];
  const clients = [];
  const network = { online: true };
  const trace = [];
  const storage = {
    getItem: async (key) => saved.get(key) ?? null,
    setItem: async (key, value) => { saved.set(key, value); },
    removeItem: async (key) => { saved.delete(key); },
  };
  const load = (relative) => {
    if (modules.has(relative)) return modules.get(relative).exports;
    const filename = path.join(root, relative);
    const source = fs.readFileSync(filename, 'utf8');
    const output = ts.transpileModule(source, { compilerOptions: {
      target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true,
    }, fileName: filename }).outputText;
    const module = { exports: {} };
    modules.set(relative, module);
    const localRequire = (id) => {
      if (id === '@react-native-async-storage/async-storage') return storage;
      if (id === 'react-native-url-polyfill/auto') return {};
      if (id === 'react-native') return { Platform: { OS: os }, NativeModules: {}, AppState: {
        addEventListener: () => ({ remove() {} }),
      } };
      if (id === 'react') return { useSyncExternalStore: (_subscribe, snapshot) => snapshot() };
      if (id === 'expo-haptics') return {
        ImpactFeedbackStyle: {}, NotificationFeedbackType: {}, impactAsync: async () => {}, notificationAsync: async () => {},
      };
      if (id === 'expo-file-system' || id === 'expo-file-system/legacy') return { EncodingType: { Base64: 'base64' },
        readAsStringAsync: async () => Buffer.from([255,216,255,217]).toString('base64') };
      if (id === '@supabase/supabase-js') {
        const original = require(id);
        return { ...original, createClient: (url, key, options) => {
          // Physical phones have separate auth lock/broadcast namespaces; emulate that in one Node process.
          const client = createClient(url, key, { ...options,
            realtime: { logger: (kind, message) => { if (/close|error|timeout|heartbeat/i.test(message)) trace.push({ kind, message }); } },
            auth: { ...options.auth, storageKey: `gymcrush-live-${os}` }, global: { fetch: (input, init) => {
            if (!network.online) return Promise.reject(new TypeError('Simulated offline device'));
            return fetch(input, init);
          } } });
          const originalChannel = client.channel.bind(client);
          client.channel = (...args) => {
            const channel = originalChannel(...args);
            channel.on('system', {}, (payload) => trace.push({ action: 'system', status: payload.status,
              message: String(payload.message).replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, '[redacted]') }));
            const unsubscribe = channel.unsubscribe.bind(channel);
            channel.unsubscribe = (...values) => {
              trace.push({ action: 'unsubscribe', stack: new Error().stack.split('\n').slice(1, 5) });
              return unsubscribe(...values);
            };
            return channel;
          };
          clients.push(client); return client;
        } };
      }
      if (id.startsWith('.')) {
        const target = path.relative(root, path.resolve(path.dirname(filename), `${id}.ts`));
        return load(target);
      }
      return require(id);
    };
    new Function('require', 'module', 'exports', '__DEV__', 'setInterval', output)(
      localRequire, module, module.exports, false, (callback, milliseconds) => {
        const timer = setInterval(callback, milliseconds); timer.unref(); timers.push(timer); return timer;
      });
    return module.exports;
  };
  const storeModule = load('src/store/useGymCrushStore.ts');
  const engine = load('src/services/syncEngine.ts').syncEngine;
  return { store: () => storeModule.useGymCrushStore(), engine, saved, network, clients, trace, timers,
    async stop() { timers.forEach(clearInterval); await Promise.all(clients.map(async (client) => {
      client.auth.stopAutoRefresh(); await client.removeAllChannels();
    })); },
  };
}

const devices = [];
try {
  const a = device('android'); const b = device('ios'); devices.push(a, b);
  await Promise.all([a.engine.cloud.ready, b.engine.cloud.ready]);
  const options = { markusName: 'Markus', partnerName: 'Abby', unit: 'kg', weeklyGoal: 2, loadDemoMachines: false };
  a.store().completeOnboarding(options); b.store().completeOnboarding(options);
  if (!a.engine.cloud.getSnapshot().coupleId) await a.engine.cloud.createCouple('markus');
  const pairing = a.engine.cloud.getSnapshot();
  const connectionTrace = [];
  for (const [name, current] of [['android', a], ['ios', b]]) current.engine.cloud.subscribe(() => {
    const snapshot = current.engine.cloud.getSnapshot();
    const last = connectionTrace[connectionTrace.length - 1];
    if (snapshot.connected !== last?.connected || snapshot.error !== last?.error) connectionTrace.push({ device: name, connected: snapshot.connected, error: snapshot.error });
  });
  report.coupleIds.push(pairing.coupleId); save();
  if (!b.engine.cloud.getSnapshot().coupleId) await b.engine.cloud.joinCouple(pairing.inviteCode);
  for (const current of [a, b]) {
    const { data } = await current.clients[0].auth.getUser(); report.userIds.push(data.user.id); save();
  }
  await until('both devices present', () => a.store().syncConnected && b.store().syncConnected);
  check('Real app sync engines connect and detect the opposite phone profile');
  a.store().addMachine({ name: 'Live test chest press', muscleGroup: 'Chest', locationNote: 'Disposable integration fixture',
    photoUri: 'https://example.com/gymcrush-test.jpg', markusSeat: '5', partnerSeat: '2' });
  const id = a.store().selectedMachineId;
  await until('machine delivery', () => b.store().machines.some((m) => m.id === id));
  check('App machine catalog syncs between independently persisted stores');
  a.store().updatePartnerSetup(id, 'markus', '11', '', [{ id: 'seat', label: 'Seat', value: '11' }]);
  a.store().updatePartnerSetup(id, 'partner', '22', '', [{ id: 'seat', label: 'Seat', value: '22' }]);
  await until('both setup values', () => {
    const machine = b.store().machines.find((m) => m.id === id);
    return machine.partnerSetups.markus.seatPosition === '11' && machine.partnerSetups.partner.seatPosition === '22';
  });
  check('Both partners machine settings survive real cloud delivery');
  a.store().startSession([id], 'Live integration workout');
  await until('shared clock', () => b.store().isSessionActive);
  assert.equal(b.store().sessionStartedAt, a.store().sessionStartedAt);
  const set = a.store().logSet(25, 8, id);
  await until('set delivery', () => b.store().sets.some((item) => item.id === set.id));
  await new Promise((resolve) => setTimeout(resolve, 5500));
  assert.equal(b.store().sets.filter((item) => item.id === set.id).length, 1);
  check('A set delivered over Realtime and database catch-up is stored once');
  let reactionDeliveries = 0;
  let cheerObservedInStore = false;
  const receivedReactions = [];
  const unsubscribe = b.engine.subscribe((event, historical) => {
    if (event.type === 'HYPE_REACTION') {
      receivedReactions.push({ historical, toUser: event.payload.reaction.toUser, activeUser: b.store().activeUser });
      if (event.payload.reaction.message === 'One live cheer' && !historical) reactionDeliveries++;
      if (b.store().latestReaction?.message === 'One live cheer') cheerObservedInStore = true;
    }
  });
  a.store().sendReaction('💪', 'One live cheer');
  try { await until('received cheer', () => cheerObservedInStore); }
  catch (error) {
    report.diagnostics = { activeA: a.store().activeUser, activeB: b.store().activeUser, receivedReactions,
      receiverCursor: b.engine.cloud.cursor, senderChannel: a.engine.cloud.channel?.state, receiverChannel: b.engine.cloud.channel?.state,
      receiverBusy: b.engine.cloud.busy, receiverForeground: b.engine.cloud.foreground,
      traces: { sender: a.trace, receiver: b.trace, timers: b.timers.map((timer) => ({ destroyed: timer._destroyed, interval: timer._repeat })) },
      sender: { connected: a.engine.cloud.getSnapshot().connected, pending: a.engine.cloud.getSnapshot().pending, error: a.engine.cloud.getSnapshot().error },
      receiver: { connected: b.engine.cloud.getSnapshot().connected, error: b.engine.cloud.getSnapshot().error },
    };
    const session = (await a.clients[0].auth.getSession()).data.session;
    const realtimeToken = a.clients[0].realtime.accessTokenValue;
    report.diagnostics.auth = { sessionExpiresIn: session?.expires_at - Date.now() / 1000,
      realtimeTokenMatches: session?.access_token === realtimeToken,
      realtimeExpiresIn: realtimeToken ? JSON.parse(Buffer.from(realtimeToken.split('.')[1], 'base64url')).exp - Date.now() / 1000 : null };
    const rows = await a.clients[0].from('gym_events').select('seq, envelope').eq('couple_id', pairing.coupleId).order('seq');
    report.diagnostics.serverEvents = rows.data?.map((row) => ({ seq: row.seq, type: row.envelope.event.type, timestamp: row.envelope.timestamp }));
    console.log('Cheer diagnostics', JSON.stringify(report.diagnostics));
    throw error;
  }
  await new Promise((resolve) => setTimeout(resolve, 6000));
  assert.equal(reactionDeliveries, 1);
  assert.equal(b.store().latestReaction, null);
  unsubscribe();
  check('One cheer reaches the app once and expires without a catch-up replay');
  const restEvents = [];
  const stopRestTrace = b.engine.subscribe((event) => {
    if (event.type === 'PARTNER_STATUS') restEvents.push({
      user: event.payload.status.userId, sequence: event.payload.status.sequence,
      rest: event.payload.status.restSecondsRemaining, storedRest: b.store().partnerStatus.restSecondsRemaining,
    });
  });
  try {
    a.store().startRest(60);
    await until('rest delivery', () => b.store().partnerStatus.restSecondsRemaining > 50 && b.store().partnerStatus.restSecondsRemaining <= 60);
    a.store().cancelRest();
    await until('rest cancellation', () => b.store().partnerStatus.restSecondsRemaining === 0);
  } catch (error) {
    report.restDiagnostics = { restEvents, ownRest: a.store().restSeconds, partnerRest: b.store().partnerStatus.restSecondsRemaining,
      connectionTrace,
      traces: { sender: a.trace, receiver: b.trace },
      receiverBusy: b.engine.cloud.busy, receiverCursor: b.engine.cloud.cursor,
      sender: { connected: a.engine.cloud.getSnapshot().connected, pending: a.engine.cloud.getSnapshot().pending, error: a.engine.cloud.getSnapshot().error },
      receiver: { connected: b.engine.cloud.getSnapshot().connected, error: b.engine.cloud.getSnapshot().error },
    };
    console.log('Rest diagnostics', JSON.stringify(report.restDiagnostics));
    throw error;
  } finally { stopRestTrace(); }
  check('Custom rest and cancellation propagate through the app');
  a.network.online = false;
  await a.clients[0].removeAllChannels();
  const offlineSet = a.store().logSet(27.5, 8, id);
  await until('durable offline queue', () => a.engine.cloud.getSnapshot().pending > 0);
  await a.stop();
  const restarted = device('android', a.saved); devices.push(restarted);
  await restarted.engine.cloud.ready;
  await until('offline set recovered', () => b.store().sets.some((item) => item.id === offlineSet.id));
  await until('queue drained after restart', () => restarted.engine.cloud.getSnapshot().pending === 0);
  assert.equal(b.store().sets.filter((item) => item.id === offlineSet.id).length, 1);
  assert.equal(restarted.store().activeUser, 'markus');
  check('An offline set and device identity survive restart and retry once');
  restarted.store().finishSession();
  await until('shared finish', () => !b.store().isSessionActive);
  assert.equal(b.store().profiles.markus.completedThisWeek, 1);
  assert.equal(restarted.store().profiles.markus.completedThisWeek, 1);
  check('Shared finish records one completed training day on both app stores');
  console.log(`App-level live checks complete. Disposable IDs: ${reportPath}`);
} finally {
  save();
  await Promise.all(devices.map((current) => current.stop()));
}
