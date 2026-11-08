import { afterEach, describe, expect, it } from 'vitest';

import { buildTimelineOption } from './timeline-chart-option';
import { EVENT_GROUP, buildEventSeriesList, inMenuOrder, readStoredHiddenEvents, storeHiddenEvents } from './timeline-events';
import { buildLegend } from './timeline-lines';
import { GanttGroup, TimelineEvent } from './timeline.model';

const event = (id: string, value: [string, string | null], name = `Име ${id}`): TimelineEvent => ({
  id,
  meta: { style: { itemStyle: { color: 'rgba(128, 128, 128, 0.2)' } } },
  items: [{ name, value, sources: [{ name: 'Източник', link: ['https://example.org'] }] }],
});

describe('buildEventSeriesList', () => {
  const [gantt, lines] = buildEventSeriesList([event('covid', ['2020-03-13', '2022-03-30'])]) as any[];

  it('draws one band per grid under one legend name', () => {
    expect([gantt.xAxisIndex, lines.xAxisIndex]).toEqual([0, 1]);
    expect([gantt.yAxisIndex, lines.yAxisIndex]).toEqual([0, 1]);
    expect(gantt.name).toBe(lines.name);
  });

  it('leaves the bars their hover: only the line grid band is live and named', () => {
    expect(gantt.markArea.silent).toBe(true);
    expect(gantt.markArea.label.show).toBe(false);
    expect(lines.markArea.silent).toBe(false);
    expect(lines.markArea.label.show).toBe(true);
  });

  /* The bars are drawn at z 10. */
  it('lays the band under the bars and a single day over them', () => {
    expect(gantt.markArea.z).toBeLessThan(10);
    expect(gantt.markLine.z).toBeGreaterThan(10);
  });

  it('spans the same civil days as a bar with those dates', () => {
    const [start, end] = lines.markArea.data[0];

    expect(start.xAxis).toBe(Date.UTC(2020, 2, 13));
    expect(end.xAxis).toBe(Date.UTC(2022, 2, 30));
  });

  it('gives the card what it prints', () => {
    const { content } = lines.markArea.data[0][0];

    expect(content).toMatchObject({ group: EVENT_GROUP, name: 'Име covid', from: Date.UTC(2020, 2, 13), to: Date.UTC(2022, 2, 30) });
    expect(content.sources[0].link).toEqual(['https://example.org']);
  });

  it('runs an open event up to now', () => {
    const before = Date.now();
    const [, series] = buildEventSeriesList([event('war', ['2022-02-24', null])]) as any[];

    expect(series.markArea.data[0][1].xAxis).toBeGreaterThanOrEqual(before);
  });
});

describe('inMenuOrder', () => {
  const day = (id: string, date: string): TimelineEvent => ({
    id,
    meta: { style: { itemStyle: { color: '#123456' } } },
    items: [{ name: id, value: [date] }],
  });

  it('lists the single days by date, then the spans by start', () => {
    const events = [
      event('war', ['2022-02-24', null]),
      day('eu', '2007-01-01'),
      event('crisis', ['2008-09-15', '2009-06-30']),
      day('euro', '2026-01-01'),
      day('nato', '2004-03-29'),
    ];

    expect(inMenuOrder(events).map(({ id }) => id)).toEqual(['nato', 'eu', 'euro', 'crisis', 'war']);
  });

  it('leaves the given list as it was', () => {
    const events = [day('late', '2026-01-01'), day('early', '2004-03-29')];

    inMenuOrder(events);

    expect(events.map(({ id }) => id)).toEqual(['late', 'early']);
  });
});

