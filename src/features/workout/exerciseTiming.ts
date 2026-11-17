import { ExerciseTiming, Language, WorkoutSetLog } from '../../types/gym';

export interface ExerciseTimingAnalytics {
  machineId: string;
  startedAt?: string;
  endedAt?: string;
  durationSeconds?: number;
  avgSetSeconds?: number;
  avgBreakSeconds?: number;
  breaksSeconds: number[];
  timeSincePreviousExerciseSeconds?: number;
  setCount: number;
}

/** Formats local phone time without relying on Hermes Intl locale behavior. */
export function formatClockTime(value: string | number | undefined, language: Language): string {
  if (value === undefined || value === '') return '';
  const ms = typeof value === 'number' ? value : Date.parse(value);
  if (!Number.isFinite(ms)) return '';
  const d = new Date(ms);
  const h24 = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  if (language === 'zh-TW') {
    const period = h24 < 12 ? '上午' : '下午';
    const h12 = h24 % 12 || 12;
    return `${period} ${h12}:${m}`;
  }
  const period = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 || 12;
  return `${h12}:${m} ${period}`;
}

/** Compact duration label for gym metrics: 45s, 1m 30s, 1h 05m. */
export function formatShortDuration(seconds?: number): string {
  if (seconds === undefined || !Number.isFinite(seconds)) return '';
  const safe = Math.max(0, Math.round(seconds));
  if (safe < 60) return `${safe}s`;
  const hours = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  if (hours > 0) return `${hours}h ${String(mins).padStart(2, '0')}m`;
  if (secs === 0) return `${mins}m`;
  return `${mins}m ${secs}s`;
}

function validTimestampMs(value?: string): number | undefined {
  if (!value) return undefined;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : undefined;
}

/**
 * Computes per-exercise timing analytics for a workout (start/end time, avg time per set,
 * break durations between sets, and transition time between consecutive exercises).
 */
