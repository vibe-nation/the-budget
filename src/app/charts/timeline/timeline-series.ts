import * as echarts from 'echarts/core';
import moment from 'moment';

import { stringToColor } from './timeline-colors';
import { electionTooltipHtml } from './timeline-elections';
import { humanDate, humanDateDiff, humanRangeEnd } from './timeline-format';
import { assignLanes, laneCount } from './timeline-lanes';
import { GANTT_SERIES_ID, SEL_DIMMED, SEL_NONE, SEL_RELATED, SEL_SELECTED, V_SEL } from './timeline-selection';
import { GanttBar, GanttGroup, GanttTerm } from './timeline.model';

const MIN_LANE_HEIGHT_FOR_LABEL = 12;
/* With few rows shown each has a tall slot, and a bar filling it stops reading
   as a bar: it stays this high and centred in the slot. */
const MAX_LANE_HEIGHT_PX = 28;
const LANE_FILL = 0.8;
const CLICKED_LANE_GROWTH = 1.225;
/* Custom series stamp `z2EmphasisLift = 1` on every element they create, so
   hovering a bar lifts its rects above any sibling at z2 0 — the opaque bar then
   paints over its own name. The label sits clear of that lift. */
const LABEL_Z2 = 5;
const textWidthCache = new Map<string, number>();
/* How strongly time not yet served is painted. */
const FUTURE_OPACITY = 0.25;
/* The value slot telling the rest-of-term stripe from an ordinary bar. */
const V_TERM = 5;
/* What a bar outside the selected career fades to. */
const DIM_OPACITY = 0.35;

function needsDarkText(hex: string, opacity: number): boolean {
  if (!hex || hex[0] !== '#' || hex.length < 7) return false;
  const blend = (offset: number) => parseInt(hex.slice(offset, offset + 2), 16) * opacity + 255 * (1 - opacity);
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const L = 0.2126 * lin(blend(1)) + 0.7152 * lin(blend(3)) + 0.0722 * lin(blend(5));
  return 1.05 / (L + 0.05) < 3.0;
}

function hexToRgba(hex: string, alpha: number): string {
  const channel = (offset: number) => parseInt(hex.slice(offset, offset + 2), 16);
  return `rgba(${channel(1)}, ${channel(3)}, ${channel(5)}, ${alpha})`;
}

/* The office's term in force today, when the law fixes its end: of the terms in
   a group's `mandate`, only the one still running reaches past now. */
function runningTerm(mandate: readonly GanttTerm[] | undefined, now: number): GanttTerm | undefined {
  return mandate?.find((term) => term.value[1] !== null && +new Date(term.value[0]) <= now && now < +new Date(term.value[1]));
}

/* Diagonal stripes in the holder's colour over a faint wash of it: the same bar
   carried on, but plainly a term not yet served. Drawn at device resolution and
   scaled back, so the stripes stay crisp on a high-DPI screen. One per colour,
   strength and pixel ratio: `hover` is the denser, darker version shown under
   the cursor, and a browser zoom changes the ratio, so a tile drawn for the old
   one would come back blurred. */
const hatchCache = new Map<string, unknown>();
function mandateHatch(color: string, hover = false): unknown {
  const dpr = Math.max(1, Math.round(window.devicePixelRatio || 1));
  const key = `${color}|${hover}|${dpr}`;
  const cached = hatchCache.get(key);
  if (cached) return cached;
  const size = 8;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size * dpr;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(dpr, dpr);
  ctx.fillStyle = hexToRgba(color, hover ? 0.3 : 0.12);
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = hexToRgba(color, hover ? 0.85 : 0.5);
  ctx.lineWidth = hover ? 2 : 1.5;
  ctx.beginPath();
  /* The diagonal plus its two wrapped corner stubs tile without a seam. */
  ctx.moveTo(0, size);
  ctx.lineTo(size, 0);
  ctx.moveTo(-1, 1);
  ctx.lineTo(1, -1);
  ctx.moveTo(size - 1, size + 1);
  ctx.lineTo(size + 1, size - 1);
  ctx.stroke();
  const pattern = { image: canvas, repeat: 'repeat', scaleX: 1 / dpr, scaleY: 1 / dpr };
  hatchCache.set(key, pattern);
  return pattern;
}

