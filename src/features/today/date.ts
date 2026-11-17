import type { Language } from '../../types/gym';

const ZH_DAYS = ['日', '一', '二', '三', '四', '五', '六'];

/** "Sun, Nov 8" / "11月8日（週日）". zh is formatted by hand so it never depends on Hermes Intl data. */
export function formatShortDate(date: Date | string | number, language: Language): string {
  const d = new Date(date);
  if (language === 'zh-TW') return `${d.getMonth() + 1}月${d.getDate()}日（週${ZH_DAYS[d.getDay()]}）`;
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}