export function computeWorkoutExerciseAnalytics(
  sets: WorkoutSetLog[],
  machineIds: string[],
  exerciseTimings?: Record<string, ExerciseTiming>,
  workoutStartedAt?: string,
): ExerciseTimingAnalytics[] {
  const orderedIds: string[] = [];
  const seen = new Set<string>();
  for (const id of machineIds) {
    if (!seen.has(id)) {
      seen.add(id);
      orderedIds.push(id);
    }
  }
  for (const s of sets) {
    if (!seen.has(s.machineId)) {
      seen.add(s.machineId);
      orderedIds.push(s.machineId);
    }
  }

  const baseItems = orderedIds.map((machineId, originalIndex) => {
    const machineSets = sets
      .filter((s) => s.machineId === machineId)
      .sort((a, b) => Date.parse(a.loggedAt) - Date.parse(b.loggedAt));

    const explicit = exerciseTimings?.[machineId];
    const startCandidates = [
      validTimestampMs(explicit?.startedAt),
      ...machineSets.map((s) => validTimestampMs(s.exerciseStartedAt)),
      validTimestampMs(machineSets[0]?.startedAt),
      validTimestampMs(machineSets[0]?.loggedAt),
    ].filter((v): v is number => v !== undefined);

    if (startCandidates.length === 0 && originalIndex === 0) {
      const ws = validTimestampMs(workoutStartedAt);
      if (ws !== undefined) startCandidates.push(ws);
    }

    const startedMs = startCandidates.length > 0 ? Math.min(...startCandidates) : undefined;
    const lastSetLoggedMs = machineSets.length > 0 ? validTimestampMs(machineSets[machineSets.length - 1].loggedAt) : undefined;
    const explicitEndMs = validTimestampMs(explicit?.endedAt);
    const endedMs = lastSetLoggedMs ?? explicitEndMs;

    const durationSeconds =
      startedMs !== undefined && endedMs !== undefined
        ? Math.max(0, Math.round((endedMs - startedMs) / 1000))
        : undefined;

    const breaksSeconds: number[] = [];
    const activeSetDurations: number[] = [];

    for (let i = 0; i < machineSets.length; i++) {
      const curr = machineSets[i];
      const currLogged = validTimestampMs(curr.loggedAt);
      const currStarted = validTimestampMs(curr.startedAt);
      if (currLogged !== undefined && currStarted !== undefined && currLogged > currStarted) {
        activeSetDurations.push(Math.round((currLogged - currStarted) / 1000));
      }

      if (i > 0) {
        const prevLogged = validTimestampMs(machineSets[i - 1].loggedAt);
        if (prevLogged !== undefined && currLogged !== undefined) {
          if (currStarted !== undefined && currStarted > prevLogged && currStarted <= currLogged) {
            breaksSeconds.push(Math.max(0, Math.round((currStarted - prevLogged) / 1000)));
          } else {
            breaksSeconds.push(Math.max(0, Math.round((currLogged - prevLogged) / 1000)));
          }
        }
      }
    }

    let avgSetSeconds: number | undefined;
    if (activeSetDurations.length > 0) {
      avgSetSeconds = Math.round(activeSetDurations.reduce((a, b) => a + b, 0) / activeSetDurations.length);
    } else if (durationSeconds !== undefined && machineSets.length > 0 && durationSeconds > 0) {
      avgSetSeconds = Math.round(durationSeconds / machineSets.length);
    } else if (machineSets.length >= 2) {
      const firstMs = validTimestampMs(machineSets[0].loggedAt);
      const lastMs = validTimestampMs(machineSets[machineSets.length - 1].loggedAt);
      if (firstMs !== undefined && lastMs !== undefined && lastMs > firstMs) {
        avgSetSeconds = Math.round((lastMs - firstMs) / (machineSets.length - 1));
      }
    }

    const avgBreakSeconds =
      breaksSeconds.length > 0
        ? Math.round(breaksSeconds.reduce((a, b) => a + b, 0) / breaksSeconds.length)
        : undefined;

    return {
      machineId,
      originalIndex,
      machineSets,
      startedMs,
      endedMs,
      startedAt: startedMs !== undefined ? new Date(startedMs).toISOString() : undefined,
      endedAt: endedMs !== undefined ? new Date(endedMs).toISOString() : undefined,
      durationSeconds,
      avgSetSeconds,
      avgBreakSeconds,
      breaksSeconds,
      setCount: machineSets.length,
    };
  });

  // Order chronologically by first logged set or start time, falling back to original list order.
  baseItems.sort((a, b) => {
    const aTime = validTimestampMs(a.machineSets[0]?.loggedAt) ?? a.startedMs;
    const bTime = validTimestampMs(b.machineSets[0]?.loggedAt) ?? b.startedMs;
    if (aTime !== undefined && bTime !== undefined && aTime !== bTime) return aTime - bTime;
    if (aTime !== undefined && bTime === undefined) return -1;
    if (aTime === undefined && bTime !== undefined) return 1;
    return a.originalIndex - b.originalIndex;
  });

  return baseItems.map((item, idx) => {
    let timeSincePreviousExerciseSeconds: number | undefined;
    if (idx > 0) {
      const prevEndedMs = baseItems[idx - 1].endedMs;
      if (prevEndedMs !== undefined) {
        const candidateMs =
          item.startedMs !== undefined && item.startedMs >= prevEndedMs
            ? item.startedMs
            : validTimestampMs(item.machineSets[0]?.startedAt) ?? validTimestampMs(item.machineSets[0]?.loggedAt);
        if (candidateMs !== undefined && candidateMs >= prevEndedMs) {
          timeSincePreviousExerciseSeconds = Math.round((candidateMs - prevEndedMs) / 1000);
        }
      }
    }

    return {
      machineId: item.machineId,
      startedAt: item.startedAt,
      endedAt: item.endedAt,
      durationSeconds: item.durationSeconds,
      avgSetSeconds: item.avgSetSeconds,
      avgBreakSeconds: item.avgBreakSeconds,
      breaksSeconds: item.breaksSeconds,
      timeSincePreviousExerciseSeconds,
      setCount: item.setCount,
    };
  });
}