export function buildGanttSeries(groups: readonly GanttGroup[]) {
  const data: GanttBar[] = [];
  const now = Date.now();
  let baseIndex = 0;

  groups.forEach((group) => {
    const lanes = assignLanes(group.items);

    group.items.forEach((item, idx) => {
      const from = new Date(item.value[0]).getTime();
      const isOngoing = item.value[1] === null;
      const to = item.value[1] === null ? Date.now() : new Date(item.value[1]).getTime();

      data.push({
        content: {
          id: `${group.name}|${item.name}|${item.value[0]}`,
          group: group.name,
          title: item.title,
          name: item.name,
          description: item.description,
          comment: item.comment,
          sources: item.sources,
          election: item.election,
          from,
          to,
        },
        name: item.name,
        value: [baseIndex + lanes[idx], from, to, item.name, isOngoing ? 1 : 0, 0, SEL_NONE],
        itemStyle: { color: item.color ?? stringToColor(item.name) },
      });
    });

    /* The rest of the office's current term, from now to the day it legally
       ends, in the lane and colour of whoever holds it now: the holder's bar
       stops at now, and this carries it on. A vacant office draws nothing, with
       no one in the post to carry the term on. Not an item of the group, so
       `assignLanes` never sees it: it starts where every ongoing bar ends. */
    const term = runningTerm(group.mandate, now);
    let holderIdx = -1;
    group.items.forEach((item, idx) => {
      if (item.value[1] !== null) return;
      if (holderIdx < 0 || item.value[0] > group.items[holderIdx].value[0]) holderIdx = idx;
    });
    if (term && holderIdx >= 0) {
      const holder = group.items[holderIdx];
      const termTo = new Date(term.value[1] as string).getTime();

      data.push({
        content: {
          id: `${group.name}|мандат|${term.value[0]}`,
          group: group.name,
          title: 'Мандат',
          name: '',
          comment: term.comment,
          sources: term.sources,
          from: new Date(term.value[0]).getTime(),
          to: termTo,
        },
        name: '',
        value: [baseIndex + lanes[holderIdx], now, termTo, '', 0, 1, SEL_NONE],
        itemStyle: { color: holder.color ?? stringToColor(holder.name) },
      });
    }

    baseIndex += laneCount(group);
  });

  return {
    type: 'custom',
    id: GANTT_SERIES_ID,
    tooltip: { formatter: timeRangeLabel },
    renderItem: renderBar,
    encode: { x: [1, 2], y: 0 },
    data,
    xAxisIndex: 0,
    yAxisIndex: 0,
    z: 10,
  };
}

