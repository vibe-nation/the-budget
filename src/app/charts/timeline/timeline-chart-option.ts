import moment from 'moment';

import { buildEventSeriesList } from './timeline-events';
import { buildGanttCategories } from './timeline-lanes';
import { INITIAL_VIEW_FROM, TimelineZoom } from './timeline-view';
import {
  AXIS_NAME_GAP_PX,
  DEFAULT_AXIS_LAYOUT,
  VALUE_AXIS_ORDER,
  ValueAxisLayout,
  timeWindow,
  valueAxesReach,
  valueAxisPatches,
  valueAxisRanges,
} from './timeline-value-axes';
import { ChartPick, LegendSelection, LineShape, ValueAxisName, buildLegend, buildLineSeries, lineColor, valueAxisOf, withPlans } from './timeline-lines';
import { DEFAULT_MONEY, MoneyView, formatNumber, moneyAxisName, widestMoneyLabel } from './timeline-money';
import { buildCurrentDateLine, buildGanttSeries } from './timeline-series';
import { ChartSeries, GanttGroup, TimelineEvent } from './timeline.model';

const BG_MONTHS = ['януари', 'февруари', 'март', 'април', 'май', 'юни', 'юли', 'август', 'септември', 'октомври', 'ноември', 'декември'];

const FONT = 'Sofia Sans';
const AXIS_LABEL_FONT_PX = 14;
const AXIS_LEFT_GUTTER = 16;
const AXIS_LEFT_MIN = 120;
/* Room under the grid for the x-axis line, label margin and text. */
const XAXIS_LABELS_PX = 20;
const GRID_TOP_PX = 4;
/* The column the legend stands in, beside both grids: they have to share their
   left and right edges for a date to line up across the two. The legend itself
   is HTML laid over this column, as wide as its longest name on one line plus
   its chrome: the panel's and the row's padding, the mark and the gap after it,
   as `lines-legend.css` sets them. */
const LEGEND_FONT = `400 14px "${FONT}"`;
const LEGEND_CHROME_PX = 66;
const LEGEND_MIN_PX = 160;
/* Air between the grid's right edge and the legend beside it. */
const LEGEND_GAP_PX = 20;
/* Below this chart width the legend runs under the chart, leaving the width to
   the bars: a phone, or a laptop with the card open. */
export const NARROW_WIDTH_PX = 1000;
const NARROW_RIGHT_PX = 24;
/* A value axis' figures and name, as `valueAxisCommon` sets them. */
const VALUE_AXIS_FONT = `12px "${FONT}"`;
/* What a value axis takes across besides its figures: ECharts' margin between the
   line and the figures, and the space before the next axis out. */
const VALUE_AXIS_CHROME_PX = 28;
/* Where the bars end and the lines begin, in percent of the chart, for a 40/60
   split in the lines' favour: the gap is the gantt's own date labels and the
   value axes' names. */
const GANTT_BOTTOM_PCT = 64;
const LINES_TOP_PCT = 42;
/* The narrow chart's row names: the full ones would take most of a phone's width
   from the bars. A row missing here keeps its name. */
const SHORT_ROW_LABELS: Readonly<Record<string, string>> = {
  'Министър-председател': 'Премиер',
  'Министър на финансите': 'Финансов министър',
  'Председател на Народното събрание': 'Председател на НС',
  'Председател на комисия по бюджет и финанси': 'Бюджетна комисия',
  'Председател на Сметната палата': 'Сметна палата',
  'Председател на КФН': 'КФН',
  'Директор на Българска Банка за Развитие': 'ББР',
};

/* What a category prints: its later lanes are blank, marked with a leading NUL. */
const rowLabel = (category: string, narrow: boolean): string => {
  if (category.startsWith('\0')) return '';
  return narrow ? (SHORT_ROW_LABELS[category] ?? category) : category;
};

const AXIS_END_MARGIN_MONTHS = 3;
/* The widest step between ticks, so every year keeps its gridline however far out
   the zoom goes. ECharts rounds a step to whole years, and at exactly one year it
   would count too few ticks and add half-years: anything under 1.5 stays yearly. */
const MAX_TICK_INTERVAL_MS = 1.25 * 365 * 24 * 60 * 60 * 1000;

