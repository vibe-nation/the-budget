import { readFlag, storeFlag } from './role-order';
import { humanDate, shortDate } from './timeline-format';
import { DEFAULT_MONEY, MoneyView, convertMoney, formatNumber, isMoney, moneySuffix } from './timeline-money';
import { CardContent, CardReading, ChartExtras, ChartPoint, ChartSeries, HorizontalLine, LawCitation, Source, TimelineEvent } from './timeline.model';

/** The value axes of the line grid, in `yAxis` order after the gantt's own. */
export const PERCENT_AXIS = 1;
export const MONEY_AXIS = 2;
export const COEFFICIENT_AXIS = 3;
export const INFLATION_AXIS = 4;
export const MONTHLY_AXIS = 5;

export type ValueAxisName = 'percent' | 'money' | 'coefficient' | 'inflation' | 'monthly';

const AXIS_INDEX: Readonly<Record<ValueAxisName, number>> = {
  percent: PERCENT_AXIS,
  money: MONEY_AXIS,
  coefficient: COEFFICIENT_AXIS,
  inflation: INFLATION_AXIS,
  monthly: MONTHLY_AXIS,
};

/* Set on each line rather than left to ECharts' palette, which also deals to the
   event bands: every event added would recolour all the lines. */
export const LINE_COLORS = [
  '#0ca8df',
  '#ffd10a',
  '#fb628b',
  '#785db0',
  '#3fbe95',
  '#f0822e',
  '#8a6d3b',
  '#3d5a80',
  '#c0392b',
  '#00796b',
  '#7f8c8d',
  '#b8860b',
  '#ad1457',
  '#5c6bc0',
  '#558b2f',
  '#00acc1',
  '#4e342e',
  '#6a1b9a',
];

/** The colour of the series at `index` of the chart list, on the chart and in the legend alike. */
export const lineColor = (index: number): string => LINE_COLORS[index % LINE_COLORS.length];

/** Each series with the plan that names it in `meta.planOf`. A plan leaves the list, so it takes no
 *  legend entry and no colour of its own; one whose series is missing stays a series of its own.
 *  It takes its series' axis and whole-year drawing, so the two always stand on one scale. */
export function attachPlans(charts: readonly ChartSeries[]): ChartSeries[] {
  const byId = new Map(charts.map((chart) => [chart.id, chart]));
  const isPlan = (chart: ChartSeries) => !!chart.meta?.planOf && byId.has(chart.meta.planOf);
  const plans = new Map(charts.filter(isPlan).map((plan) => [plan.meta!.planOf!, plan]));
  const drawnLike = (plan: ChartSeries, { meta }: ChartSeries): ChartSeries => {
    const { axis, wholeYear, ...own } = plan.meta ?? {};
    return { ...plan, meta: { ...own, ...(meta?.axis ? { axis: meta.axis } : {}), ...(meta?.wholeYear ? { wholeYear: true } : {}) } };
  };
  return charts
    .filter((chart) => !isPlan(chart))
    .map((chart) => {
      const plan = plans.get(chart.id);
      return plan ? { ...chart, plan: drawnLike(plan, chart) } : chart;
    });
}

/** The series and their plans: everything the line grid draws. */
export const withPlans = (charts: readonly ChartSeries[]): ChartSeries[] => charts.flatMap((chart) => (chart.plan ? [chart, chart.plan] : [chart]));

/** The series a line on the chart draws. A plan's line carries its series' name, which the legend
 *  switches by, so its own id tells the two apart. */
export function chartOfLine(charts: readonly ChartSeries[], seriesName: unknown, seriesId: unknown): ChartSeries | undefined {
  const chart = charts.find(({ id }) => id === seriesName);
  return chart?.plan && chart.plan.id === seriesId ? chart.plan : chart;
}

/** The colour a series is drawn in: a plan takes its series'. */
export function chartColor(charts: readonly ChartSeries[], chart: ChartSeries): string {
  return lineColor(charts.findIndex((entry) => entry === chart || entry.plan === chart));
}

/** Which series the legend has on, by series id. */
export type LegendSelection = Readonly<Record<string, boolean>>;

/** How many series, from the top of the chart list, the legend opens with on. */
export const STARTING_LINES = 4;

/** The legend before the reader has touched it: a series not named here is on.
 *  Only the first `STARTING_LINES` open on, and of those not a part of a total. */
export const startingLegend = (charts: readonly ChartSeries[]): LegendSelection =>
  Object.fromEntries(
    charts.filter(({ meta }, index) => index >= STARTING_LINES || meta?.startsOff).map(({ id }) => [id, false]),
  );