function renderBar(params: any, api: any) {
  const label = String(api.value(3));
  const ongoing = api.value(4) === 1;
  const selState = api.value(V_SEL);
  const isClicked = selState === SEL_SELECTED;
  const isLit = isClicked || selState === SEL_RELATED;
  const dimFactor = selState === SEL_DIMMED ? DIM_OPACITY : 1;

  const categoryIndex = api.value(0);
  const start = api.coord([api.value(1), categoryIndex]);
  const end = api.coord([api.value(2), categoryIndex]);

  /* The clicked bar grows into the gap its lane already leaves free, so it reads
     as raised out of the row without touching the lane above. */
  const restingHeight = Math.min(api.size([0, 1])[1] * LANE_FILL, MAX_LANE_HEIGHT_PX);
  const laneHeight = isClicked ? restingHeight * CLICKED_LANE_GROWTH : restingHeight;
  const laneY = start[1] - laneHeight / 2;
  const barWidth = end[0] - start[0];

  const coordSys = {
    x: params.coordSys.x,
    y: params.coordSys.y,
    width: params.coordSys.width,
    height: params.coordSys.height,
  };

  const mainColor = api.visual('color');

  /* The unserved rest of a term: striped, unoutlined and square on the left,
     where it meets the holder's bar at the now line. Under the cursor the hatch
     turns denser and darker. */
  if (api.value(V_TERM) === 1) {
    const termShape = echarts.graphic.clipRectByRect({ x: start[0], y: laneY, width: barWidth, height: laneHeight }, coordSys);
    if (!termShape) return null;
    return {
      type: 'rect',
      shape: { ...termShape, r: [0, 3, 3, 0] },
      style: { fill: mandateHatch(mainColor), opacity: isLit ? 1 : dimFactor },
      emphasis: { style: { fill: mandateHatch(mainColor, true) } },
    };
  }

  const accentW = Math.min(4, barWidth);
  const visibleStartX = Math.max(start[0], coordSys.x);
  const visibleEndX = Math.min(end[0], coordSys.x + coordSys.width);
  const visibleWidth = visibleEndX - visibleStartX;

  let labelWidth = textWidthCache.get(label);
  if (labelWidth === undefined) {
    labelWidth = echarts.format.getTextRect(label).width;
    textWidthCache.set(label, labelWidth);
  }
  const text = label && visibleWidth > labelWidth + accentW + 16 && barWidth >= 60 && laneHeight >= MIN_LANE_HEIGHT_FOR_LABEL ? label : '';

  /* Each bar splits at today: past time is opaque, future time faded. */
  const nowX = api.coord([Date.now(), categoryIndex])[0];
  const splitX = Math.min(Math.max(nowX, start[0]), end[0]);
  const hasPast = splitX > start[0];
  const hasFuture = splitX < end[0];

  const clip = (x: number, width: number) => echarts.graphic.clipRectByRect({ x, y: laneY, width, height: laneHeight }, coordSys);
  const pastShape = hasPast ? clip(start[0], splitX - start[0]) : null;
  const futureShape = hasFuture ? clip(splitX, end[0] - splitX) : null;
  const accentShape = clip(start[0], accentW);

  const pastR = hasFuture || ongoing ? [3, 0, 0, 3] : [3, 3, 3, 3];
  const futureR = hasPast ? [0, 3, 3, 0] : [3, 3, 3, 3];

  const textX = visibleStartX + accentW + 6;

  const pastOpacity = isLit ? 1 : dimFactor;
  const futureOpacity = isLit ? 0.55 : FUTURE_OPACITY * dimFactor;
  /* The clicked bar has to stay findable among a whole career lit at once, so it
     alone gets the ink ring and the shadow beneath it. */
  const pastStroke = isClicked ? '#0f172a' : isLit ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.22)';
  const futureStroke = isClicked ? 'rgba(15,23,42,0.6)' : isLit ? 'rgba(0,0,0,0.28)' : 'rgba(0,0,0,0.1)';
  const lineWidth = isClicked ? 2 : 1;
  const clickedShadow = isClicked ? { shadowBlur: 7, shadowColor: 'rgba(15,23,42,0.45)', shadowOffsetY: 1 } : null;

  return (
    (pastShape || futureShape) && {
      type: 'group',
      children: [
        pastShape && {
          type: 'rect',
          transition: ['shape'],
          shape: { ...pastShape, r: pastR },
          /* Only the visible half carries the shadow: on both, it draws a seam
             where the two rects meet. */
          style: { fill: mainColor, stroke: pastStroke, lineWidth, opacity: pastOpacity, ...(clickedShadow ?? {}) },
          emphasis: { style: { opacity: Math.min(pastOpacity + 0.1, 1), stroke: 'rgba(0,0,0,0.55)', lineWidth: 1.5 } },
        },
        futureShape && {
          type: 'rect',
          shape: { ...futureShape, r: futureR },
          style: { fill: mainColor, stroke: futureStroke, lineWidth, opacity: futureOpacity, ...(hasPast ? {} : (clickedShadow ?? {})) },
          emphasis: { style: { opacity: Math.min(futureOpacity + 0.15, 1) } },
        },
        accentShape && {
          type: 'rect',
          shape: { ...accentShape, r: [3, 0, 0, 3] },
          style: { fill: 'rgba(0,0,0,0.28)', opacity: dimFactor },
        },
        text
          ? {
              type: 'text',
              z2: LABEL_Z2,
              style: {
                text,
                x: textX,
                y: laneY + laneHeight / 2,
                fill: needsDarkText(mainColor, hasPast ? pastOpacity : futureOpacity) ? '#1e293b' : '#FFF',
                fontFamily: 'Sofia Sans',
                fontSize: 13,
                textAlign: 'left',
                textVerticalAlign: 'middle',
                width: Math.max(0, visibleEndX - textX - 6),
                overflow: 'truncate',
                opacity: isLit ? 1 : dimFactor,
              },
            }
          : null,
      ].filter(Boolean),
    }
  );
}

