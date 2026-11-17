import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeModules, Platform } from 'react-native';
import { CloudSync, cloudConfigured } from './cloudSync';
import {
  GymMachine,
  HypeReaction,
  MachineAdjustment,
  PartnerId,
  PartnerLiveStatus,
  WorkoutSetLog,
  PartnerProfile,
} from '../types/gym';

export type SyncEventType =
  | 'SESSION_CHANGED'
  | 'SET_CHANGED'
  | 'MACHINE_DELETED'
  | 'SET_LOGGED'
  | 'HYPE_REACTION'
  | 'PARTNER_STATUS'
  | 'MACHINE_ADDED'
  | 'SETUP_UPDATED'
  | 'SESSION_STARTED'
  | 'SESSION_FINISHED';

export interface SetLoggedPayload {
  set: WorkoutSetLog;
}

export interface HypeReactionPayload {
  reaction: HypeReaction;
}

export interface PartnerStatusPayload {
  status: PartnerLiveStatus;
}

export interface MachineAddedPayload {
  machine: GymMachine;
}

export interface SetupUpdatedPayload {
  machineId: string;
  partnerId: PartnerId;
  seatPosition: string;
  pinOrPadNote: string;
  adjustments?: MachineAdjustment[];
}

export interface SessionStartedPayload {
  startedAt: number;
  startedBy: PartnerId;
  startedByName: string;
  routineTitle?: string;
}

export interface SessionFinishedPayload {
  finishedBy: PartnerId;
  finishedByName: string;
  durationSeconds: number;
  startedAt?: string;
  title?: string;
  workoutId?: string;
  finishedAt?: string;
  participants?: PartnerId[];
}

export type SyncEvent =
  | { type: 'SESSION_CHANGED'; payload: { workoutId: string; title: string | null } }
  | { type: 'SET_CHANGED'; payload: { setId: string; set: WorkoutSetLog | null } }
  | { type: 'MACHINE_DELETED'; payload: { machineId: string } }
  | { type: 'SET_LOGGED'; payload: SetLoggedPayload }
  | { type: 'HYPE_REACTION'; payload: HypeReactionPayload }
  | { type: 'PARTNER_STATUS'; payload: PartnerStatusPayload }
  | { type: 'MACHINE_ADDED'; payload: MachineAddedPayload }
  | { type: 'SETUP_UPDATED'; payload: SetupUpdatedPayload }
  | { type: 'SESSION_STARTED'; payload: SessionStartedPayload }
  | { type: 'SESSION_FINISHED'; payload: SessionFinishedPayload }
  | { type: 'PROFILES_UPDATED'; payload: { profiles: Record<PartnerId, PartnerProfile> } };

export interface SyncEnvelope {
  id: string;
  senderInstanceId: string;
  senderPlatform: string;
  timestamp: number;
  event: SyncEvent;
}

export interface SyncConnectionStatus {
  isPartnerOnline: boolean;
  isCloudConnected: boolean;
}

type EventListener = (event: SyncEvent, historical?: boolean) => void;
type ConnectionListener = (isPartnerOnline: boolean, status: SyncConnectionStatus) => void;