function measureMaxLabelWidth(labels: readonly string[], font = `${AXIS_LABEL_FONT_PX}px "${FONT}"`): number {
  const ctx = typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d');
  if (!ctx) return 0;
  ctx.font = font;
  return Math.ceil(Math.max(0, ...labels.map((label) => ctx.measureText(label).width)));
}

/** What the legend column takes from the chart's right, for these series' names. */
export function legendColumnWidth(charts: readonly ChartSeries[]): number {
  return Math.max(LEGEND_MIN_PX, measureMaxLabelWidth(charts.map((chart) => chart.name), LEGEND_FONT) + LEGEND_CHROME_PX);
}

/** Both grids' right edge: the legend's column beside them, or a margin where the legend runs under. */
export function gridRight(charts: readonly ChartSeries[], narrow: boolean): number {
  return narrow ? NARROW_RIGHT_PX : legendColumnWidth(charts) + LEGEND_GAP_PX;
}

/** The value axes' names, in the reader's units. */
export function valueAxisNames(money: MoneyView): Readonly<Record<ValueAxisName, string>> {
  return {
    percent: '%',
    money: moneyAxisName(money),
    coefficient: 'коефициент',
    inflation: 'инфлация, %',
    monthly: `${moneyAxisName({ ...money, magnitude: 1 })}/месец`,
  };
}

/* Only the money axis' figures are measured: they run from „40“ in billions to
   eleven digits in units. The others' stay short. */
export function valueAxisLayout(charts: readonly ChartSeries[], money: MoneyView): ValueAxisLayout {
  const names = valueAxisNames(money);
  const moneyFigures = measureMaxLabelWidth([widestMoneyLabel(charts, money)], VALUE_AXIS_FONT);
  return {
    widths: { ...DEFAULT_AXIS_LAYOUT.widths, money: Math.max(DEFAULT_AXIS_LAYOUT.widths.money, moneyFigures + VALUE_AXIS_CHROME_PX) },
    names: Object.fromEntries(VALUE_AXIS_ORDER.map((axis) => [axis, measureMaxLabelWidth([names[axis]], VALUE_AXIS_FONT)])) as Record<ValueAxisName, number>,
  };
}

/* A little past the last date anywhere in the data. Taken from every row, not
   just the shown ones: the zoom is kept in shares of the axis, so a moving end
   would shift the view whenever a row is toggled. */
function axisEnd(allGroups: readonly GanttGroup[]): string {
  const ends = allGroups
    .flatMap((group) => [...group.items, ...(group.mandate ?? [])])
    .flatMap(({ value }) => (value[1] ? [+new Date(value[1])] : []));
  return moment(Math.max(Date.now(), ...ends))
    .add(AXIS_END_MARGIN_MONTHS, 'months')
    .format('YYYY-MM-DD');
}

/** What a rebuild has to carry over; omitted on the first build. */
export interface TimelineView {
  readonly zoom?: TimelineZoom;
  readonly legend?: LegendSelection;
  readonly narrow?: boolean;
  readonly money?: MoneyView;
  readonly hiddenEvents?: ReadonlySet<string>;
  readonly labels?: boolean;
  readonly lineShape?: LineShape;
  /** Baked into its series, so a rebuild keeps the marked point without a second update. */
  readonly pick?: ChartPick | null;
}

export type TimelineOption = ReturnType<typeof buildTimelineOption>;

/**
 * @param groups The rows to draw, in display order.
 * @param allGroups Every row on offer. The axis spans these whatever is selected,
 *   so a zoom given as shares of it still means the same dates after a rebuild.
 * @param charts The series of the line grid.
 * @param events The bands and lines drawn across both grids.
 * @param view Omitted on the first build, which opens on `INITIAL_VIEW_FROM`.
 */
