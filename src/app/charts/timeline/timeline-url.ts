import { LegendSelection, LineShape } from './timeline-lines';
import { CURRENCIES, MAGNITUDES, MoneyView } from './timeline-money';
import { ChartSeries, TimelineEvent } from './timeline.model';

/** The address's query, which holds the view a link reproduces. */
export type ViewParams = Pick<URLSearchParams, 'get'>;

export const viewParams = (path: string): ViewParams =>
  new URLSearchParams(path.split('?')[1] ?? '');

const listed = (value: string): ReadonlySet<string> => new Set(value.split(','));
const joined = (ids: readonly string[]): string => ids.map(encodeURIComponent).join(',');

const LINE_SHAPES: readonly LineShape[] = ['step', 'line'];

/** Each part taken from the address when it is one on offer, else from `fallback`. */
export function moneyFromUrl(params: ViewParams, fallback: MoneyView): MoneyView {
  return {
    currency:
      CURRENCIES.find(({ value }) => value === params.get('currency'))?.value ?? fallback.currency,
    magnitude:
      MAGNITUDES.find(({ value }) => String(value) === params.get('scale'))?.value ??
      fallback.magnitude,
  };
}

/** The shape of the whole-year lines from the address when it is one on offer, else `fallback`. */
export function lineShapeFromUrl(params: ViewParams, fallback: LineShape): LineShape {
  return LINE_SHAPES.find((shape) => shape === params.get('shape')) ?? fallback;
}

/** The address names the series that are on, so one it leaves out is off. Without a list, `fallback`. */
export function legendFromUrl(
  params: ViewParams,
  charts: readonly ChartSeries[],
  fallback: LegendSelection,
): LegendSelection {
  const lines = params.get('lines');
  if (lines === null) return fallback;
  const on = listed(lines);
  return Object.fromEntries(charts.map(({ id }) => [id, on.has(id)]));
}

/** The address names the events that are shown, so one it leaves out is hidden. Without a list, `fallback`. */
export function hiddenEventsFromUrl(
  params: ViewParams,
  events: readonly TimelineEvent[],
  fallback: ReadonlySet<string>,
): ReadonlySet<string> {
  const shown = params.get('events');
  if (shown === null) return fallback;
  const on = listed(shown);
  return new Set(events.map(({ id }) => id).filter((id) => !on.has(id)));
}

/**
 * The query for this view. It always states every part, even at its default: an address that
 * left one out would open with whatever the next reader's browser has stored.
 */
export function viewQuery(
  charts: readonly ChartSeries[],
  legend: LegendSelection,
  events: readonly TimelineEvent[],
  hidden: ReadonlySet<string>,
  money: MoneyView,
  lineShape: LineShape,
): string {
  const lines = charts.filter(({ id }) => legend[id] !== false).map(({ id }) => id);
  const shown = events.filter(({ id }) => !hidden.has(id)).map(({ id }) => id);
  return `lines=${joined(lines)}&currency=${money.currency}&scale=${money.magnitude}&events=${joined(shown)}&shape=${lineShape}`;
}
