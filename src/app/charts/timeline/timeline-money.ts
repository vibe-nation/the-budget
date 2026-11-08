import { ChartSeries } from './timeline.model';

/* The irrevocably fixed rate the lev entered the euro area at. */
const EUR_TO_BGN = 1.95583;
const MONEY_STORAGE_KEY = 'the-budget.money';

export type Currency = 'EUR' | 'BGN';
export type Magnitude = 1_000_000_000 | 1_000_000 | 1_000 | 1;

/** How the line grid states an amount. */
export interface MoneyView {
  readonly currency: Currency;
  readonly magnitude: Magnitude;
}

export const DEFAULT_MONEY: MoneyView = { currency: 'EUR', magnitude: 1_000_000_000 };

export const CURRENCIES: readonly { readonly value: Currency; readonly label: string }[] = [
  { value: 'EUR', label: 'евро' },
  { value: 'BGN', label: 'лева' },
];

export const MAGNITUDES: readonly { readonly value: Magnitude; readonly label: string }[] = [
  { value: 1_000_000_000, label: 'млрд' },
  { value: 1_000_000, label: 'млн' },
  { value: 1_000, label: 'хил' },
  { value: 1, label: 'единици' },
];

const CURRENCY_ON_AXIS: Readonly<Record<Currency, string>> = { EUR: 'евро', BGN: 'лв.' };

/* „единици“ names the button, not the amount: a plain figure takes no prefix. */
export const magnitudePrefix = (magnitude: Magnitude) => (magnitude === 1 ? '' : `${MAGNITUDES.find(({ value }) => value === magnitude)?.label}. `);

const currencyName = (currency: Currency) => CURRENCIES.find(({ value }) => value === currency)?.label;

export const isMoney = ({ unit }: ChartSeries): boolean => unit === 'EUR' || unit === 'BGN';

/** Brings an amount to the reader's denomination: the series mix leva and euro. */
export function convertMoney(value: number, unit: ChartSeries['unit'], { currency, magnitude }: MoneyView): number {
  const toEur = unit === 'BGN' ? value / EUR_TO_BGN : value;
  return (currency === 'BGN' ? toEur * EUR_TO_BGN : toEur) / magnitude;
}

export const moneyAxisName = ({ currency, magnitude }: MoneyView) => `${magnitudePrefix(magnitude)}${CURRENCY_ON_AXIS[currency]}`;

/** What follows an amount in the tooltip, space included. */
export const moneySuffix = ({ currency, magnitude }: MoneyView) => ` ${magnitudePrefix(magnitude)}${currencyName(currency)}`;

const number = new Intl.NumberFormat('bg-BG', { maximumFractionDigits: 2 });
export const formatNumber = (value: number) => number.format(value);

/* Twice the largest amount on offer: the axis rounds its top tick up, which can
   add a digit, and a series switched on later must not outgrow the room left. */
export function widestMoneyLabel(charts: readonly ChartSeries[], money: MoneyView): string {
  const amounts = charts
    .filter(isMoney)
    .flatMap((chart) => chart.data.map((point) => Math.abs(convertMoney(point.value, chart.unit, money))));
  return formatNumber(Math.round(Math.max(0, ...amounts) * 2));
}

function isMoneyView(value: unknown): value is MoneyView {
  const { currency, magnitude } = (value ?? {}) as Partial<MoneyView>;
  return CURRENCIES.some((option) => option.value === currency) && MAGNITUDES.some((option) => option.value === magnitude);
}

/* localStorage throws when it is unavailable, and what it holds may predate the
   options on offer, so a bad read falls back to the default. */
export function readStoredMoney(): MoneyView {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(MONEY_STORAGE_KEY) ?? 'null');
    return isMoneyView(stored) ? stored : DEFAULT_MONEY;
  } catch {
    return DEFAULT_MONEY;
  }
}

export function storeMoney(money: MoneyView): void {
  try {
    localStorage.setItem(MONEY_STORAGE_KEY, JSON.stringify(money));
  } catch {
    /* Lost on reload; nothing else depends on it. */
  }
}