/** The legend with one series switched the other way. */
export const toggledLegend = (selection: LegendSelection, id: string): LegendSelection => ({ ...selection, [id]: selection[id] === false });

/** The legend with every series on, or every series off. */
export const legendForAll = (charts: readonly ChartSeries[], shown: boolean): LegendSelection =>
  Object.fromEntries(charts.map(({ id }) => [id, shown]));

/** The legend with these series on or off and the others as they were. */
export const legendWith = (selection: LegendSelection, charts: readonly ChartSeries[], shown: boolean): LegendSelection => ({
  ...selection,
  ...legendForAll(charts, shown),
});

/** The legend the chart draws: the reader's, with every series the search leaves out
 *  off. It names every series, since ECharts merges a legend update into the last
 *  one and would keep a series off that the picks no longer leave out. The
 *  reader's own switches stay apart, so they are all back once the picks are
 *  cleared. */
export const drawnLegend = (selection: LegendSelection, charts: readonly ChartSeries[], picked: ReadonlySet<string>): LegendSelection =>
  Object.fromEntries(charts.map(({ id }) => [id, selection[id] !== false && (!picked.size || picked.has(id))]));

const LABELS_STORAGE_KEY = 'the-budget.lineLabels';
export const readStoredLabels = (): boolean => readFlag(LABELS_STORAGE_KEY);
export const storeLabels = (shown: boolean): void => storeFlag(LABELS_STORAGE_KEY, shown);

/** How a whole-year line is drawn: held flat across its year, or straight from point to point. */
export type LineShape = 'step' | 'line';
export const DEFAULT_LINE_SHAPE: LineShape = 'step';

const LINE_SHAPE_STORAGE_KEY = 'the-budget.lineShape';

/* localStorage throws when it is unavailable, and what it holds may predate the
   current values: either way the default stands. */
export function readStoredLineShape(): LineShape {
  try {
    return localStorage.getItem(LINE_SHAPE_STORAGE_KEY) === 'line' ? 'line' : DEFAULT_LINE_SHAPE;
  } catch {
    return DEFAULT_LINE_SHAPE;
  }
}

export function storeLineShape(shape: LineShape): void {
  try {
    localStorage.setItem(LINE_SHAPE_STORAGE_KEY, shape);
  } catch {
    /* Not kept; the choice holds until the page is left. */
  }
}

/** Whether a series is drawn as steps: a whole-year figure, unless the reader asked for plain lines. */
export const isStepped = (chart: ChartSeries, shape: LineShape = DEFAULT_LINE_SHAPE): boolean =>
  shape === 'step' && !!chart.meta?.wholeYear;

/* Coarser than the tooltip's: a label has to fit beside its neighbours. Adding
   zero turns the -0 of a small negative into 0, which prints no sign. */
const labelNumber = new Intl.NumberFormat('bg-BG', { maximumFractionDigits: 1 });
const formatLabel = (value: number) => labelNumber.format(Math.round(value * 10) / 10 + 0);

/* A true minus: the hyphen `Intl` prints is a dash's width short of the plus. */
const tooltipNumber = (value: number) => formatNumber(value).replace('-', '−');
const signed = (value: number) => `${value > 0 ? '+' : ''}${tooltipNumber(value)}`;

/* Direction only, on every series: up is ochre and down is blue, since whether
   a rise is good differs by metric, and green or red would say that it is. */
const CHANGE_COLORS = {
  up: { text: '#b45309', band: '#fff4e5' },
  down: { text: '#1d4ed8', band: '#e8efff' },
} as const;

/* A percentage's change is in points, which the relative percent beside it is not. */
const changeSuffix = (chart: ChartSeries, suffix: string) => (chart.unit === 'percent' ? ' пр.п.' : suffix);

const TOOLTIP_FONT = "font-family:'Sofia Sans',sans-serif;";