const isUser = (value: unknown): value is PartnerId => value === 'markus' || value === 'partner';
const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
function validEnvelope(value: any): value is SyncEnvelope {
  if (!value || typeof value.id !== 'string' || !value.id || typeof value.senderInstanceId !== 'string' || !isNumber(value.timestamp)) return false;
  const event = value.event;
  const payload = event?.payload;
  if (!payload || typeof payload !== 'object') return false;
  switch (event.type) {
    case 'SESSION_CHANGED': return typeof payload.workoutId === 'string' && !!payload.workoutId &&
      (payload.title === null || (typeof payload.title === 'string' && !!payload.title.trim() && payload.title.length <= 120));
    case 'MACHINE_DELETED': return typeof payload.machineId === 'string';
    case 'SET_CHANGED': return typeof payload.setId === 'string' && (payload.set === null || (payload.set?.id === payload.setId && isNumber(payload.set.weight) && payload.set.weight >= 0 && Number.isSafeInteger(payload.set.reps) && payload.set.reps > 0));
    case 'SET_LOGGED': {
      const set = payload.set;
      return Boolean(set && typeof set.id === 'string' && typeof set.workoutId === 'string' &&
        typeof set.machineId === 'string' && typeof set.machineName === 'string' && isUser(set.userId) &&
        isNumber(set.weight) && set.weight >= 0 && Number.isSafeInteger(set.reps) && set.reps > 0 &&
        Number.isSafeInteger(set.setNumber) && set.setNumber > 0 && ['kg', 'lbs'].includes(set.unit) &&
        Number.isFinite(Date.parse(set.loggedAt)));
    }
    case 'HYPE_REACTION': {
      const reaction = payload.reaction;
      return Boolean(reaction && typeof reaction.id === 'string' && typeof reaction.message === 'string' &&
        isUser(reaction.fromUser) && isUser(reaction.toUser) && ['🔥','💪','❤️','👑','👀','💧'].includes(reaction.emoji));
    }
    case 'PARTNER_STATUS':
      return Boolean(payload.status && isUser(payload.status.userId) && isNumber(payload.status.restSecondsRemaining) &&
        isNumber(payload.status.currentSetNumber) && Number.isFinite(Date.parse(payload.status.lastUpdated)) &&
        (payload.status.sessionMachineIds === undefined || (Array.isArray(payload.status.sessionMachineIds) && payload.status.sessionMachineIds.every((id: unknown) => typeof id === 'string'))));
    case 'MACHINE_ADDED':
      return Boolean(payload.machine && typeof payload.machine.id === 'string' && typeof payload.machine.name === 'string' &&
        typeof payload.machine.photoUri === 'string' && payload.machine.partnerSetups?.markus && payload.machine.partnerSetups?.partner);
    case 'SETUP_UPDATED':
      return typeof payload.machineId === 'string' && isUser(payload.partnerId) && typeof payload.seatPosition === 'string' &&
        typeof payload.pinOrPadNote === 'string' && (payload.adjustments === undefined || (Array.isArray(payload.adjustments) &&
          payload.adjustments.every((item: any) => item && typeof item.label === 'string' && typeof item.value === 'string')));
    case 'SESSION_STARTED':
      return isNumber(payload.startedAt) && payload.startedAt > 0 && isUser(payload.startedBy) && typeof payload.startedByName === 'string';
    case 'SESSION_FINISHED':
      return isUser(payload.finishedBy) && isNumber(payload.durationSeconds) && payload.durationSeconds >= 0 &&
        (payload.finishedAt === undefined || Number.isFinite(Date.parse(payload.finishedAt))) &&
        (payload.startedAt === undefined || Number.isFinite(Date.parse(payload.startedAt))) &&
        (payload.title === undefined || typeof payload.title === 'string') &&
        (payload.participants === undefined || (Array.isArray(payload.participants) && payload.participants.every(isUser)));
    case 'PROFILES_UPDATED':
      return ['markus', 'partner'].every((user) => {
        const profile = payload.profiles?.[user];
        return profile && typeof profile.name === 'string' && ['kg', 'lbs'].includes(profile.unit) &&
          isNumber(profile.weeklyGoal) && profile.weeklyGoal >= 1 && profile.weeklyGoal <= 7;
      });
    default: return false;
  }
}

class RealtimeSyncEngine {
  public cloud: CloudSync | null = null;
  private instanceId: string;
  private currentUserId: PartnerId = Platform.OS === 'ios' ? 'partner' : 'markus';
  private webBroadcastChannel: any = null;
  private listeners: Set<EventListener> = new Set();
  private connectionListeners: Set<ConnectionListener> = new Set();
  private processedEventIds: Set<string> = new Set();
  private statusSequence = 0;
  private pollingTimer: ReturnType<typeof setInterval> | null = null;
  private httpRelayTimer: ReturnType<typeof setInterval> | null = null;
  private workingRelayUrl: string | null = null;
  private lastRelaySeq: number = 0;
  private lastSyncedSessionStart: number | null = null;
  private isSupabaseOnline: boolean = false;
  private isHttpRelayOnline: boolean = false;
  private isPartnerOnline: boolean = false;
  private isLocalBridgeActive: boolean = false;

