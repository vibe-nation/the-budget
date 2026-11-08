import { INITIAL_VIEW_FROM, TimelineZoom } from './timeline-view';
import { DEFAULT_LINE_SHAPE, LegendSelection, LineShape, ValueAxisName, displayValue, drawnPoints, isStepped, valueAxisOf, withPlans } from './timeline-lines';
import { MoneyView } from './timeline-money';
import { ChartSeries } from './timeline.model';

/* ECharts ranges each value axis on its own, and `alignTicks` matches the axes'
   tick counts, not where their zeros fall: the same level would stand at different
   heights. So all are ranged here: each gets a nice step of its own, and they
   share how many of those steps lie below and above zero. Zero is then one height
   on all of them, and every gridline a round number on each. */

export interface AxisRange {
  readonly min: number;
  readonly max: number;
  readonly interval: number;
}

/** `null` for an axis with no series switched on. */
export interface ValueAxisRanges {
  readonly percent: AxisRange | null;
  readonly money: AxisRange | null;
  readonly coefficient: AxisRange | null;
  readonly inflation: AxisRange | null;
  readonly monthly: AxisRange | null;
}

/** The time span in view, in epoch ms. */
export interface TimeWindow {
  readonly from: number;
  readonly to: number;
}

type Extent = readonly [number, number];

const TARGET_TICKS = 5;
const NICE_STEPS = [1, 2, 5, 10];
/* Spares a value that sits on a step from a further tick over a rounding error. */
const EPSILON = 1e-9;
/* Every value axis stands left of the grid, in the row labels' gutter: the first
   one on at the grid's edge, and each further one on beside the last, outwards in
   this order. An axis switched off gives its place to the next. */
export const VALUE_AXIS_ORDER: readonly ValueAxisName[] = ['percent', 'money', 'coefficient', 'inflation', 'monthly'];

/** Per axis, in px: the room it takes across, figures and space, and its name's width. */
export interface ValueAxisLayout {
  readonly widths: Readonly<Record<ValueAxisName, number>>;
  readonly names: Readonly<Record<ValueAxisName, number>>;
}

/* The widths that hold when nothing can be measured: the money axis' figures
   vary with the reader's units, the others' stay short. */
export const DEFAULT_AXIS_LAYOUT: ValueAxisLayout = {
  widths: { percent: 52, money: 52, coefficient: 44, inflation: 44, monthly: 52 },
  names: { percent: 0, money: 0, coefficient: 0, inflation: 0, monthly: 0 },
};

/* An axis' name stands this far over its top, centred on the axis line. A name
   wider than the room between two axes would run into its neighbour's, so it goes
   a line higher. */
export const AXIS_NAME_GAP_PX = 8;
const AXIS_NAME_LIFT_PX = 14;
const AXIS_NAME_SPACE_PX = 6;

/** The time span a zoom shows; before the reader zooms, the opening view. */
export function timeWindow(zoom: TimelineZoom | undefined, axis: { readonly min: number; readonly max: number }): TimeWindow {
  if (!zoom) return { from: +new Date(INITIAL_VIEW_FROM), to: axis.max };
  const span = axis.max - axis.min;
  return { from: axis.min + (span * zoom.start) / 100, to: axis.min + (span * zoom.end) / 100 };
}

function niceStep(rough: number): number {
  const power = 10 ** Math.floor(Math.log10(rough));
  return (NICE_STEPS.find((step) => step * power >= rough * (1 - EPSILON)) ?? 10) * power;
}

/* Where a series' line stands at `time`; nothing outside its drawn points, where
   no line is drawn. A stepped line already stands at the next point's value. */
function lineValueAt(chart: ChartSeries, time: number, shape: LineShape): number[] {
  const points = drawnPoints(chart, shape);
  const next = points.findIndex(({ date }) => +new Date(date) > time);
  if (next < 1) return [];
  const before = points[next - 1];
  const after = points[next];
  if (isStepped(chart, shape)) return [after.value];
  const from = +new Date(before.date);
  return [before.value + ((after.value - before.value) * (time - from)) / (+new Date(after.date) - from)];
}

/* Zero is always in: it is what the two axes line up on. So are the horizontal
   lines, which would otherwise fall off a view whose data stops short of them,
   and the line at both edges of the view, where it runs on to points outside. */