/* Over the bars, but among the data lines (ECharts draws a line series at z 3)
   under them, level with the events' single days. */
const CURRENT_DATE_OVER_BARS_Z = 20;
const CURRENT_DATE_UNDER_LINES_Z = 2;

export function buildCurrentDateLine(axisIndex: number) {
  const z = axisIndex === 0 ? CURRENT_DATE_OVER_BARS_Z : CURRENT_DATE_UNDER_LINES_Z;
  /* The current moment, not today's midnight: ongoing bars end at `now` and split
     past/future there too, so a midnight line would leave them running up to a
     day past it, visible as soon as the chart is zoomed in. */
  const currentDate = new Date();

  const dateDisplay = moment().format('D MMMM YYYY');

  return {
    type: 'line',
    data: [],
    markLine: {
      z,
      /* A markLine has no stroke of its own, so the 1px outline is a wider, darker
         copy drawn first, with the green line painted down its middle. */
      data: [
        {
          xAxis: currentDate.getTime(),
          lineStyle: { color: '#00873d', type: 'solid', width: 5 },
          label: { show: false },
        },
        {
          xAxis: currentDate.getTime(),
          lineStyle: { color: '#00e676', type: 'solid', width: 3 },
          label: { show: false },
        },
      ],
      tooltip: {
        formatter: () =>
          `<div style="font-family:'Sofia Sans',sans-serif;min-width:160px;border-left:4px solid #00e676;padding:10px 14px;">
            <div style="font-size:13px;font-weight:700;color:#00873d;margin-bottom:4px;">Днес</div>
            <div style="font-size:14px;font-weight:600;color:#0f1115;">${dateDisplay}</div>
          </div>`,
      },
      silent: false,
      animation: false,
      symbol: 'none',
    },
    xAxisIndex: axisIndex,
    yAxisIndex: axisIndex,
    z,
  };
}

function timeRangeLabel(params: any): string {
  const c = params.data?.content;
  if (!c) return '';

  const fill = params.data?.itemStyle?.color ?? params.color ?? '#3b82f6';
  const title = c.name || c.title || '';
  /* A parliament's spelled-out name adds nothing above its election results. */
  const lawTitle =
    c.title && c.title !== title && !c.election ? `<div style="color:#4b5563;font-size:13px;margin-top:10px;line-height:1.5;">${c.title}</div>` : '';
  const desc = c.description ? `<div style="color:#4b5563;font-size:13px;margin-top:10px;line-height:1.5;">${c.description}</div>` : '';
  const comment = c.comment ? `<div style="color:#4b5563;font-size:13px;font-style:italic;margin-top:8px;line-height:1.5;">${c.comment}</div>` : '';
  const election = c.election ? electionTooltipHtml(c.election) : '';

  return `<div style="font-family:'Sofia Sans',sans-serif;max-width:420px;min-width:220px;border-left:4px solid ${fill};padding:14px 16px;white-space:normal;word-wrap:break-word;">
    <div style="margin-bottom:8px;font-size:13px;font-weight:700;color:#4b5563;">${c.group}</div>
    <div style="font-size:16px;font-weight:700;color:#0f1115;line-height:1.25;margin-bottom:10px;">${title}</div>
    <div style="height:1px;background:#f4f5f7;margin-bottom:10px;"></div>
    <div style="display:flex;align-items:baseline;justify-content:space-between;gap:12px;">
      <div style="font-size:13px;font-weight:600;color:#1f2937;">${humanDate(c.from)} — ${humanRangeEnd(c.to)}</div>
      <div style="font-size:13px;color:#4b5563;white-space:nowrap;">${humanDateDiff(c.from, c.to)}</div>
    </div>
    ${election}${lawTitle}${desc}${comment}
  </div>`;
}