export function buildTimelineOption(
  groups: readonly GanttGroup[],
  allGroups: readonly GanttGroup[],
  charts: readonly ChartSeries[] = [],
  events: readonly TimelineEvent[] = [],
  view: TimelineView = {}
) {
  const { labels, isGroupStart } = buildGanttCategories(groups);
  const earliest = Math.min(...allGroups.flatMap((group) => group.items.map((item) => +new Date(item.value[0]))));
  const min = moment(earliest).startOf('year').format('YYYY-MM-DD');
  const max = axisEnd(allGroups);
  const narrow = view.narrow ?? false;
  const money = view.money ?? DEFAULT_MONEY;
  const layout = valueAxisLayout(charts, money);
  const names = valueAxisNames(money);
  const ranges = valueAxisRanges(charts, money, view.legend, timeWindow(view.zoom, { min: +new Date(min), max: +new Date(max) }), view.lineShape);
  const {
    percent: percentAxis,
    money: moneyAxis,
    coefficient: coefficientAxis,
    inflation: inflationAxis,
    monthly: monthlyAxis,
  } = valueAxisPatches(ranges, layout);
  /* The value axes stand in the same gutter as the row labels: with few rows and
     small units, their figures are what sets the width. The gutter holds them all
     at once, so switching a series on never moves the grid's edge. */
  const left = Math.max(
    AXIS_LEFT_MIN,
    measureMaxLabelWidth(labels.map((label) => rowLabel(label, narrow))) + AXIS_LEFT_GUTTER,
    valueAxesReach(charts.map(valueAxisOf), layout) + AXIS_LEFT_GUTTER
  );
  const right = gridRight(charts, narrow);

  /* The two grids are one time axis drawn twice. */
  const xAxisCommon = {
    show: true,
    type: 'time',
    maxInterval: MAX_TICK_INTERVAL_MS,
    splitLine: { show: true, lineStyle: { color: '#e5e7eb', type: 'solid' } },
    axisTick: { show: true, lineStyle: { color: '#d1d5db' } },
    axisLine: { show: true, lineStyle: { color: '#e5e7eb' } },
    axisLabel: {
      show: true,
      hideOverlap: true,
      fontFamily: FONT,
      fontSize: 11.5,
      color: '#6b7280',
      formatter: (value: number) => {
        const d = new Date(value);
        const month = d.getMonth();
        const date = d.getDate();
        if (month === 0 && date === 1) return String(d.getFullYear());
        if (date === 1) return BG_MONTHS[month];
        return `${date} ${BG_MONTHS[month]}`;
      },
    },
    /* A reading aid only: the tooltip stays with the bar under the cursor, and
       the line must neither light bars nor snap to their starts. Near a point it
       is re-aimed by the component (`timeline-snap.ts`), not by ECharts. */
    axisPointer: {
      show: true,
      type: 'line',
      snap: false,
      triggerTooltip: false,
      triggerEmphasis: false,
      lineStyle: { color: '#0f1115', type: 'dashed', width: 1 },
      label: {
        show: true,
        margin: 3,
        padding: [2, 6],
        backgroundColor: '#1f2937',
        borderWidth: 0,
        shadowBlur: 0,
        color: '#ffffff',
        fontFamily: FONT,
        fontSize: 12,
        formatter: (params: { value: number }) => {
          const d = new Date(params.value);
          return `${d.getDate()} ${BG_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
        },
      },
    },
    min,
    max,
  };

  const valueAxisCommon = {
    type: 'value',
    gridIndex: 1,
    position: 'left',
    nameLocation: 'end',
    nameGap: AXIS_NAME_GAP_PX,
    nameTextStyle: { fontFamily: FONT, fontSize: 12, color: '#6b7280' },
    axisLine: { show: true, lineStyle: { color: '#d1d5db' } },
    axisLabel: { fontFamily: FONT, fontSize: 12, color: '#6b7280', formatter: formatNumber },
    axisPointer: { show: false },
  };

  return {
    axisPointer: { link: [{ xAxisIndex: [0, 1] }] },
    tooltip: {
      confine: true,
      transitionDuration: 0,
      position: (
        point: [number, number],
        _params: unknown,
        _dom: unknown,
        _rect: unknown,
        size: { contentSize: [number, number]; viewSize: [number, number] }
      ) => {
        const [px, py] = point;
        const [tw, th] = size.contentSize;
        const [vw] = size.viewSize;
        let x = px + 20;
        let y = py - th - 10;
        if (x + tw > vw) x = px - tw - 20;
        if (y < 0) y = py + 20;
        return [Math.round(x), Math.round(y)];
      },
      backgroundColor: '#ffffff',
      borderColor: 'rgba(15,17,21,0.08)',
      borderWidth: 1,
      padding: 0,
      extraCssText: 'box-shadow:0 2px 8px rgba(15,17,21,0.06),0 12px 32px rgba(15,17,21,0.1);border-radius:8px;overflow:hidden;',
      textStyle: { fontFamily: "'Sofia Sans', sans-serif", fontSize: 14, color: '#1e293b' },
    },
    grid: [
      { top: GRID_TOP_PX, bottom: `${GANTT_BOTTOM_PCT}%`, right, left, outerBoundsMode: 'none' },
      { top: `${LINES_TOP_PCT}%`, bottom: XAXIS_LABELS_PX, right, left, outerBoundsMode: 'none' },
    ],
    legend: buildLegend(charts, view.legend, events, view.hiddenEvents),
    dataZoom: [
      {
        type: 'inside',
        xAxisIndex: [0, 1],
        ...(view.zoom ?? { startValue: INITIAL_VIEW_FROM, endValue: max }),
        /* Nothing is dropped: a line needs its points outside the view to run on to
           the edge of the grid, which clips it, and `renderBar` clips the bars. */
        filterMode: 'none',
      },
    ],
    xAxis: [
      { ...xAxisCommon, gridIndex: 0 },
      /* Under the lines (`z: 2`), which the pointer would otherwise cut through. */
      { ...xAxisCommon, gridIndex: 1, axisPointer: { ...xAxisCommon.axisPointer, z: 1 } },
    ],
    yAxis: [
      {
        gridIndex: 0,
        inverse: true,
        /* Row labels are clickable: they open the panel at that row. */
        triggerEvent: true,
        data: labels,
        axisTick: { show: false },
        axisLine: { show: false },
        axisLabel: {
          fontFamily: FONT,
          fontSize: AXIS_LABEL_FONT_PX,
          color: '#1f2937',
          interval: 0,
          formatter: (value: string) => rowLabel(value, narrow),
        },
        axisPointer: { show: false },
        splitLine: {
          show: true,
          interval: (i: number) => isGroupStart[i],
          lineStyle: { color: '#e2e8f0' },
        },
      },
      {
        ...valueAxisCommon,
        ...percentAxis,
        name: names.percent,
        splitLine: { ...percentAxis.splitLine, lineStyle: { color: '#e5e7eb' } },
      },
      {
        ...valueAxisCommon,
        ...moneyAxis,
        name: names.money,
        splitLine: { ...moneyAxis.splitLine, lineStyle: { color: '#e5e7eb' } },
      },
      {
        ...valueAxisCommon,
        ...coefficientAxis,
        name: names.coefficient,
        /* The range runs below zero to keep the axes' zeros level, and a coefficient
           has no values there. */
        axisLabel: { ...valueAxisCommon.axisLabel, formatter: (value: number) => (value < 0 ? '' : formatNumber(value)) },
        splitLine: { ...coefficientAxis.splitLine, lineStyle: { color: '#e5e7eb' } },
      },
      {
        ...valueAxisCommon,
        ...inflationAxis,
        name: names.inflation,
        splitLine: { ...inflationAxis.splitLine, lineStyle: { color: '#e5e7eb' } },
      },
      {
        ...valueAxisCommon,
        ...monthlyAxis,
        name: names.monthly,
        /* As on the coefficient axis: the range runs below zero only to keep the zeros level. */
        axisLabel: { ...valueAxisCommon.axisLabel, formatter: (value: number) => (value < 0 ? '' : formatNumber(value)) },
        splitLine: { ...monthlyAxis.splitLine, lineStyle: { color: '#e5e7eb' } },
      },
    ],
    animation: false,
    series: [
      buildCurrentDateLine(0),
      buildCurrentDateLine(1),
      ...buildEventSeriesList(events),
      ...charts.flatMap((chart, index) =>
        withPlans([chart]).map((line) => buildLineSeries(line, money, view.labels, lineColor(index), view.pick?.chart === line ? view.pick.point : null, view.lineShape))
      ),
      buildGanttSeries(groups),
    ],
    textStyle: { fontFamily: FONT, fontSize: 14 },
  };
}
