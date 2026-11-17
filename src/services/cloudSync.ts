import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, RealtimeChannel } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import type { PartnerId } from '../types/gym';
import type { SyncEnvelope } from './syncEngine';

// Expo only inlines statically referenced public environment variables.
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
export const cloudConfigured = Boolean(url && key);
export const supabase = url && key ? createClient(url, key, {
  auth: { storage: AsyncStorage, persistSession: true, autoRefreshToken: true,
    detectSessionInUrl: false },
}) : null;

export interface CloudState {
  configured: boolean;
  coupleId: string | null;
  inviteCode: string | null;
  deviceUser: PartnerId | null;
  connected: boolean;
  pending: number;
  error: string | null;
}

type Member = { couple_id: string; partner_id: PartnerId };
const OUTBOX = 'GYMCRUSH_CLOUD_OUTBOX_V1';

export class CloudSync {
  private state: CloudState = { configured: cloudConfigured, coupleId: null, inviteCode: null,
    deviceUser: null, connected: false, pending: 0, error: null };
  private listeners = new Set<() => void>();
  private channel: RealtimeChannel | null = null;
  private outbox: SyncEnvelope[] = [];
  private cursor = 0;
  private busy = false;
  private queueWrite = Promise.resolve();
  private startedAt = Date.now();
  private receive: (item: SyncEnvelope, historical: boolean) => void;
  private presence: (state: Record<string, any[]>) => void;
  private instanceId: string;
  private foreground = true;
  private restoringMembership = false;
  private connecting = false;
  private lastPresenceTrackedAt = 0;
  private ready: Promise<void>;

  constructor(instanceId: string, receive: (item: SyncEnvelope, historical: boolean) => void,
    presence: (state: Record<string, any[]>) => void) {
    this.instanceId = instanceId;
    this.receive = receive;
    this.presence = presence;
    this.ready = this.restore();
    if (supabase) {
      setInterval(() => { if (this.foreground) void this.tick(); }, 5000);
      AppState.addEventListener('change', (value) => {
        this.foreground = value === 'active';
        if (this.foreground) { this.lastPresenceTrackedAt = 0; supabase.auth.startAutoRefresh(); void this.tick(); }
        else { supabase.auth.stopAutoRefresh(); void this.channel?.untrack(); }
      });
    }
  }

  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private update(patch: Partial<CloudState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((fn) => fn());
  }

  private async restore() {
    try {
      const raw = await AsyncStorage.getItem(OUTBOX);
      this.outbox = raw ? JSON.parse(raw) : [];
      this.update({ pending: this.outbox.length });
      if (!supabase) return;
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      if (data.session) await this.loadMembership();
    } catch (error) { this.fail(error); }
  }

  private fail(error: unknown) {
    this.update({ error: error instanceof Error ? error.message : String((error as any)?.message || error), connected: false });
  }

  private async authenticate() {
    if (!supabase) throw new Error('Supabase is not configured.');
    await this.ready;
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    if (!data.session) {
      const result = await supabase.auth.signInAnonymously();
      if (result.error) throw result.error;
    }
  }

  async createCouple(user: PartnerId) {
    await this.authenticate();
    const { error } = await supabase!.rpc('gym_create_couple', { chosen_partner: user });
    if (error) throw error;
    await this.loadMembership();
  }

  async joinCouple(code: string) {
    if (!/^[a-f0-9]{32}$/i.test(code.trim())) throw new Error('Enter the full 32-character invite code.');
    await this.authenticate();
    const { error } = await supabase!.rpc('gym_join_couple', { code: code.trim() });
    if (error) throw error;
    await this.loadMembership();
  }

  private async loadMembership() {
    const { data, error } = await supabase!.from('gym_members').select('couple_id, partner_id').maybeSingle();
    if (error) throw error;
    if (!data) return;
    const member = data as Member;
    this.cursor = Number(await AsyncStorage.getItem(`GYMCRUSH_CLOUD_CURSOR_${member.couple_id}`)) || 0;
    const room = await supabase!.from('gym_couples').select('invite_code').eq('id', member.couple_id).single();
    if (room.error) throw room.error;
    this.update({ coupleId: member.couple_id, deviceUser: member.partner_id, inviteCode: room.data.invite_code, error: null });
    await this.connect();
  }

  private async connect() {
    if (!supabase || !this.state.coupleId || this.connecting) return;
    if (this.channel && ['joined', 'joining'].includes(this.channel.state)) return;
    this.connecting = true;
    try {
    if (this.channel) await supabase.removeChannel(this.channel);
    this.lastPresenceTrackedAt = 0;
    await supabase.realtime.setAuth();
    this.channel = supabase.channel(`gymcrush:${this.state.coupleId}`, {
      config: { private: true, broadcast: { self: false, ack: true }, presence: { key: this.instanceId } },
    });
    this.channel.on('broadcast', { event: 'couple_sync' }, ({ payload }) => this.receive(payload, false))
      .on('presence', { event: 'sync' }, () => this.presence(this.channel!.presenceState()))
      .on('system', {}, (payload) => {
        if (payload.status === 'error') this.update({ error: payload.message, connected: false });
      })
      .subscribe((status, error) => {
        this.update({ connected: status === 'SUBSCRIBED', ...(error ? { error: error.message } : {}) });
        if (status === 'SUBSCRIBED') void this.tick();
        else this.presence({});
      });
    // Catch-up does not depend on the WebSocket succeeding.
    await this.tick();
    } finally { this.connecting = false; }
  }

