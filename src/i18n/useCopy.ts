import { useGymCrushStore } from '../store/useGymCrushStore';

/** Inline bilingual copy: `const c = useCopy(); c('Finish', '結束訓練')`. */
export function useCopy() {
  const { language } = useGymCrushStore();
  return (en: string, zh: string) => (language === 'zh-TW' ? zh : en);
}

/** English count with singular/plural noun: plural(1, 'set', 'sets') → "1 set". */
export const plural = (n: number, one: string, other: string) => `${n} ${n === 1 ? one : other}`;
