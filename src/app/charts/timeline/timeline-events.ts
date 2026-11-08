import * as echarts from 'echarts/core';

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
const DAY_LINE_SELECTED_WIDTH = 5;
const BAND_SELECTED_FILL_ALPHA = 0.34;

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

const eventSeriesId = (event: TimelineEvent, grid: number): string => `event:${event.id}:${grid}`;

/* The selected band keeps its hue: only its strength says it is picked. */
function bandData(event: TimelineEvent, selectedId: string | null) {
  const { itemStyle } = event.meta.style;

  return event.items
    .filter((item) => !isSingleDay(item))
    .map((item) => {
      const content = eventContent(event, item);
      const color = content.id === selectedId ? echarts.color.modifyAlpha(itemStyle.color, BAND_SELECTED_FILL_ALPHA) : itemStyle.color;
      return [{ name: item.name, xAxis: content.from, content, itemStyle: { ...itemStyle, color } }, { xAxis: content.to }];
    });
}

function dayLineData(event: TimelineEvent, selectedId: string | null) {
  const { color } = event.meta.style.itemStyle;

  return event.items.filter(isSingleDay).map((item) => {
    const content = eventContent(event, item);
    const lineStyle = { color, type: 'solid', width: DAY_LINE_WIDTH };
    if (content.id !== selectedId) return { name: item.name, xAxis: content.from, content, lineStyle };
    return {
      name: item.name,
      xAxis: content.from,
      content,
      lineStyle: { ...lineStyle, width: DAY_LINE_SELECTED_WIDTH, shadowBlur: 6, shadowColor: 'rgba(15, 17, 21, 0.45)' },
      /* The series' hover width is thinner, and would shrink the line under the pointer. */
      emphasis: { lineStyle: { width: DAY_LINE_SELECTED_WIDTH } },
    };
  });
}

/* One grid's marks of an event: a band per span, a line per single day. Both
   grids share the series name, so the one legend entry switches them together. */
function buildEventSeries(event: TimelineEvent, grid: number, selectedId: string | null) {
  const overBars = grid === GANTT_GRID;
  const labelled = !overBars && event.meta.label !== false;

  return {
    id: eventSeriesId(event, grid),
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
      data: bandData(event, selectedId),
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
      data: dayLineData(event, selectedId),
    },
  };
}

/**
 * Every event's bands and lines over both grids.
 *
 * @param selectedId The picked item's card id, baked in so a rebuild keeps it lit.
 */
export function buildEventSeriesList(events: readonly TimelineEvent[], selectedId: string | null = null) {
  return events.flatMap((event) => [buildEventSeries(event, GANTT_GRID, selectedId), buildEventSeries(event, LINE_GRID, selectedId)]);
}

/** The partial series that move the selection from one item to another; empty if no event is involved. */
export function eventSelectionUpdate(events: readonly TimelineEvent[], previousId: string | null, selectedId: string | null): object[] {
  return events
    .filter((event) => event.items.some((item) => [previousId, selectedId].includes(eventContent(event, item).id)))
    .flatMap((event) =>
      [GANTT_GRID, LINE_GRID].map((grid) => ({
        id: eventSeriesId(event, grid),
        markArea: { data: bandData(event, selectedId) },
        markLine: { data: dayLineData(event, selectedId) },
      }))
    );
}
