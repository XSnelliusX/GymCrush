/**
 * Pure rest-timer and plate-math helpers (no imports: tests load this file with a plain TS transpile).
 * The floating rest UI lives in src/features/workout/RestPanel.tsx.
 */
export interface PlateCount {
  plate: number;
  count: number;
}

const KG_PLATES = [20, 15, 10, 5, 2.5, 1.25];
const LBS_PLATES = [45, 35, 25, 10, 5, 2.5];

export function calculatePlatesPerSide(
  totalWeight: number,
  barWeight: number,
  unit: 'kg' | 'lbs' = 'kg'
): { plates: PlateCount[]; perSideWeight: number; remainder: number } {
  const safeTotal =
    typeof totalWeight === 'number' && !Number.isNaN(totalWeight) && Number.isFinite(totalWeight)
      ? Math.max(0, totalWeight)
      : 0;
  const safeBar =
    typeof barWeight === 'number' && !Number.isNaN(barWeight) && Number.isFinite(barWeight)
      ? Math.max(0, barWeight)
      : 0;
  const effectiveLoad = Math.max(0, safeTotal - safeBar);
  const perSideWeight = effectiveLoad / 2;
  let remaining = perSideWeight;
  const availablePlates = unit === 'kg' ? KG_PLATES : LBS_PLATES;
  const plates: PlateCount[] = [];

  for (const plate of availablePlates) {
    if (remaining >= plate - 0.001) {
      const count = Math.floor((remaining + 0.001) / plate);
      if (count > 0) {
        plates.push({ plate, count });
        remaining = Math.max(0, Number((remaining - count * plate).toFixed(2)));
      }
    }
  }

  return {
    plates,
    perSideWeight: Number(perSideWeight.toFixed(2)),
    remainder: Number(remaining.toFixed(2)),
  };
}

export function formatPlatesList(plates: PlateCount[], unit: 'kg' | 'lbs' = 'kg'): string {
  if (!Array.isArray(plates) || plates.length === 0) {
    return 'Empty bar / sled';
  }
  return plates.map((p) => `${p.count}×${p.plate}${unit}`).join(' + ');
}

export function formatTime(totalSeconds: number, padMinutes = false): string {
  const safeSeconds =
    typeof totalSeconds === 'number' && !Number.isNaN(totalSeconds) && Number.isFinite(totalSeconds)
      ? Math.max(0, Math.floor(totalSeconds))
      : 0;
  const mins = Math.floor(safeSeconds / 60);
  const secs = safeSeconds % 60;
  const minsStr = padMinutes ? String(mins).padStart(2, '0') : String(mins);
  const secsStr = String(secs).padStart(2, '0');
  return `${minsStr}:${secsStr}`;
}

export function computePlateDelta(
  markusWeight: number,
  partnerWeight: number,
  unit: 'kg' | 'lbs' = 'kg',
  markusName = 'Markus',
  partnerName = 'Abby'
): {
  totalDelta: number;
  perSideDelta: number;
  plates: PlateCount[];
  action: 'same' | 'strip' | 'load';
  summary: string;
} {
  const safeMarkus =
    typeof markusWeight === 'number' && !Number.isNaN(markusWeight) && Number.isFinite(markusWeight)
      ? Math.max(0, markusWeight)
      : 0;
  const safePartner =
    typeof partnerWeight === 'number' && !Number.isNaN(partnerWeight) && Number.isFinite(partnerWeight)
      ? Math.max(0, partnerWeight)
      : 0;

  const totalDelta = Number((safeMarkus - safePartner).toFixed(2));
  const perSideDelta = Number((Math.abs(totalDelta) / 2).toFixed(2));
  const deltaBreakdown = calculatePlatesPerSide(Math.abs(totalDelta), 0, unit);

  if (totalDelta === 0) {
    return {
      totalDelta: 0,
      perSideDelta: 0,
      plates: [],
      action: 'same',
      summary: `Identical load — zero plate changes between ${markusName} & ${partnerName}.`,
    };
  }

  const action = totalDelta > 0 ? 'strip' : 'load';
  const verb = totalDelta > 0 ? 'Strip' : 'Load';
  return {
    totalDelta,
    perSideDelta,
    plates: deltaBreakdown.plates,
    action,
    summary: `${markusName} → ${partnerName}: ${verb} ${perSideDelta} ${unit}/side (${formatPlatesList(
      deltaBreakdown.plates,
      unit
    )})`,
  };
}

export function restProgress(remaining: number, duration: number): number {
  return duration > 0 ? Math.max(0, Math.min(1, 1 - remaining / duration)) : 1;
}