describe('a single-date event', () => {
  const line = (color = '#123456'): TimelineEvent => ({
    id: 'eu',
    meta: { style: { itemStyle: { color } } },
    items: [{ name: 'Член на ЕС', description: 'Присъединяване', value: ['2007-01-01'] }],
  });
  const [gantt, lines] = buildEventSeriesList([line()]) as any[];

  it('draws a line in its colour at that day, and no band', () => {
    const [mark] = lines.markLine.data;

    expect(mark.xAxis).toBe(Date.UTC(2007, 0, 1));
    expect(mark.lineStyle.color).toBe('#123456');
    expect(lines.markArea.data).toEqual([]);
  });

  it('crosses both grids under one legend name', () => {
    expect(gantt.markLine.data[0].xAxis).toBe(lines.markLine.data[0].xAxis);
    expect(gantt.name).toBe(lines.name);
  });

  it('leaves the bars their hover: only the line grid line is live and named', () => {
    expect(gantt.markLine.silent).toBe(true);
    expect(gantt.markLine.label.show).toBe(false);
    expect(lines.markLine.silent).toBe(false);
    expect(lines.markLine.label.show).toBe(true);
    expect(lines.markLine.data[0].name).toBe('Член на ЕС');
  });

  it('can leave its name off the chart and keep it in the tooltip', () => {
    const unlabelled: TimelineEvent = { ...line(), meta: { ...line().meta, label: false } };
    const [ganttSeries, lineSeries] = buildEventSeriesList([unlabelled]) as any[];

    expect(ganttSeries.markLine.label.show).toBe(false);
    expect(lineSeries.markLine.label.show).toBe(false);
    expect(lineSeries.markLine.tooltip.formatter({ data: lineSeries.markLine.data[0] })).toContain('Член на ЕС');
  });

  it('can leave a band\'s name off the chart and keep it in the tooltip', () => {
    const unlabelled: TimelineEvent = {
      id: 'covid',
      meta: { label: false, style: { itemStyle: { color: '#123456' } } },
      items: [{ name: 'COVID', value: ['2020-03-13', '2022-03-30'] }],
    };
    const [, lineSeries] = buildEventSeriesList([unlabelled]) as any[];
    const [start] = lineSeries.markArea.data[0];

    expect(lineSeries.markArea.label.show).toBe(false);
    expect(lineSeries.markArea.tooltip.formatter({ data: start })).toContain('COVID');
  });

  it('gives the card one day', () => {
    const { content } = lines.markLine.data[0];

    expect(content).toMatchObject({ group: EVENT_GROUP, name: 'Член на ЕС', from: Date.UTC(2007, 0, 1), to: Date.UTC(2007, 0, 1) });
  });

  it('prints one date and no duration in the tooltip', () => {
    const html: string = lines.markLine.tooltip.formatter({ data: lines.markLine.data[0] });

    expect(html).toContain('2007');
    expect(html).not.toContain('—');
    expect(html).not.toContain('дни');
  });

  it('can share a group with a band', () => {
    const mixed: TimelineEvent = {
      id: 'mixed',
      meta: { style: { itemStyle: { color: '#123456' } } },
      items: [
        { name: 'Ден', value: ['2007-01-01'] },
        { name: 'Период', value: ['2008-01-01', '2009-01-01'] },
      ],
    };
    const [, series] = buildEventSeriesList([mixed]) as any[];

    expect(series.markLine.data.map((mark: any) => mark.name)).toEqual(['Ден']);
    expect(series.markArea.data.map(([start]: any) => start.name)).toEqual(['Период']);
  });
});

describe('the legend', () => {
  const events = [event('covid', ['2020-03-13', '2022-03-30'], 'COVID')];

  it('lists no event, since the buttons over the chart switch them, but opens them on', () => {
    const legend = buildLegend([], undefined, events);

    expect(legend.data).toEqual([]);
    expect(legend.selected).toEqual({ covid: true });
  });

  it('opens with an event off when its button was left off', () => {
    expect(buildLegend([], undefined, events, new Set(['covid'])).selected).toEqual({ covid: false });
  });

  it('takes the button over what the chart last held', () => {
    expect(buildLegend([], { covid: true }, events, new Set(['covid'])).selected).toEqual({ covid: false });
    expect(buildLegend([], { covid: false }, events).selected).toEqual({ covid: true });
  });

  it('keeps the series the reader chose alongside', () => {
    expect(buildLegend([], { 'gdp-bgn': true }, events, new Set(['covid'])).selected).toEqual({ 'gdp-bgn': true, covid: false });
  });
});

describe('the stored buttons', () => {
  afterEach(() => localStorage.clear());

  it('open with every event on', () => {
    expect(readStoredHiddenEvents().size).toBe(0);
  });

  it('come back as they were left', () => {
    storeHiddenEvents(new Set(['covid']));

    expect([...readStoredHiddenEvents()]).toEqual(['covid']);
  });
});

describe('the option', () => {
  const row: GanttGroup = { name: 'Ред', items: [{ name: 'а', value: ['2000-01-01', '2001-01-01'] }] };

  it('keeps the gantt last, where the chart looks for it', () => {
    const option = buildTimelineOption([row], [row], [], [event('covid', ['2020-03-13', '2022-03-30'])]);

    expect(option.series.filter((entry: any) => entry.markArea)).toHaveLength(2);
    expect(option.series.at(-1)).toMatchObject({ type: 'custom' });
  });
});