function pointTooltip(chart: ChartSeries, suffix: string, marker: string, content: ChartPoint): string {
  const { date, value, change = 0, change_percent: changePercent = 0 } = content;
  /* A currency stands off the amount; a percent sign hugs its number. */
  const unit = suffix.trim()
    ? `<span style="font-size:14px;font-weight:600;color:#475569;margin-left:${suffix.startsWith(' ') ? 4 : 1}px;">${suffix.trim()}</span>`
    : '';
  const direction = change > 0 ? 'up' : change < 0 ? 'down' : null;
  const band = direction
    ? `<div data-change="${direction}" style="display:flex;justify-content:space-between;align-items:baseline;gap:12px;margin-top:11px;padding:8px 14px 10px;background:${CHANGE_COLORS[direction].band};color:${CHANGE_COLORS[direction].text};font-variant-numeric:tabular-nums;">
          <div style="font-weight:700;"><span style="font-size:12px;">${direction === 'up' ? '▲' : '▼'}</span> ${signed(change)}${changeSuffix(chart, suffix)}</div>
          <div style="font-weight:600;white-space:nowrap;">${signed(changePercent)}%</div>
        </div>`
    : '';

  return `<div style="${TOOLTIP_FONT}max-width:420px;min-width:220px;padding:12px 0 ${direction ? 0 : 13}px;white-space:normal;word-wrap:break-word;line-height:1.3;">
      <div style="font-size:14px;font-weight:700;color:#0f1115;padding:0 14px;">${marker}${chart.name}</div>
      <div style="display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin-top:8px;padding:0 14px;">
        <div style="font-size:22px;font-weight:800;color:#0f1115;letter-spacing:-0.01em;font-variant-numeric:tabular-nums;">${tooltipNumber(value)}${unit}</div>
        <div style="font-size:13px;color:#64748b;white-space:nowrap;">${shortDate(date)}</div>
      </div>
      ${band}
    </div>`;
}

/* An amount per person a month is read whole: „млрд.“ would turn it into a string of zeros. */
const seriesMoney = (chart: ChartSeries, money: MoneyView): MoneyView => (chart.meta?.axis === 'monthly' ? { ...money, magnitude: 1 } : money);

/** How a series' stored values are drawn: money in the reader's units, anything else as published. */
export function displayValue(chart: ChartSeries, money: MoneyView): (value: number) => number {
  return (value) => (isMoney(chart) ? convertMoney(value, chart.unit, seriesMoney(chart, money)) : value);
}

/** The axis a series is drawn on: its unit's, unless the series asks for one of its own. */
export function valueAxisOf(chart: ChartSeries): ValueAxisName {
  if (chart.meta?.axis) return chart.meta.axis;
  if (isMoney(chart)) return 'money';
  return chart.unit === 'coefficient' ? 'coefficient' : 'percent';
}

/* A coefficient states no unit of its own: its axis names it. */
const unitSuffix = (chart: ChartSeries, money: MoneyView) =>
  chart.unit === 'percent' ? '%' : chart.unit === 'coefficient' ? '' : moneySuffix(seriesMoney(chart, money));

/** Each series with what `chart-extras.json` gives it, by id. */
export function attachChartExtras(charts: readonly ChartSeries[], extras: readonly ChartExtras[]): ChartSeries[] {
  const byChart = new Map(extras.map((entry) => [entry.chartId, entry]));
  return charts.map((chart) => ({ ...chart, horizontalLines: byChart.get(chart.id)?.horizontalLines }));
}

/** A series picked on the chart, and the point on it, if the click landed on one. */
export interface ChartPick {
  readonly chart: ChartSeries;
  readonly point: ChartPoint | null;
}

/* An annual series can end on a later quarter's reading: only a point closing a
   calendar year speaks for that whole year. */
const closesYear = (chart: ChartSeries, point: ChartPoint) => chart.dataset?.selection?.freq?.code === 'A' && point.date.endsWith('-12-31');

/** A reading labelled by its year in an annual series, and by its date otherwise. */
function pointReading(chart: ChartSeries, point: ChartPoint, money: MoneyView): CardReading {
  const value = `${formatNumber(displayValue(chart, money)(point.value))}${unitSuffix(chart, money)}`;
  const date = humanDate(point.date);
  return closesYear(chart, point) ? { label: `за ${point.date.slice(0, 4)} г. —`, value, note: date } : { label: `към ${date}`, value };
}

/** The file every series on the chart comes from. */
export const CHARTS_URL = 'data/charts.json';

/* One thing measured in two units is one metric, so both series read one description. */
const metricName = (id: string) => id.replace(/-(eur|bgn|percent)$/, '');