function visibleExtent(charts: readonly ChartSeries[], money: MoneyView, window: TimeWindow, shape: LineShape): Extent | null {
  if (charts.length === 0) return null;

  const values = charts.flatMap((chart) => {
    const inView = chart.data.filter(({ date }) => +new Date(date) >= window.from && +new Date(date) <= window.to);
    return [
      ...[...inView, ...(chart.horizontalLines ?? [])].map(({ value }) => value),
      ...lineValueAt(chart, window.from, shape),
      ...lineValueAt(chart, window.to, shape),
    ].map(displayValue(chart, money));
  });

  return [Math.min(0, ...values), Math.max(0, ...values)];
}

function stepsOf([low, high]: Extent) {
  const step = niceStep((high - low) / TARGET_TICKS || 1);
  return { step, below: Math.ceil(-low / step - EPSILON), above: Math.ceil(high / step - EPSILON) };
}

/** Ranges for the value axes, with zero at the same height on all of them. */
export function valueAxisRanges(
  charts: readonly ChartSeries[],
  money: MoneyView,
  legend: LegendSelection | undefined,
  window: TimeWindow,
  shape: LineShape = DEFAULT_LINE_SHAPE
): ValueAxisRanges {
  const shown = withPlans(charts.filter((chart) => legend?.[chart.id] !== false));
  const stepsFor = (axis: ValueAxisName) => {
    const extent = visibleExtent(shown.filter((chart) => valueAxisOf(chart) === axis), money, window, shape);
    return extent && stepsOf(extent);
  };

  const percentSteps = stepsFor('percent');
  const moneySteps = stepsFor('money');
  const coefficientSteps = stepsFor('coefficient');
  const inflationSteps = stepsFor('inflation');
  const monthlySteps = stepsFor('monthly');
  const all = [percentSteps, moneySteps, coefficientSteps, inflationSteps, monthlySteps];
  const below = Math.max(...all.map((steps) => steps?.below ?? 0));
  const above = Math.max(...all.map((steps) => steps?.above ?? 0));
  const range = (steps: { step: number } | null): AxisRange | null =>
    steps && { min: +(-below * steps.step).toFixed(12), max: +(above * steps.step).toFixed(12), interval: steps.step };

  return {
    percent: range(percentSteps),
    money: range(moneySteps),
    coefficient: range(coefficientSteps),
    inflation: range(inflationSteps),
    monthly: range(monthlySteps),
  };
}

/** An axis as the ranges place it: shown or not, how far out from the grid, how high its name. */
export interface ValueAxisPatch extends Partial<AxisRange> {
  readonly show: boolean;
  readonly offset: number;
  readonly nameGap: number;
  readonly splitLine: { readonly show: boolean };
}

/* What of the axes follows the ranges. The gridlines hang on the first axis that
   is on. A name goes on the lowest line where it clears the last name there. */
export function valueAxisPatches(ranges: ValueAxisRanges, layout: ValueAxisLayout = DEFAULT_AXIS_LAYOUT): Record<ValueAxisName, ValueAxisPatch> {
  const patches = {} as Record<ValueAxisName, ValueAxisPatch>;
  const lastNameOnLine: { centre: number; width: number }[] = [];
  let offset = 0;
  let gridlines = false;

  for (const axis of VALUE_AXIS_ORDER) {
    const range = ranges[axis];
    if (!range) {
      patches[axis] = { show: false, offset, nameGap: AXIS_NAME_GAP_PX, splitLine: { show: false } };
      continue;
    }
    const width = layout.names[axis];
    const clears = (line: number) => {
      const last = lastNameOnLine[line];
      return !last || offset - last.centre >= (last.width + width) / 2 + AXIS_NAME_SPACE_PX;
    };
    let line = 0;
    while (!clears(line)) line++;
    lastNameOnLine[line] = { centre: offset, width };

    patches[axis] = { ...range, show: true, offset, nameGap: AXIS_NAME_GAP_PX + line * AXIS_NAME_LIFT_PX, splitLine: { show: !gridlines } };
    gridlines = true;
    offset += layout.widths[axis];
  }
  return patches;
}

/** How far out from the grid the value axes reach with every one that has a series on. */
export function valueAxesReach(axes: readonly ValueAxisName[], layout: ValueAxisLayout): number {
  const present = VALUE_AXIS_ORDER.filter((axis) => axes.includes(axis));
  const outer = present.at(-1);
  if (!outer) return 0;
  const offset = present.slice(0, -1).reduce((sum, axis) => sum + layout.widths[axis], 0);
  return offset + Math.max(layout.widths[outer], layout.names[outer] / 2);
}
