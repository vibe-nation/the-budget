import { readNames, storeNames } from './role-order';
import { humanDate, humanDateDiff, humanRangeEnd } from './timeline-format';
import { BarContent, EventItem, TimelineEvent } from './timeline.model';

/** What the card and the tooltip print where a bar has its row. */
export const EVENT_GROUP = 'Събитие';

/* The hidden ones rather than the shown: an event added later opens shown, and
   one since removed is simply never asked about. */
const HIDDEN_EVENTS_STORAGE_KEY = 'the-budget.hiddenEvents';

const GANTT_GRID = 0;
const LINE_GRID = 1;
/* A band lies under the bars, which keep their colours and show it in the gaps
   between them. A single-day line is thin, so it stays over the bars, under the
   today line. Among the data lines (ECharts draws a line series at z 3) it lies
   under them, over the reference lines (z 1). */
const UNDER_BARS_Z = 5;
const OVER_BARS_Z = 15;
const UNDER_LINES_Z = 2;
const DAY_LINE_WIDTH = 2;
const DAY_LINE_HOVER_WIDTH = 4;

export const readStoredHiddenEvents = (): ReadonlySet<string> => new Set(readNames(HIDDEN_EVENTS_STORAGE_KEY));
export const storeHiddenEvents = (hidden: ReadonlySet<string>): void => storeNames(HIDDEN_EVENTS_STORAGE_KEY, hidden);

const isSingleDay = (item: EventItem): boolean => item.value.length === 1;

/** The dropdown's order: the single days by date, then the spans by start. */
export function inMenuOrder(events: readonly TimelineEvent[]): readonly TimelineEvent[] {
  const rank = ({ items: [first] }: TimelineEvent) => (isSingleDay(first) ? 0 : 1);
  /* ISO dates sort as text. */
  return [...events].sort((a, b) => rank(a) - rank(b) || a.items[0].value[0].localeCompare(b.items[0].value[0]));
}

function eventContent(event: TimelineEvent, item: EventItem): BarContent {
  const [start, end = start] = item.value;

  return {
    id: `${event.id}|${item.value[0]}`,
    group: EVENT_GROUP,
    name: item.name,
    description: item.description,
    sources: item.sources,
    from: +new Date(start),
    to: end === null ? Date.now() : +new Date(end),
  };
}

function eventTooltip(params: { data: { content: BarContent } }): string {
  const { name, description, from, to } = params.data.content;
  const dates = from === to ? humanDate(from) : `${humanDate(from)} — ${humanRangeEnd(to)}`;
  const desc = description ? `<div style="color:#4b5563;font-size:13px;margin-top:10px;line-height:1.5;">${description}</div>` : '';

  return `<div style="font-family:'Sofia Sans',sans-serif;max-width:420px;min-width:220px;border-left:4px solid #6b7280;padding:14px 16px;white-space:normal;word-wrap:break-word;">
    <div style="margin-bottom:8px;font-size:13px;font-weight:700;color:#4b5563;">${EVENT_GROUP}</div>
    <div style="font-size:16px;font-weight:700;color:#0f1115;line-height:1.25;margin-bottom:10px;">${name}</div>
    <div style="display:flex;align-items:baseline;justify-content:space-between;gap:12px;">
      <div style="font-size:13px;font-weight:600;color:#1f2937;">${dates}</div>
      <div style="font-size:13px;color:#4b5563;white-space:nowrap;">${humanDateDiff(from, to)}</div>
    </div>
    ${desc}
  </div>`;
}

/* One grid's marks of an event: a band per span, a line per single day. Both
   grids share the series name, so the one legend entry switches them together. */
function buildEventSeries(event: TimelineEvent, grid: number) {
  const overBars = grid === GANTT_GRID;
  const spans = event.items.filter((item) => !isSingleDay(item));
  const days = event.items.filter(isSingleDay);
  const { color } = event.meta.style.itemStyle;
  const labelled = !overBars && event.meta.label !== false;

  return {
    type: 'line',
    name: event.id,
    data: [],
    xAxisIndex: grid,
    yAxisIndex: grid,
    markArea: {
      /* Among the bars the band must not take the hover and clicks, so it is
         read and clicked in the line grid, where it carries its name. */
      silent: overBars,
      ...(overBars ? { z: UNDER_BARS_Z } : {}),
      animation: false,
      emphasis: { disabled: true },
      label: { show: labelled, position: 'inside', rotate: 90, color: '#333', fontFamily: 'Sofia Sans', fontSize: 12 },
      tooltip: { formatter: eventTooltip },
      /* Epochs rather than the file's date strings: ECharts reads those as local
         midnight, the bars beside the band as UTC. */
      data: spans.map((item) => {
        const content = eventContent(event, item);
        return [{ name: item.name, xAxis: content.from, content, itemStyle: event.meta.style.itemStyle }, { xAxis: content.to }];
      }),
    },
    markLine: {
      /* The same split as the band: over the bars it is only seen. */
      silent: overBars,
      z: overBars ? OVER_BARS_Z : UNDER_LINES_Z,
      animation: false,
      symbol: 'none',
      emphasis: { lineStyle: { width: DAY_LINE_HOVER_WIDTH } },
      /* The plate keeps the name legible against the band or gridlines behind it. */
      label: {
        show: labelled,
        position: 'insideEndTop',
        formatter: '{b}',
        color: '#333',
        fontFamily: 'Sofia Sans',
        fontSize: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.85)',
        padding: [1, 3],
      },
      tooltip: { formatter: eventTooltip },
      data: days.map((item) => {
        const content = eventContent(event, item);
        return { name: item.name, xAxis: content.from, content, lineStyle: { color, type: 'solid', width: DAY_LINE_WIDTH } };
      }),
    },
  };
}

/** Every event's bands and lines over both grids. */
export function buildEventSeriesList(events: readonly TimelineEvent[]) {
  return events.flatMap((event) => [buildEventSeries(event, GANTT_GRID), buildEventSeries(event, LINE_GRID)]);
}