  async send(item: SyncEnvelope) {
    await this.ready;
    if (!this.state.coupleId) return;
    if (item.event.type === 'PARTNER_STATUS') {
      if (this.state.connected) await this.channel?.send({ type: 'broadcast', event: 'couple_sync', payload: item });
      return;
    }
    // One serialized storage writer prevents simultaneous sets/reactions losing queue entries.
    this.queueWrite = this.queueWrite.catch(() => {}).then(async () => {
      this.outbox.push(JSON.parse(JSON.stringify(item)));
      await AsyncStorage.setItem(OUTBOX, JSON.stringify(this.outbox));
      this.update({ pending: this.outbox.length });
    });
    await this.queueWrite;
    await this.tick();
  }

  async tick() {
    if (!supabase || this.busy) return;
    if (!this.state.coupleId) {
      if (this.restoringMembership) return;
      this.restoringMembership = true;
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (data.session) await this.loadMembership();
      } catch (error) { this.fail(error); }
      finally { this.restoringMembership = false; }
      return;
    }
    if (this.foreground && this.channel?.state === 'closed' && !this.connecting) {
      void this.connect().catch((error) => this.fail(error));
    }
    this.busy = true;
    try {
      // Presence is rate-limited separately from data writes; do not track on every save.
      if (this.state.connected && this.foreground && Date.now() - this.lastPresenceTrackedAt >= 15000) {
        this.lastPresenceTrackedAt = Date.now();
        await this.channel?.track({
        instanceId: this.instanceId, userId: this.state.deviceUser, platform: Platform.OS, onlineAt: Date.now(),
      });
      }
      // Download independently of uploads: a failed photo must not block the partner's changes.
      await this.catchUp();
      await this.queueWrite;
      let uploadError: unknown = null;
      const blockedMachines = new Set<string>();
      for (const item of [...this.outbox]) {
        if ((item.event.type === 'SETUP_UPDATED' || item.event.type === 'MACHINE_DELETED') && blockedMachines.has(item.event.payload.machineId)) continue;
        try {
        if (item.event.type === 'MACHINE_ADDED') {
          const machine = item.event.payload.machine;
          machine.photoUri = await this.uploadPhoto(machine.photoUri, machine.id);
        }
        const { error } = await supabase.rpc('gym_append_event', { item });
        if (error) throw error;
        // Reapply committed mutable records after catch-up, including the shared photo path.
        if (['MACHINE_ADDED', 'MACHINE_DELETED', 'SETUP_UPDATED', 'SET_CHANGED', 'SESSION_CHANGED', 'PROFILES_UPDATED'].includes(item.event.type)) {
          this.receive({ ...item, id: `committed_${item.id}`, senderInstanceId: 'cloud_ack' }, true);
        }
        if (this.state.connected) await this.channel?.send({ type: 'broadcast', event: 'couple_sync', payload: item });
        // A concurrent enqueue must never be overwritten by a flush write.
        this.queueWrite = this.queueWrite.catch(() => {}).then(async () => {
          this.outbox = this.outbox.filter((queued) => queued.id !== item.id);
          await AsyncStorage.setItem(OUTBOX, JSON.stringify(this.outbox));
          this.update({ pending: this.outbox.length });
        });
        await this.queueWrite;
        } catch (error) {
          uploadError = error;
          if (item.event.type === 'MACHINE_ADDED') blockedMachines.add(item.event.payload.machine.id);
        }
      }
      await this.catchUp();
      if (uploadError) throw uploadError;
      this.update({ error: this.channel?.state === 'joined' ? null : this.state.error, connected: this.channel?.state === 'joined' });
    } catch (error) { this.fail(error); }
    finally { this.busy = false; }
  }

  private async catchUp() {
      let more = true;
      while (more) {
        const { data, error } = await supabase!.from('gym_events').select('seq, envelope')
          .eq('couple_id', this.state.coupleId).gt('seq', this.cursor).order('seq').limit(200);
        if (error) throw error;
        for (const row of data || []) {
          this.receive(row.envelope, row.envelope.timestamp < this.startedAt);
          this.cursor = Number(row.seq);
        }
        await AsyncStorage.setItem(`GYMCRUSH_CLOUD_CURSOR_${this.state.coupleId}`, String(this.cursor));
        more = data?.length === 200;
      }
  }

  async uploadPhoto(uri: string, machineId: string): Promise<string> {
    if (!uri || /^(https?:|supabase:)/.test(uri)) return uri;
    if (!supabase || !this.state.coupleId) throw new Error('Pair your phones before sharing a photo.');
    const bytes = Platform.OS === 'web'
      ? await (await fetch(uri)).arrayBuffer()
      : decode(await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 }));
    const path = `${this.state.coupleId}/${machineId}-${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
    const { error } = await supabase.storage.from('gym-photos').upload(path, bytes, { contentType: 'image/jpeg' });
    if (error && String((error as any).statusCode) !== '409' && error.message !== 'The resource already exists') throw error;
    return `supabase:${path}`;
  }

  async resolvePhoto(uri: string): Promise<string> {
    if (!uri.startsWith('supabase:') || !supabase) return uri;
    const { data, error } = await supabase.storage.from('gym-photos').createSignedUrl(uri.slice(9), 604800);
    if (error) throw error;
    return data.signedUrl;
  }
}
