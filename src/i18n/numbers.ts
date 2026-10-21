/**
 * Число текстом по правилам языка: разделители разрядов и дробной части.
 * Без числа знаков после запятой — до трёх, без хвостовых нулей (0,055; 317,8; 333 000).
 */
export type NumberText = (value: number, fractionDigits?: number) => string;

const formatters = new Map<string, Intl.NumberFormat>();

function formatter(locale: string, fractionDigits: number | undefined): Intl.NumberFormat {
  const key = `${locale}|${fractionDigits ?? 'auto'}`;
  let format = formatters.get(key);
  if (!format) {
    format = new Intl.NumberFormat(locale, fractionDigits === undefined
      ? { maximumFractionDigits: 3 }
      : { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits });
    formatters.set(key, format);
  }
  return format;
}

export function numberText(locale: string): NumberText {
  return (value, fractionDigits) => formatter(locale, fractionDigits).format(value);
}

const pluralRules = new Map<string, Intl.PluralRules>();

/** Форма слова для числа: «1 сутки», «2 суток», «0,5 суток» — по правилам CLDR. */
export function pluralForm(locale: string, count: number): Intl.LDMLPluralRule {
  let rules = pluralRules.get(locale);
  if (!rules) {
    rules = new Intl.PluralRules(locale);
    pluralRules.set(locale, rules);
  }
  return rules.select(count);
}
