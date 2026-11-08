import { describe, expect, it } from 'vitest';

import extras from '../../../../public/data/chart-extras.json';
import charts from '../../../../public/data/charts.json';
import { eurostatGuide } from './timeline-eurostat';
import { attachChartExtras } from './timeline-lines';
import { ChartExtras, ChartSeries } from './timeline.model';

const LINK = 'https://ec.europa.eu/eurostat/databrowser/bookmark/saved?lang=en';

const all = charts as unknown as ChartSeries[];
const byId = (id: string) => all.find((chart) => chart.id === id)!;
const isEurostat = (chart: ChartSeries) =>
  !!chart.sources?.some(({ url }) => url[0].includes('ec.europa.eu/eurostat'));

describe('eurostatGuide', () => {
  it('states every option of a series, by the names on Eurostat', () => {
    const guide = eurostatGuide(byId('government-interest-percent'))!;
    expect(guide.dataset).toBe('GOV_10A_MAIN');
    expect(guide.url).toContain('GOV_10A_MAIN');
    expect(guide.rows).toEqual([
      { dimension: 'Time frequency', option: 'Annual', code: 'A', meaning: 'Годишно' },
      {
        dimension: 'Unit of measure',
        option: 'Percentage of gross domestic product (GDP)',
        code: 'PC_GDP',
        meaning: 'Процент от брутния вътрешен продукт (БВП)',
      },
      {
        dimension: 'Sector',
        option: 'General government',
        code: 'S13',
        meaning: 'Сектор „Държавно управление“',
      },
      {
        dimension: 'National accounts indicator (ESA 2010)',
        option: 'Interest, expenditure',
        code: 'D41PAY',
        meaning: 'Разходи за лихви',
      },
      {
        dimension: 'Geopolitical entity (reporting)',
        option: 'Bulgaria',
        code: 'BG',
        meaning: 'България',
      },
      { dimension: 'Time', option: '1995 – 2025' },
    ]);
  });

  it('prints the months of a monthly series', () => {
    const chart = byId('inflation-annual-rate');
    const { date: first } = chart.data[0];
    const { date: last } = chart.data[chart.data.length - 1];
    expect(eurostatGuide(chart)!.rows.at(-1)).toEqual({
      dimension: 'Time',
      option: `${first.slice(0, 7)} – ${last.slice(0, 7)}`,
    });
  });

  it('leaves a point from another dataset out of the years of the series', () => {
    expect(eurostatGuide(byId('government-debt-eur'))!.rows.at(-1)?.option).toMatch(/ – 2025$/);
  });

  it('sends a point from another dataset to that dataset', () => {
    const chart = byId('government-debt-eur');
    const guide = eurostatGuide(
      chart,
      chart.data.find(({ date }) => date === '2026-06-30')!,
    )!;
    expect(guide.dataset).toBe('GOV_10Q_GGDEBT');
    expect(guide.url).toContain('GOV_10Q_GGDEBT');
    expect(guide.rows[0]).toMatchObject({
      dimension: 'Time frequency',
      option: 'Quarterly',
      code: 'Q',
    });
    expect(guide.rows.at(-1)).toEqual({ dimension: 'Time', option: '2026-Q2' });
  });

  it('keeps the series directions for a point of its own dataset', () => {
    const chart = byId('government-debt-eur');
    const point = chart.data.find(({ date }) => date === '2020-12-31')!;
    expect(eurostatGuide(chart, point)).toEqual(eurostatGuide(chart));
  });

  it('covers every Eurostat series, with a name for each of its options', () => {
    const eurostat = all.filter(isEurostat);
    expect(eurostat.length).toBeGreaterThan(0);
    const codes = ['freq', 'unit', 'sector', 'na_item', 'geo', 'age', 'statinfo', 'coicop18'];
    for (const chart of eurostat) {
      const guide = eurostatGuide(chart);
      expect(guide, chart.id).toBeDefined();
      for (const { dimension } of guide!.rows) expect(codes, chart.id).not.toContain(dimension);
    }
  });

  it('tells a saved view from the default page', () => {
    expect(eurostatGuide(byId('government-interest-percent'))!.preset).toBe(false);
    const [saved] = attachChartExtras(
      [byId('government-interest-percent')],
      [{ chartId: 'government-interest-percent', eurostatLinks: { GOV_10A_MAIN: LINK } }],
    );
    expect(eurostatGuide(saved)).toMatchObject({ url: LINK, preset: true });
  });

  it('sends a point from another dataset to its own saved view', () => {
    const quarterly = `${LINK}q`;
    const [saved] = attachChartExtras(
      [byId('government-debt-eur')],
      [
        {
          chartId: 'government-debt-eur',
          eurostatLinks: { GOV_10DD_EDPT1: LINK, GOV_10Q_GGDEBT: quarterly },
        },
      ],
    );
    const point = saved.data.find(({ date }) => date === '2026-06-30')!;
    expect(eurostatGuide(saved)!.url).toBe(LINK);
    expect(eurostatGuide(saved, point)!.url).toBe(quarterly);
  });

  it('has a saved view only for a dataset its series cites', () => {
    for (const { chartId, eurostatLinks } of extras as unknown as ChartExtras[]) {
      const cited = byId(chartId).sources!.map(({ dataset_id }) => dataset_id);
      for (const [dataset, url] of Object.entries(eurostatLinks ?? {})) {
        expect(cited, chartId).toContain(dataset);
        expect(url, chartId).toMatch(
          /^https:\/\/ec\.europa\.eu\/eurostat\/databrowser\/bookmark\/[0-9a-f-]{36}\?lang=en$/,
        );
      }
    }
  });

  it('says nothing for a series from a budget law or a draft', () => {
    expect(eurostatGuide(byId('mvr-budget-eur'))).toBeUndefined();
    expect(eurostatGuide(byId('budget-plan-debt-percent'))).toBeUndefined();
  });
});
