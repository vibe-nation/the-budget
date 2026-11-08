import { lawFigure, lawPage, lawPlace } from '../charts/timeline/timeline-lines';
import { Currency, MAGNITUDES, Magnitude, MoneyView, convertMoney, magnitudePrefix } from '../charts/timeline/timeline-money';
import { ChartSeries, LawCitation, TodayData, TodayEntry } from '../charts/timeline/timeline.model';

/** An institution with its figure found: `amount` is in euro for the page's year. */
export interface TodayRow {
  readonly name: string;
  readonly abbr?: string;
  readonly lawShort?: string;
  readonly amount: number;
  readonly source: LawCitation;
  readonly parts: readonly TodayRow[];
}

const CURRENCY_MARK: Readonly<Record<Currency, string>> = { EUR: '€', BGN: 'лв.' };

/* `always`, because Bulgarian leaves a four-digit number ungrouped and a column should not.
   The cast is for TypeScript's lib, whose type for this option predates the string values. */
const GROUPED = { useGrouping: 'always' as unknown as boolean };
const wholeNumber = new Intl.NumberFormat('bg-BG', { maximumFractionDigits: 0, ...GROUPED });
const scaledNumber = new Intl.NumberFormat('bg-BG', { minimumFractionDigits: 2, maximumFractionDigits: 2, ...GROUPED });

/* Its own key, not the chart's: the chart opens in billions, where most daily amounts here would round away. */
const MAGNITUDE_STORAGE_KEY = 'the-budget.today-magnitude';
const DEFAULT_MAGNITUDE: Magnitude = 1;

/* localStorage throws when it is unavailable, and what it holds may predate the options on offer. */
export function readTodayMagnitude(): Magnitude {
  try {
    const stored = Number(localStorage.getItem(MAGNITUDE_STORAGE_KEY));
    return MAGNITUDES.find(({ value }) => value === stored)?.value ?? DEFAULT_MAGNITUDE;
  } catch {
    return DEFAULT_MAGNITUDE;
  }
}

export function storeTodayMagnitude(magnitude: Magnitude): void {
  try {
    localStorage.setItem(MAGNITUDE_STORAGE_KEY, String(magnitude));
  } catch {
    /* Lost on reload; nothing else depends on it. */
  }
}

function figureOf(entry: TodayEntry, charts: readonly ChartSeries[], year: number): Pick<TodayRow, 'amount' | 'source'> | null {
  if (!('series' in entry)) return entry.sources[0] ? { amount: entry.value, source: entry.sources[0] } : null;

  const chart = charts.find(({ id }) => id === entry.series);
  const point = chart?.data.find(({ date }) => date === `${year}-12-31`);
  const source = point?.sources?.[0];
  if (!chart || !point || !source) return null;
  return { amount: convertMoney(point.value, chart.unit, { currency: 'EUR', magnitude: 1 }), source };
}

function toRows(entries: readonly TodayEntry[], charts: readonly ChartSeries[], year: number): TodayRow[] {
  return entries
    .flatMap((entry) => {
      const figure = figureOf(entry, charts, year);
      if (!figure) return [];
      const { name, abbr, lawShort, parts = [] } = entry;
      return [{ name, abbr, lawShort, ...figure, parts: toRows(parts, charts, year) }];
    })
    .sort((a, b) => b.amount - a.amount);
}

/** Largest first. An institution with no figure that year is left out, never shown as zero. */
export function toTodayRows({ year, entries }: TodayData, charts: readonly ChartSeries[]): TodayRow[] {
  return toRows(entries, charts, year);
}

/** The institutions only: their parts are already inside them. */
export const todayTotal = (rows: readonly TodayRow[]) => rows.reduce((sum, row) => sum + row.amount, 0);

export const daysInYear = (year: number) => (new Date(Date.UTC(year, 1, 29)).getUTCMonth() === 1 ? 366 : 365);

export const perDay = (amount: number, year: number) => amount / daysInYear(year);

/* Below this a scaled amount would print as 0,00, which would read as nothing at all. */
const SMALLEST_SHOWN = 0.005;

function scaledFigure(value: number): string {
  return value > 0 && value < SMALLEST_SHOWN ? `< ${scaledNumber.format(0.01)}` : scaledNumber.format(value);
}

/** A euro amount in the reader's view, naming scale and currency: a cell gets read on its own. */
export function formatAmount(amountEur: number, money: MoneyView): string {
  const value = convertMoney(amountEur, 'EUR', money);
  const figure = money.magnitude === 1 ? wholeNumber.format(value) : scaledFigure(value);
  return `${figure} ${magnitudePrefix(money.magnitude)}${CURRENCY_MARK[money.currency]}`;
}

/* Short forms, to keep a row on one line. The link's tooltip spells out the full citation. */
const shortIssue = ({ citation, date }: LawCitation['gazette']) => citation.replace(/ от .*$/, `/${date.slice(0, 4)}`);
const shortPage = ({ page, actPage }: LawCitation['gazette']) => (page ? `стр. ${page}` : `акт от стр. ${actPage}`);

/** The act is named only when it isn't the one the page's note names. */
export function sourceLabel({ source, lawShort }: Pick<TodayRow, 'source' | 'lawShort'>): string {
  const place = lawPlace(source);
  const page = shortPage(source.gazette);
  return lawShort ? `${lawShort}, ${place} · ${shortIssue(source.gazette)}, ${page}` : `${place} · ${page}`;
}

/* `#page` opens the published PDF on the figure. The copies in public/budget aren't deployed. */
export const sourceHref = ({ fileUrl, filePage }: LawCitation) => `${fileUrl}#page=${filePage}`;

/** Everything needed to find and check the figure, for the link's tooltip. */
export function sourceTitle(source: LawCitation): string {
  const { title, gazette, row, column, amountUnit } = source;
  return `${title}, ${gazette.citation}, ${lawPage(gazette)}, ${lawPlace(source)}, ред „${row}“, колона „${column}“: ${lawFigure(source)} ${amountUnit}`;
}
