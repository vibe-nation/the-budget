import { BarContent, GanttBar } from './timeline.model';

export const GANTT_SERIES_ID = 'gantt-roles';

/** The value slot holding a bar's selection state, read by `renderBar`. */
export const V_SEL = 6;
export const SEL_NONE = 0;
export const SEL_SELECTED = 1;
export const SEL_DIMMED = 2;
export const SEL_RELATED = 3;

/* Exact name only: on this chart a name in two rows has been checked to be one
   person, and a looser match would light a namesake's career. A rest-of-term
   stripe has no name, so it belongs to no one. */
const personOf = (bar: GanttBar) => bar.content.name;

/**
 * Lights the selected bar and every other bar of the same person, and dims the
 * rest; with nothing selected all bars rest. Returns new bars for those whose
 * state changed, so the chart can be updated without a rebuild.
 */
export function paintSelection(bars: readonly GanttBar[], selectedId: string | null): GanttBar[] {
  const selected = selectedId === null ? undefined : bars.find((bar) => bar.content.id === selectedId);
  const person = selected ? personOf(selected) : '';

  return bars.map((bar) => {
    const state = !selected
      ? SEL_NONE
      : bar === selected
        ? SEL_SELECTED
        : person && personOf(bar) === person
          ? SEL_RELATED
          : SEL_DIMMED;
    if (bar.value[V_SEL] === state) return bar;
    const value = [...bar.value];
    value[V_SEL] = state;
    return { ...bar, value };
  });
}

/** Another bar of the selected person: a role the card can list and jump to. */
export interface RelatedTenureRow {
  readonly id: string;
  readonly role: string;
  readonly from: number;
  readonly to: number;
  /** Matches the bar's own fill, so the row reads as the same career thread. */
  readonly color: string;
  readonly isCurrent: boolean;
}

/** Every bar of the selected person, chronologically. */
export function relatedTenures(bars: readonly GanttBar[], selectedId: string): RelatedTenureRow[] {
  const target = bars.find((bar) => bar.content.id === selectedId);
  const person = target ? personOf(target) : '';
  if (!person) return [];

  return bars
    .filter((bar) => personOf(bar) === person)
    .map((bar) => ({
      id: bar.content.id,
      role: bar.content.group,
      from: bar.content.from,
      to: bar.content.to,
      color: bar.itemStyle.color,
      isCurrent: bar === target,
    }))
    .sort((a, b) => a.from - b.from);
}

export interface ZoomWindow {
  readonly start: number;
  readonly end: number;
}

/**
 * The x window centred on a span, keeping the window's width, or null when
 * nothing has to move. Any overlap counts as in view, so a click never shifts
 * the reader's framing, unless `always` (the card's date row, which asks for it).
 */
export function centeredZoom(
  span: Pick<BarContent, 'from' | 'to'>,
  current: ZoomWindow,
  axis: { readonly min: number; readonly max: number },
  always = false
): ZoomWindow | null {
  const pct = (ts: number) => ((ts - axis.min) / (axis.max - axis.min)) * 100;
  const low = pct(span.from);
  const high = pct(span.to);
  if (!always && high >= current.start && low <= current.end) return null;

  const width = Math.max(0.5, current.end - current.start);
  const center = (low + high) / 2;
  const start = Math.min(100 - width, Math.max(0, center - width / 2));
  return { start, end: start + width };
}