/* As the law prints it, with the decimal a budget table always shows. */
const lawAmount = new Intl.NumberFormat('bg-BG', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
/* Except a plain amount per person, which a law prints as it would be paid. */
const lawPlainAmount = new Intl.NumberFormat('bg-BG', { maximumFractionDigits: 2 });
const isThousands = (unit: string) => /^(хил|млн)\./.test(unit);

/* Article, then whichever of paragraph, point and letter the law uses. */
function lawPlace({ article, paragraph, point, letter }: LawCitation): string {
  return [`чл. ${article}`, paragraph && `ал. ${paragraph}`, point && `т. ${point}`, letter && `б. „${letter}“`].filter(Boolean).join(', ');
}

const lawPage = ({ page, actPage }: LawCitation['gazette']) => (page ? `стр. ${page}` : `актът започва на стр. ${actPage}`);

/** A law citation in the card's terms: the row and amount as a quote, its place in the law as the locator. */
function lawSource(citation: LawCitation): Source {
  const { title, amount, amountUnit, annex, row, gazette, fileUrl, filePage } = citation;
  const figure = (isThousands(amountUnit) ? lawAmount : lawPlainAmount).format(amount);
  return {
    name: title,
    /* `#page` opens the ministry's PDF on the figure, which neither gazette link can do. */
    link: [gazette.actUrl, gazette.issueUrl, `${fileUrl}#page=${filePage}`].filter((url): url is string => !!url),
    media: 'Държавен вестник',
    date: gazette.date,
    quote: `${row}: ${figure} ${amountUnit} [${annex ?? lawPlace(citation)}; ${gazette.citation}, ${lawPage(gazette)}]`,
  };
}

/** A series as the detail card prints it: its name and sources, and the reading of the picked point. */
export function chartCard(chart: ChartSeries, point: ChartPoint | null = null, money: MoneyView = DEFAULT_MONEY): CardContent {
  const { id, name, sources } = chart;
  return {
    id: point ? `${id}|${point.date}` : id,
    group: '',
    name,
    metric: metricName(id),
    sources: point?.sources?.map(lawSource) ?? sources?.map((source) => ({ name: source.name.bg, link: source.url })),
    ...(point ? { reading: pointReading(chart, point, money) } : {}),
  };
}

/** The point closest to `time`: a click on the line itself reports no point of its own. */
export function nearestPoint(points: readonly ChartPoint[], time: number): ChartPoint | null {
  const distance = (point: ChartPoint) => Math.abs(+new Date(point.date) - time);
  return points.reduce<ChartPoint | null>((best, point) => (!best || distance(point) < distance(best) ? point : best), null);
}

/** The point of the year at `time` on a stepped line, which is the one closing it; the closest otherwise. */
export function pointAtTime(chart: ChartSeries, time: number, shape: LineShape = DEFAULT_LINE_SHAPE): ChartPoint | null {
  if (!isStepped(chart, shape)) return nearestPoint(chart.data, time);
  return chart.data.find(({ date }) => +new Date(date) >= time) ?? chart.data.at(-1) ?? null;
}

/* A step needs somewhere to start, so a whole-year line opens on the close of the
   year before its first point, at that point's value. It is drawn and nothing more:
   the reader's points stay `chart.data`. */
export function drawnPoints(chart: ChartSeries, shape: LineShape = DEFAULT_LINE_SHAPE): readonly ChartPoint[] {
  const { data } = chart;
  const [first] = data;
  if (!isStepped(chart, shape) || !first) return data;
  return [{ ...first, date: `${Number(first.date.slice(0, 4)) - 1}${first.date.slice(4)}` }, ...data];
}

/* Filled and larger than the hollow points around it. Silent, so a click on it
   reaches the point beneath and takes the same path as any other. The date stays
   a string: an axis reads one as local midnight, and the point's own value is one. */
export function pointMark(chart: ChartSeries, point: ChartPoint, money: MoneyView, color: string) {
  return {
    silent: true,
    animation: false,
    symbol: 'circle',
    symbolSize: 13,
    label: { show: false },
    itemStyle: { color, borderColor: '#ffffff', borderWidth: 2.5, shadowBlur: 6, shadowColor: 'rgba(15, 17, 21, 0.45)' },
    data: [{ coord: [point.date, displayValue(chart, money)(point.value)] }],
  };
}

/* At the left end, as the room past the now line is too small on a phone, and on
   the line rather than above it: the levels can stand closer together than the
   text is high. The fill hides the line and the bands behind it, but a series is
   drawn over it, so a label has to stay short enough to end before the data. */
const LINE_LABEL_STYLE = {
  show: true,
  position: 'insideStart',
  fontFamily: 'Sofia Sans',
  fontSize: 12,
  color: '#1f2937',
  backgroundColor: '#ffffff',
  padding: [1, 4],
};

/* On the series itself, so the legend switches them with it. Their own tooltip,
   since they carry no point for the series tooltip to read. Hovering a series
   line fades the others, which must not take these along. */
function buildHorizontalLines(chart: ChartSeries, lines: readonly HorizontalLine[], convert: (value: number) => number, suffix: string) {
  return {
    silent: false,
    /* Behind the series' own line, which it would otherwise cover where they meet. */
    z: 1,
    symbol: 'none',
    animation: false,
    label: { show: false },
    emphasis: { disabled: true },
    blur: { lineStyle: { opacity: 1 } },
    tooltip: {
      formatter: ({ dataIndex }: { dataIndex: number }) => {
        const { value, color } = lines[dataIndex];

        return `<div style="font-family:'Sofia Sans',sans-serif;min-width:160px;border-left:4px solid ${color};padding:10px 14px;">
          <div style="font-size:13px;color:#4b5563;margin-bottom:4px;">${chart.name}</div>
          <div style="font-size:16px;font-weight:700;color:#0f1115;">${formatNumber(convert(value))}${suffix}</div>
        </div>`;
      },
    },
    data: lines.map(({ value, color, width, type = 'solid', label }) => ({
      yAxis: convert(value),
      lineStyle: { color, width, type },
      ...(label ? { label: { ...LINE_LABEL_STYLE, formatter: label } } : {}),
    })),
  };
}

/* Laws before 2026 are in leva and the debt series is in euro, so everything is
   brought to one denomination: a line mixing the two would misstate the scale. */
export function buildLineSeries(
  chart: ChartSeries,
  money: MoneyView = DEFAULT_MONEY,
  showLabels = false,
  color = LINE_COLORS[0],
  picked: ChartPoint | null = null,
  shape: LineShape = DEFAULT_LINE_SHAPE
) {
  const stepped = isStepped(chart, shape);
  const convert = displayValue(chart, money);
  const suffix = unitSuffix(chart, money);

  return {
    /* A plan goes by its series' name, so that the legend switches the two together. */
    id: chart.id,
    name: chart.meta?.planOf ?? chart.id,
    type: 'line',
    xAxisIndex: 1,
    yAxisIndex: AXIS_INDEX[valueAxisOf(chart)],
    symbolSize: 5,
    /* A click anywhere along the line counts, not only on its points. */
    triggerEvent: 'line',
    /* The point under the cursor shows its number even with the labels off, and
       grows to 11px: ECharts' own 1.1 is too little to tell it from its neighbours. */
    emphasis: { focus: 'series', scale: 2.2, label: { show: true } },
    label: {
      show: showLabels,
      position: 'top',
      fontFamily: 'Sofia Sans',
      fontSize: 12,
      formatter: (params: any) => formatLabel(params.data.content.value),
    },
    /* Lines run close together, and long figures reach their neighbours: what
       would collide is left out, and stays a hover away. */
    labelLayout: { hideOverlap: true },
    itemStyle: { color },
    lineStyle: { color },
    ...(chart.horizontalLines?.length ? { markLine: buildHorizontalLines(chart, chart.horizontalLines, convert, suffix) } : {}),
    ...(picked ? { markPoint: pointMark(chart, picked, money, color) } : {}),
    /* `start`, as a point is dated on the last day of its year: the line rises as
       the year opens and reaches the point flat. */
    ...(stepped ? { step: 'start' } : {}),
    ...chart.meta?.style,
    tooltip: {
      formatter: (params: any) => pointTooltip(chart, suffix, params.marker, params.data.content),
    },
    data: drawnPoints(chart, shape).map((point, index) => ({
      content: {
        date: point.date,
        value: convert(point.value),
        change: point.change ? convert(point.change) : 0,
        change_percent: point.change_percent ?? 0,
      },
      value: [point.date, convert(point.value)],
      ...(stepped && index === 0 ? { symbol: 'none', label: { show: false } } : {}),
    })),
  };
}

/**
 * The chart's legend component, never drawn: `LinesLegend` shows the series in
 * HTML beside the grid, and the events have their own menu. It stays because it
 * is what switches a series on and off by name, and what filters the series.
 *
 * @param selected The legend as the reader left it; omitted on the first build,
 *   which opens with every series on.
 * @param events The bands across the grids, switched like the series.
 * @param hiddenEvents What the events menu has off. It owns that state, so this
 *   wins over `selected`.
 */
export function buildLegend(
  charts: readonly ChartSeries[],
  selected: LegendSelection | undefined,
  events: readonly TimelineEvent[] = [],
  hiddenEvents: ReadonlySet<string> = new Set()
) {
  return {
    show: false,
    data: charts.map((chart) => chart.id),
    selected: {
      ...(selected ?? Object.fromEntries(charts.map((chart) => [chart.id, true]))),
      ...Object.fromEntries(events.map((event) => [event.id, !hiddenEvents.has(event.id)])),
    },
  };
}
