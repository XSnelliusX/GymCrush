import * as ImagePicker from 'expo-image-picker';
import { saveMachinePhoto } from '../../services/photos';
import { t } from '../../i18n/translations';
import { GymMachine, Language, MachineAdjustment, MuscleGroup, PartnerId } from '../../types/gym';

export const MUSCLE_GROUPS: MuscleGroup[] = ['Chest', 'Back', 'Legs', 'Glutes', 'Shoulders', 'Arms', 'Core', 'Full Body'];
export const MAX_SETTINGS = 5;

export function defaultAdjustmentLabel(idx: number, language: Language): string {
  const tr = t(language);
  return idx === 0 ? tr.adjustment1Default : idx === 1 ? tr.adjustment2Default : idx === 2 ? tr.adjustment3Default : `${tr.settingNumberLabel} ${idx + 1}`;
}

export const machineName = (m: GymMachine, language: Language) =>
  (language === 'zh-TW' ? m.nameZh || m.name : m.name || m.nameZh) || '';

export const machineLocation = (m: GymMachine, language: Language) =>
  (language === 'zh-TW' && m.locationNoteZh ? m.locationNoteZh : m.locationNote) || '';

/** A partner's adjustments, falling back to the legacy seatPosition / pinOrPadNote fields (same as the old catalog). */
export function resolveAdjustments(m: GymMachine, pid: PartnerId, language: Language): MachineAdjustment[] {
  const setup = m.partnerSetups?.[pid];
  if (Array.isArray(setup?.adjustments)) {
    return setup.adjustments.map((a, idx) => ({
      id: a.id || `adj-${idx + 1}`,
      label: a.label || m.adjustmentLabels?.[idx] || defaultAdjustmentLabel(idx, language),
      value: a.value || '1',
    }));
  }
  const first = { id: 'adj-1', label: m.adjustmentLabels?.[0] || defaultAdjustmentLabel(0, language), value: setup?.seatPosition || '5' };
  if (!setup?.pinOrPadNote) return [first];
  return [first, { id: 'adj-2', label: m.adjustmentLabels?.[1] || defaultAdjustmentLabel(1, language), value: setup.pinOrPadNote }];
}

/** "Seat Height 5 · Pad / Pin 3" */
// Values that already carry words ("Pin 3 (Mid grip)") stand alone; bare numbers get their label ("Seat 5").
export const settingsSummary = (adjs: Pick<MachineAdjustment, 'label' | 'value'>[]) => adjs.map((a) => (/\p{L}/u.test(a.value) ? a.value : `${a.label} ${a.value}`)).join(' · ');

/** Same cleanup the old adjustments editor ran before updatePartnerSetup. */
export function sanitizeAdjustments(adjs: MachineAdjustment[], language: Language): MachineAdjustment[] {
  return adjs.map((a, idx) => ({
    id: a.id || `adj-${idx + 1}`,
    label: a.label.trim() || defaultAdjustmentLabel(idx, language),
    value: a.value.trim() || (idx === 0 ? '5' : '3'),
  }));
}

export type PhotoResult = { uri: string } | 'denied' | 'unavailable' | null;

/** Camera or library → 4:3 crop → saveMachinePhoto. null = user cancelled. */
export async function pickMachinePhoto(source: 'camera' | 'library', onSaving?: () => void): Promise<PhotoResult> {
  try {
    const permission = source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return 'denied';
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: true, aspect: [4, 3], quality: 0.85 };
    const result = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    if (result.canceled || !result.assets?.length) return null;
    onSaving?.(); // only now is there something to save
    return { uri: await saveMachinePhoto(result.assets[0].uri) };
  } catch {
    return 'unavailable';
  }
}