  constructor() {
    this.instanceId = `inst_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    this.init();
  }

  public init(): void {
    if (cloudConfigured) {
      this.cloud = new CloudSync(this.instanceId,
        (item, historical) => this.handleIncomingEnvelope(item, historical),
        (presence) => {
          const user = this.cloud?.getSnapshot().deviceUser;
          this.isPartnerOnline = Object.values(presence).flat().some((p) =>
            p.instanceId !== this.instanceId && p.userId !== user && Date.now() - p.onlineAt < 35000);
          this.notifyConnectionState();
        });
      this.cloud.subscribe(() => {
        this.isSupabaseOnline = this.cloud!.getSnapshot().connected;
        this.notifyConnectionState();
      });
      return;
    }
    // Local bridges are development tools, never a production cloud fallback.
    if (typeof __DEV__ !== 'undefined' && !__DEV__) return;
    this.initWebBroadcast();
    this.initAsyncStorageBridge();
    this.initHttpRelayBridge();
  }

  public setCurrentUser(user: PartnerId): void {
    if (this.currentUserId !== user) {
      this.currentUserId = user;
    }
  }

  private hasProcessed(id: string): boolean {
    return this.processedEventIds.has(id);
  }

  private markProcessed(id: string): void {
    this.processedEventIds.add(id);
    if (this.processedEventIds.size > 500) {
      const oldest = this.processedEventIds.values().next().value;
      if (oldest) {
        this.processedEventIds.delete(oldest);
      }
    }
  }

  private getRelayCandidateUrls(): string[] {
    const dynamicUrls: string[] = [];
    try {
      const scriptURL: string | undefined = (NativeModules as any)?.SourceCode?.scriptURL;
      if (typeof scriptURL === 'string' && scriptURL.startsWith('http')) {
        const match = scriptURL.match(/^(https?:\/\/[^/:]+)(?::(\d+))?/);
        if (match && match[1]) {
          const hostBase = match[1];
          const port = match[2];
          dynamicUrls.push(`${hostBase}:8787`);
          if (port) {
            dynamicUrls.push(`${hostBase}:${port}`);
          }
        }
      }
    } catch {
      // Ignore NativeModules inspection errors
    }

    const defaults =
      Platform.OS === 'android'
        ? [
            'http://10.0.2.2:8787',
            'http://10.0.2.2:8081',
            'http://localhost:8787',
            'http://localhost:8081',
          ]
        : [
            'http://localhost:8787',
            'http://localhost:8081',
            'http://127.0.0.1:8787',
            'http://10.0.2.2:8787',
          ];

    const ordered = this.workingRelayUrl
      ? [this.workingRelayUrl, ...dynamicUrls, ...defaults]
      : [...dynamicUrls, ...defaults];

    return Array.from(new Set(ordered));
  }

  private isRelayDisabled(): boolean {
    // Never touch the live relay from the Node test runner
    try {
      return typeof process !== 'undefined' && Boolean(process.env?.NODE_TEST_CONTEXT);
    } catch {
      return false;
    }
  }

  private async fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 1500): Promise<Response> {
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
    try {
      return await fetch(url, controller ? { ...init, signal: controller.signal } : init);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  private relayPollInFlight = false;
  private hasCompletedFirstRelayPoll = false;

  private initHttpRelayBridge(): void {
    if (this.httpRelayTimer) {
      clearInterval(this.httpRelayTimer);
      this.httpRelayTimer = null;
    }
    if (this.isRelayDisabled()) return;

    this.httpRelayTimer = setInterval(async () => {
      if (typeof fetch !== 'function' || this.relayPollInFlight) return;
      this.relayPollInFlight = true;
      let reachedAny = false;
      const candidates = this.getRelayCandidateUrls();
      try {
        for (const baseUrl of candidates) {
          try {
            const res = await this.fetchWithTimeout(
              `${baseUrl}/__gymcrush_sync?since=${this.lastRelaySeq}&instance=${encodeURIComponent(this.instanceId)}&user=${encodeURIComponent(this.currentUserId)}&platform=${encodeURIComponent(Platform.OS)}`,
              { method: 'GET', headers: { Accept: 'application/json' } }
            );
            if (!res || !res.ok) continue;
            const data: any = await res.json();
            if (!data || !data.ok) continue;
            reachedAny = true;

            this.workingRelayUrl = baseUrl;
            if (!this.isHttpRelayOnline) {
              this.isHttpRelayOnline = true;
              this.notifyConnectionState();
            }

            // Track partner presence via relay activePeers if Supabase presence isn't active
            if (!this.isSupabaseOnline && Array.isArray(data.activePeers)) {
              const partnerPeer = data.activePeers.some(
                (p: any) =>
                  p &&
                  p.instanceId !== this.instanceId &&
                  p.userId !== this.currentUserId
              );
              if (this.isPartnerOnline !== partnerPeer) {
                this.isPartnerOnline = partnerPeer;
                this.notifyConnectionState();
              }
            }

            const isFirstPoll = !this.hasCompletedFirstRelayPoll;
            this.hasCompletedFirstRelayPoll = true;

            if (typeof data.seq === 'number') {
              // Relay restarted with a fresh room -> reset cursor
              if (data.seq < this.lastRelaySeq) this.lastRelaySeq = 0;
              this.lastRelaySeq = Math.max(this.lastRelaySeq, data.seq);
            }

            // On first connect skip the historical backlog (old sessions / toasts);
            // the current shared workout state comes from the sharedSession snapshot below.
            if (!isFirstPoll && Array.isArray(data.events)) {
              for (const envelope of data.events) {
                this.handleIncomingEnvelope(envelope as SyncEnvelope);
              }
            }

          const sharedSession = data.sharedSession;
          if (sharedSession && sharedSession.isActive && typeof sharedSession.startedAt === 'number') {
            if (this.lastSyncedSessionStart !== sharedSession.startedAt) {
              this.lastSyncedSessionStart = sharedSession.startedAt;
              const syntheticEnvelope: SyncEnvelope = {
                id: `evt_shared_session_${sharedSession.startedAt}`,
                senderInstanceId: 'relay_shared_session',
                senderPlatform: 'relay',
                timestamp: Date.now(),
                event: {
                  type: 'SESSION_STARTED',
                  payload: {
                    startedAt: sharedSession.startedAt,
                    startedBy: (sharedSession.startedBy as PartnerId) || 'markus',
                    startedByName: sharedSession.startedByName || 'Partner',
                  },
                },
              };
              this.handleIncomingEnvelope(syntheticEnvelope);
            }
          } else if (sharedSession && !sharedSession.isActive) {
            this.lastSyncedSessionStart = null;
          }

            break;
          } catch {
            // Try next candidate or wait for next tick
          }
        }
      } finally {
        if (!reachedAny && this.isHttpRelayOnline) {
          this.isHttpRelayOnline = false;
          this.workingRelayUrl = null;
          this.notifyConnectionState();
        }
        this.relayPollInFlight = false;
      }
    }, 750);
  }

  private async postToHttpRelay(envelope: SyncEnvelope): Promise<void> {
    if (typeof fetch !== 'function' || this.isRelayDisabled()) return;
    const candidates = this.getRelayCandidateUrls();
    for (const baseUrl of candidates) {
      try {
        const res = await this.fetchWithTimeout(`${baseUrl}/__gymcrush_sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(envelope),
        });
        if (res && res.ok) {
          this.workingRelayUrl = baseUrl;
          if (!this.isHttpRelayOnline) {
            this.isHttpRelayOnline = true;
            this.notifyConnectionState();
          }
          return;
        }
      } catch {
        // Silently ignore offline/unreachable candidate in dev/test
      }
    }
  }

  private initWebBroadcast(): void {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        const BC = (window as unknown as { BroadcastChannel: typeof BroadcastChannel }).BroadcastChannel;
        this.webBroadcastChannel = new BC('gymcrush-couple-room');
        this.webBroadcastChannel.onmessage = (ev: MessageEvent) => {
          if (ev.data) {
            this.handleIncomingEnvelope(ev.data as SyncEnvelope);
          }
        };
      } catch (err) {
        console.warn('[SyncEngine] BroadcastChannel error:', err);
      }
    }
  }

  private initAsyncStorageBridge(): void {
    this.isLocalBridgeActive = true;
    this.notifyConnectionState();

    // Poll AsyncStorage every 700ms for events written by another tab / simulator / app instance
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }

    this.pollingTimer = setInterval(async () => {
      try {
        if (typeof window === 'undefined' && Platform.OS === 'web') return;
        const raw = await AsyncStorage.getItem('GYMCRUSH_SYNC_LAST_EVENT');
        if (!raw) return;
        const envelope: SyncEnvelope = JSON.parse(raw);
        if (
          envelope &&
          envelope.id &&
          envelope.senderInstanceId !== this.instanceId &&
          !this.hasProcessed(envelope.id)
        ) {
          // Verify freshness (within 2 minutes)
          const now = Date.now();
          if (
            typeof envelope.timestamp === 'number' &&
            now - envelope.timestamp < 120000 &&
            now - envelope.timestamp >= -5000
          ) {
            this.handleIncomingEnvelope(envelope);
          }
        }
      } catch {
        // Ignore parse or storage errors in polling tick
      }
    }, 700);
  }

  private handleIncomingEnvelope(envelope: SyncEnvelope, historical = false): void {
    if (!validEnvelope(envelope)) return;
    if (envelope.senderInstanceId === this.instanceId) return; // avoid self-echo
    if (this.hasProcessed(envelope.id)) return; // avoid duplicate

    this.markProcessed(envelope.id);

    if (envelope.event.type === 'SESSION_STARTED' && envelope.event.payload?.startedAt) {
      this.lastSyncedSessionStart = envelope.event.payload.startedAt;
    } else if (envelope.event.type === 'SESSION_FINISHED') {
      this.lastSyncedSessionStart = null;
    }

    for (const listener of this.listeners) {
      try {
        listener(envelope.event, historical);
      } catch (err) {
        console.error('[SyncEngine] Listener error:', err);
      }
    }
  }

  public async broadcast(event: SyncEvent): Promise<void> {
    const envelope: SyncEnvelope = {
      id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      senderInstanceId: this.instanceId,
      senderPlatform: Platform.OS,
      timestamp: Date.now(),
      event,
    };

    if (event.type === 'PARTNER_STATUS') {
      envelope.event = { type: 'PARTNER_STATUS', payload: { status: {
        ...event.payload.status, sourceInstanceId: this.instanceId, sequence: ++this.statusSequence,
      } } };
    }

    this.markProcessed(envelope.id);

    if (this.cloud) {
      await this.cloud.send(envelope);
      return;
    }

    if (event.type === 'SESSION_STARTED' && event.payload?.startedAt) {
      this.lastSyncedSessionStart = event.payload.startedAt;
    } else if (event.type === 'SESSION_FINISHED') {
      this.lastSyncedSessionStart = null;
    }

    // 2. Web BroadcastChannel (for browser tabs side-by-side)
    if (this.webBroadcastChannel) {
      try {
        this.webBroadcastChannel.postMessage(envelope);
      } catch (err) {
        console.warn('[SyncEngine] Web BroadcastChannel post failed:', err);
      }
    }

    // 3. AsyncStorage Bridge (for multi-process / multi-instance local sharing)
    try {
      await AsyncStorage.setItem('GYMCRUSH_SYNC_LAST_EVENT', JSON.stringify(envelope));
    } catch (err) {
      console.warn('[SyncEngine] AsyncStorage bridge write failed:', err);
    }

    // 4. Cross-Device HTTP Relay Bridge (Android Emulator <-> iOS Simulator <-> LAN)
    void this.postToHttpRelay(envelope);
  }

  public subscribe(listener: EventListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public onConnectionChange(listener: ConnectionListener): () => void {
    this.connectionListeners.add(listener);
    listener(this.isPartnerConnected(), {
      isPartnerOnline: this.isPartnerOnline,
      isCloudConnected: this.isCloudConnected(),
    });
    return () => {
      this.connectionListeners.delete(listener);
    };
  }

  public isConnected(): boolean {
    return this.isSupabaseOnline || this.isHttpRelayOnline || this.isLocalBridgeActive;
  }

  public isCloudConnected(): boolean {
    return this.isSupabaseOnline || this.isHttpRelayOnline;
  }

  public isPartnerConnected(): boolean {
    return this.isPartnerOnline;
  }

  /** True only when partner is actively present on the other phone. */
  public isCrossDeviceConnected(): boolean {
    return this.isPartnerOnline;
  }

  public getRelayUrl(): string | null {
    return this.workingRelayUrl;
  }

  public isSupabaseActive(): boolean {
    return this.isSupabaseOnline;
  }

  public getInstanceId(): string {
    return this.instanceId;
  }

  private notifyConnectionState(): void {
    const isPartnerOnline = this.isPartnerOnline;
    const status: SyncConnectionStatus = {
      isPartnerOnline,
      isCloudConnected: this.isCloudConnected(),
    };
    for (const listener of this.connectionListeners) {
      try {
        listener(isPartnerOnline, status);
      } catch (err) {
        console.error('[SyncEngine] Connection listener error:', err);
      }
    }
  }

  public cleanup(): void {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
    if (this.httpRelayTimer) {
      clearInterval(this.httpRelayTimer);
      this.httpRelayTimer = null;
    }
    if (this.webBroadcastChannel) {
      try {
        this.webBroadcastChannel.close();
      } catch {}
      this.webBroadcastChannel = null;
    }
    this.listeners.clear();
    this.connectionListeners.clear();
  }
}

export const syncEngine = new RealtimeSyncEngine();
