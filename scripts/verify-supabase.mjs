// Creates three isolated test identities. Run only after approving live backend tests.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
assert.ok(url && key, 'Run with node --env-file=.env scripts/verify-supabase.mjs');
const clients = Array.from({ length: 3 }, () => createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
}));
const report = { startedAt: new Date().toISOString(), userIds: [], coupleIds: [], checks: [] };
const reportPath = '/tmp/gymcrush-supabase-smoke.json';
const save = () => fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), { mode: 0o600 });
const check = (label) => { report.checks.push(label); console.log(`PASS ${label}`); save(); };
const unwrap = (result) => { assert.ifError(result.error); return result.data; };
try {
  for (const client of clients) {
    const data = unwrap(await client.auth.signInAnonymously());
    report.userIds.push(data.user.id); save();
  }
  check('Anonymous device sign-in');
  const [a, b, outsider] = clients;
  const room = unwrap(await a.rpc('gym_create_couple', { chosen_partner: 'markus' }));
  report.coupleIds.push(room); save();
  const { invite_code: code } = unwrap(await a.from('gym_couples').select('invite_code').single());
  assert.equal(unwrap(await b.rpc('gym_join_couple', { code })), room);
  check('Two devices pair into opposite profile slots');
  const outsiderRoom = unwrap(await outsider.rpc('gym_create_couple', { chosen_partner: 'markus' }));
  report.coupleIds.push(outsiderRoom); save();
  assert.deepEqual(unwrap(await outsider.from('gym_events').select('*').eq('couple_id', room)), []);
  assert.deepEqual(unwrap(await outsider.from('gym_couples').select('*').eq('id', room)), []);
  check('Other couples cannot read this couple or its events');
  const item = { id: `smoke_${Date.now()}`, senderInstanceId: 'smoke-a', senderPlatform: 'test', timestamp: Date.now(),
    event: { type: 'HYPE_REACTION', payload: { reaction: { id: `smoke-reaction-${Date.now()}`, fromUser: 'markus', toUser: 'partner', emoji: '💪', message: 'Disposable sync verification', createdAt: new Date().toISOString() } } } };
  unwrap(await a.rpc('gym_append_event', { item }));
  unwrap(await a.rpc('gym_append_event', { item }));
  const rows = unwrap(await b.from('gym_events').select('id, envelope').eq('id', item.id));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].envelope.event.payload.reaction.message, 'Disposable sync verification');
  check('Partner retrieves one durable copy after an idempotent retry');
  assert.ok((await outsider.from('gym_events').insert({ id: 'forged', couple_id: room, sender_id: report.userIds[2], envelope: item })).error);
  check('Direct forged writes are denied');
  const channels = [a, b, outsider].map((client) => client.channel(`gymcrush:${room}`, {
    config: { private: true, broadcast: { self: false, ack: true }, presence: { key: crypto.randomUUID() } },
  }));
  let received = 0;
  channels[1].on('broadcast', { event: 'smoke' }, () => received++);
  const subscribe = (channel) => new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Realtime subscribe timed out')), 15000);
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') { clearTimeout(timeout); resolve(status); }
    });
  });
  assert.equal(await subscribe(channels[0]), 'SUBSCRIBED');
  assert.equal(await subscribe(channels[1]), 'SUBSCRIBED');
  assert.notEqual(await subscribe(channels[2]), 'SUBSCRIBED');
  check('Private realtime accepts members and rejects another couple');
  assert.equal(await channels[0].send({ type: 'broadcast', event: 'smoke', payload: { id: item.id } }), 'ok');
  const deadline = Date.now() + 5000;
  while (received === 0 && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 100));
  assert.equal(received, 1);
  check('Partner receives one realtime message');
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
  const path = `${room}/smoke.png`;
  unwrap(await a.storage.from('gym-photos').upload(path, png, { contentType: 'image/png' }));
  const signed = unwrap(await b.storage.from('gym-photos').createSignedUrl(path, 60));
  assert.equal((await fetch(signed.signedUrl)).status, 200);
  assert.ok((await outsider.storage.from('gym-photos').createSignedUrl(path, 60)).error);
  check('Private photos load for the partner and reject another couple');
  console.log(`Live checks complete. Disposable IDs for cleanup: ${reportPath}`);
} finally {
  save();
  await Promise.all(clients.map((client) => client.removeAllChannels()));
}
