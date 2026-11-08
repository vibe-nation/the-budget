import moment from 'moment';
import 'moment/locale/bg';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { buildTimelineOption } from './timeline-chart-option';
import {
  COEFFICIENT_AXIS,
  INFLATION_AXIS,
  LINE_COLORS,
  MONEY_AXIS,
  MONTHLY_AXIS,
  PERCENT_AXIS,
  attachChartExtras,
  attachPlans,
  buildLegend,
  buildLineSeries,
  chartCard,
  chartColor,
  chartOfLine,
  drawnLegend,
  legendForAll,
  legendWith,
  nearestPoint,
  pointAtTime,
  pointMark,
  readStoredLabels,
  startingLegend,
  storeLabels,
  toggledLegend,
} from './timeline-lines';
import { ChartPoint, ChartSeries, GanttGroup } from './timeline.model';
import charts from '../../../../public/data/charts.json';
import extras from '../../../../public/data/chart-extras.json';

const series = (id: string, unit: ChartSeries['unit'], value = 1): ChartSeries => ({
  id,
  name: `Име ${id}`,
  unit,
  data: [{ date: '2023-12-31', value, change: value / 2, change_percent: 10 }],
});

describe('the lines on offer', () => {
  const all = attachPlans(charts as unknown as ChartSeries[]);

  it('draw every plan with the series it names', () => {
    const plans = (charts as unknown as ChartSeries[]).filter(({ meta }) => meta?.planOf);
    expect(plans.length).toBeGreaterThan(0);
    for (const plan of plans) expect(all.find(({ id }) => id === plan.meta!.planOf)?.plan?.id).toBe(plan.id);
  });

  it('never share a colour', () => {
    expect(LINE_COLORS.length).toBeGreaterThanOrEqual(all.length);
    expect(new Set(LINE_COLORS).size).toBe(LINE_COLORS.length);
  });

  it('open with only the first four lines on', () => {
    const starting = startingLegend(all);
    const on = all.filter(({ id }) => starting[id] !== false).map(({ id }) => id);

    expect(on).toEqual(all.slice(0, 4).map(({ id }) => id));
    expect(starting['mvr-budget-eur']).toBe(false);
    expect(starting['prosecution-budget-eur']).toBe(false);
  });

  it('keep a part of a total off even among the first four', () => {
    const series = (id: string, startsOff = false) => ({ id, meta: { startsOff } }) as unknown as ChartSeries;
    const starting = startingLegend([series('a'), series('b', true), series('c'), series('d'), series('e')]);

    expect(starting).toEqual({ b: false, e: false });
  });

  it('end the investigators in 2009, the last year the law lists them apart', () => {
    for (const id of ['national-investigation-budget-eur', 'investigation-services-budget-eur']) {
      expect(all.find((chart) => chart.id === id)?.data.at(-1)?.date).toBe('2009-12-31');
    }
  });

  it('hold a budget or a year\'s deficit flat across its year, and let a reading at a moment slope', () => {
    const held = (match: (id: string) => boolean) => all.filter(({ id }) => match(id)).map(({ meta }) => !!meta?.wholeYear);

    expect(held((id) => id.endsWith('-budget-eur'))).toEqual(all.filter(({ id }) => id.endsWith('-budget-eur')).map(() => true));
    expect(held((id) => id.startsWith('government-deficit-and-surplus'))).toEqual([true, true]);
    expect(held((id) => id.startsWith('government-debt') || id === 'inflation-annual-rate' || id === 'gini-coefficient')).toEqual([false, false, false, false]);
  });

  it('give a whole-year line one closing point for every year it covers', () => {
    for (const { id, data } of all.filter(({ meta }) => meta?.wholeYear)) {
      const years = data.map(({ date }) => Number(date.slice(0, 4)));

      expect(data.every(({ date }) => date.endsWith('-12-31')), id).toBe(true);
      expect(years, id).toEqual(years.map((_, index) => years[0] + index));
    }
  });
});

describe('a line for a whole year', () => {
  const wholeYear = (...values: number[]): ChartSeries => ({
    id: 'a',
    name: 'Име',
    unit: 'percent',
    meta: { wholeYear: true },
    data: values.map((value, index) => ({ date: `${2020 + index}-12-31`, value })),
  });

  it('rises at the start of the year and runs flat to the point closing it', () => {
    expect(buildLineSeries(wholeYear(1, 2))).toMatchObject({ step: 'start' });
  });

  it('leaves a line of readings sloped', () => {
    expect(buildLineSeries(series('a', 'percent'))).not.toHaveProperty('step');
  });

  it('opens a year before its first point, so the first year is drawn too', () => {
    const { data } = buildLineSeries(wholeYear(1, 2));

    expect(data.map(({ value }) => value)).toEqual([
      ['2019-12-31', 1],
      ['2020-12-31', 1],
      ['2021-12-31', 2],
    ]);
  });

  it('shows neither a mark nor a label at that opening', () => {
    expect(buildLineSeries(wholeYear(1, 2)).data[0]).toMatchObject({ symbol: 'none', label: { show: false } });
    expect(buildLineSeries(wholeYear(1, 2)).data[1]).not.toHaveProperty('symbol');
  });

  it('adds no opening to a line of readings', () => {
    expect(buildLineSeries(series('a', 'percent')).data).toHaveLength(1);
  });

  it('draws nothing for a series without points', () => {
    expect(buildLineSeries(wholeYear()).data).toEqual([]);
  });

  it('names the point each item draws, which a click looks up by date', () => {
    const chart = wholeYear(1, 2);
    const drawn = buildLineSeries(chart).data.slice(1).map(({ content }) => content.date);

    expect(drawn).toEqual(chart.data.map(({ date }) => date));
  });

  it('answers a click on a year with that year, even early in it', () => {
    expect(pointAtTime(wholeYear(1, 2, 3), +new Date('2021-03-01'))?.value).toBe(2);
    expect(pointAtTime(wholeYear(1, 2, 3), +new Date('2021-11-01'))?.value).toBe(2);
  });

  it('answers a click on the opening year with the first point', () => {
    expect(pointAtTime(wholeYear(1, 2), +new Date('2020-03-01'))?.value).toBe(1);
  });

  it('keeps to the last point past the end of the line', () => {
    expect(pointAtTime(wholeYear(1, 2), +new Date('2040-01-01'))?.value).toBe(2);
  });

  it('leaves a click on a line of readings to the nearest point', () => {
    const chart = { ...wholeYear(1, 2, 3), meta: undefined };

    expect(pointAtTime(chart, +new Date('2021-03-01'))?.value).toBe(1);
  });

  describe('when the reader asks for plain lines', () => {
    it('slopes from point to point', () => {
      expect(buildLineSeries(wholeYear(1, 2), undefined, false, undefined, null, 'line')).not.toHaveProperty('step');
    });

    it('adds no opening a year early', () => {
      const { data } = buildLineSeries(wholeYear(1, 2), undefined, false, undefined, null, 'line');

      expect(data.map(({ value }) => value)).toEqual([
        ['2020-12-31', 1],
        ['2021-12-31', 2],
      ]);
      expect(data[0]).not.toHaveProperty('symbol');
    });

    it('answers a click with the nearest point', () => {
      expect(pointAtTime(wholeYear(1, 2, 3), +new Date('2021-03-01'), 'line')?.value).toBe(1);
    });
  });
});

describe('a monthly amount on the card', () => {
  beforeAll(() => moment.locale('bg'));
  afterAll(() => moment.locale('en'));

  const threshold: ChartSeries = { ...series('threshold-eur', 'EUR', 2300), meta: { axis: 'monthly' } };

  it('states a plain amount, with no magnitude from the money axis', () => {
    expect(chartCard(threshold, threshold.data[0], { currency: 'EUR', magnitude: 1_000_000_000 }).reading?.value).toBe('2300 евро');
  });

  it('follows the currency', () => {
    expect(chartCard(threshold, threshold.data[0], { currency: 'BGN', magnitude: 1_000_000 }).reading?.value).toContain('4498,41');
  });

  it('is drawn on the monthly axis', () => {
    expect(buildLineSeries(threshold).yAxisIndex).toBe(MONTHLY_AXIS);
  });
});

describe('attachChartExtras', () => {
  const line = { value: -3, color: 'red', width: 2 };

  it('gives a series the lines listed under its id, and no other', () => {
    const [listed, other] = attachChartExtras([series('a', 'percent'), series('b', 'percent')], [{ chartId: 'a', horizontalLines: [line] }]);

    expect(listed.horizontalLines).toEqual([line]);
    expect(other.horizontalLines).toBeUndefined();
  });

  it('points only at series that exist', () => {
    const ids = charts.map((chart) => chart.id);

    expect(extras.map((entry) => entry.chartId).filter((id) => !ids.includes(id))).toEqual([]);
  });
});

describe('a horizontal line', () => {
  const line = { value: -3, color: 'red', width: 2 };

  it('sits on the series, so the legend switches it too', () => {
    const { markLine } = buildLineSeries({ ...series('a', 'percent'), horizontalLines: [line] }) as any;

    expect(markLine.data).toEqual([{ yAxis: -3, lineStyle: { color: 'red', width: 2, type: 'solid' } }]);
  });

  it('follows the money view on a money series', () => {
    const { markLine } = buildLineSeries({ ...series('a', 'BGN'), horizontalLines: [{ ...line, value: 1_955_830_000 }] }) as any;

    expect(markLine.data[0].yAxis).toBeCloseTo(1);
  });

  it('takes its dash and its always-visible label from the config', () => {
    const { markLine } = buildLineSeries({ ...series('a', 'percent'), horizontalLines: [{ ...line, type: 'dotted', label: 'Праг' }] }) as any;
    const [{ lineStyle, label }] = markLine.data;

    expect(lineStyle.type).toBe('dotted');
    expect(label).toMatchObject({ show: true, formatter: 'Праг' });
  });

  it('shows its value in a tooltip of its own', () => {
    const { markLine } = buildLineSeries({ ...series('a', 'percent'), horizontalLines: [{ ...line, value: 0 }, line] }) as any;
    const html = markLine.tooltip.formatter({ dataIndex: 1 });

    expect(markLine.silent).toBe(false);
    expect(html).toContain('-3');
    expect(html).toContain('%');
    expect(html).toContain('Име a');
  });

  it('leaves a series without any unmarked', () => {
    expect(buildLineSeries(series('a', 'percent'))).not.toHaveProperty('markLine');
  });
});

describe('chartCard', () => {
  /* `main.ts` sets the locale for the app; a spec does not run it. */
  beforeAll(() => moment.locale('bg'));
  afterAll(() => moment.locale('en'));

  const source = { name: { en: 'Debt', bg: 'Дълг' }, dataset_id: 'GOV_10DD_EDPT1', url: ['https://ec.europa.eu/eurostat/a', 'https://ec.europa.eu/eurostat/b'] };

  describe('of a point that names its own source', () => {
    const budget = (charts as unknown as ChartSeries[]).find(({ id }) => id === 'mvr-budget-eur')!;
    const year = (date: string) => budget.data.find((point) => point.date === date)!;

    it('states where in the law the figure stands, in place of the series source', () => {
      const [cited, ...rest] = chartCard(budget, year('2014-12-31')).sources!;

      expect(rest).toEqual([]);
      expect(cited.name).toBe('Закон за държавния бюджет на Република България за 2014 г.');
      expect(cited.media).toBe('Държавен вестник');
      expect(cited.date).toBe('2013-12-20');
      expect(cited.quote).toBe('II. РАЗХОДИ: 999 556,0 хил. лв. [чл. 12, ал. 1; ДВ, бр. 109 от 20.12.2013 г., стр. 19]');
    });

    it('links the act first and opens the ministry PDF on the page', () => {
      const [cited] = chartCard(budget, year('2014-12-31')).sources!;

      expect(cited.link).toEqual([
        'https://dv.parliament.bg/DVWeb/showMaterialDV.jsp?idMat=81175',
        'https://dv.parliament.bg/DVWeb/fileUploadShowing.jsp?&idFileAtt=142327&allowCache=true&openDirectly=false',
        'https://www.minfin.bg/upload/13667/ZAKON_za_dyrjavniq_budjet_na_Republika_Bylgariq_za_2014.pdf#page=12',
      ]);
    });

    it('skips a gazette link the year does not have', () => {
      const [early] = chartCard(budget, year('2002-12-31')).sources!;
      const [late] = chartCard(budget, year('2026-12-31')).sources!;

      expect(early.link?.[0]).toContain('fileUploadShowing');
      expect(late.link?.[0]).toContain('showMaterialDV');
      expect(late.link?.join()).not.toContain('fileUploadShowing');
    });

    it('lists the annex that repeats the total, with its own reference and page', () => {
      const [, annex] = chartCard(budget, year('2008-12-31')).sources!;

      expect(annex.quote).toContain('[Приложение № 2 към чл. 6, ал. 3; ДВ, бр. 113 от 28.12.2007 г., стр. 54]');
      expect(annex.link?.at(-1)).toContain('#page=27');
    });

    it('never strays from the amount the law prints, whatever the series', () => {
      const lawSeries = (charts as unknown as ChartSeries[]).filter(({ data }) => data.some((point) => point.sources));

      expect(lawSeries).toHaveLength(17);
      const inUnits: Readonly<Record<string, number>> = { 'лв.': 1 / 1.95583, 'хил. лв.': 1_000 / 1.95583, 'млн. лв.': 1_000_000 / 1.95583, евро: 1, 'хил. евро': 1_000 };
      for (const { id, data } of lawSeries) {
        for (const { date, value, sources } of data) {
          const [{ amount, amountUnit }] = sources!;
          expect(Math.abs(value - amount * inUnits[amountUnit]), `${id} ${date}`).toBeLessThan(0.01);
        }
      }
    });

    it('cites a decree’s sole article as printed, „Член единствен“', () => {
      const wage = (charts as unknown as ChartSeries[]).find(({ id }) => id === 'minimum-wage-eur')!;
      const [decree] = chartCard(wage, wage.data.find(({ date }) => date === '2027-01-01')!).sources!;
      const [numbered] = chartCard(wage, wage.data.find(({ date }) => date === '2000-02-01')!).sources!;

      expect(decree.quote).toContain('[чл. единствен, ал. 1; ДВ, бр. 100 от 3.11.2026 г., актът започва на стр. 21]');
      expect(numbered.quote).toContain('[чл. 1, ал. 1;');
    });

    it('takes the exact 2002 judiciary figure, not the rounded table', () => {
      const judiciary = (charts as unknown as ChartSeries[]).find(({ id }) => id === 'judiciary-budget-eur')!;
      const [exact, rounded] = judiciary.data.find(({ date }) => date === '2002-12-31')!.sources!;

      expect(exact.amount).toBe(121873.7);
      expect([rounded.amount, rounded.amountUnit]).toEqual([121.9, 'млн. лв.']);
    });

    describe('where the law uses points, not paragraphs', () => {
      const threshold = (charts as unknown as ChartSeries[]).find(({ id }) => id === 'max-insurance-income-eur')!;
      const on = (date: string) => threshold.data.find((point) => point.date === date)!;

      it('names the point and letter, and prints a plain amount as the law does', () => {
        const [cited] = chartCard(threshold, on('2022-04-01')).sources!;

        expect(cited.quote).toBe('максимален месечен размер на осигурителния доход: 3400 лв. [чл. 9, т. 2, б. „г“; ДВ, бр. 18 от 4.03.2022 г., стр. 12]');
      });

      it('keeps the cents of a converted amount', () => {
        expect(chartCard(threshold, on('2026-01-01')).sources![0].quote).toContain(': 2111,64 евро [');
      });

      it('says where the act starts when no copy of the issue shows the page', () => {
        expect(chartCard(threshold, on('2024-01-01')).sources![0].quote).toContain('актът започва на стр. 79]');
      });

      it('marks an amount no law prints', () => {
        const point = on('2000-01-01') as ChartPoint & { note?: string };

        expect(point.note).toContain('Сумата не е записана в закон');
        expect(point.sources![0].article).toBe(9);
      });
    });

    it('keeps the series source when no point is picked', () => {
      expect(chartCard(budget).sources).toEqual(budget.sources?.map(({ name, url }) => ({ name: name.bg, link: url })));
    });

    it('keeps the series source for a point without its own', () => {
      const chart = { ...series('a', 'percent'), sources: [source] };

      expect(chartCard(chart, chart.data[0]).sources).toEqual([{ name: 'Дълг', link: source.url }]);
    });
  });

  it('carries the name and the sources in Bulgarian, with every link', () => {
    expect(chartCard({ ...series('a', 'percent'), sources: [source] })).toEqual({
      id: 'a',
      group: '',
      name: 'Име a',
      metric: 'a',
      sources: [{ name: 'Дълг', link: source.url }],
    });
  });

  it('points a series in either unit at one description', () => {
    expect(chartCard(series('government-debt-eur', 'EUR')).metric).toBe('government-debt');
    expect(chartCard(series('government-debt-percent', 'percent')).metric).toBe('government-debt');
  });

  it('keeps the whole id of a series with no unit in its name', () => {
    expect(chartCard(series('gini-coefficient', 'coefficient')).metric).toBe('gini-coefficient');
  });

  it('leaves the dates out, so the card prints no span', () => {
    expect(chartCard(series('a', 'percent'))).not.toHaveProperty('from');
    expect(chartCard(series('a', 'percent'))).not.toHaveProperty('to');
  });

  it('leaves the reading out when the click found no point', () => {
    expect(chartCard(series('a', 'percent'))).not.toHaveProperty('reading');
    expect(chartCard(series('a', 'percent')).id).toBe('a');
  });

  it('states the picked point by date, and keeps points of one series apart', () => {
    const chart = series('a', 'percent', 22.5);
    const card = chartCard(chart, chart.data[0]);

    expect(card.id).toBe('a|2023-12-31');
    expect(card.reading?.label).toBe('към 31 декември 2023 г.');
    expect(card.reading?.value).toBe('22,5%');
  });

  describe('in an annual series', () => {
    const annual: ChartSeries = { ...series('a', 'EUR', 7_147_500_000), dataset: { selection: { freq: { code: 'A' } } } };

    it('labels a year-end reading by its year, and keeps the date as a note', () => {
      expect(chartCard(annual, { date: '2013-12-31', value: 7_147_500_000 }).reading).toEqual({
        label: 'за 2013 г. —',
        value: '7,15 млрд. евро',
        note: '31 декември 2013 г.',
      });
    });

    it('keeps the date on a later reading that does not close a year', () => {
      expect(chartCard(annual, { date: '2026-06-30', value: 1_000_000_000 }).reading?.label).toBe('към 30 юни 2026 г.');
      expect(chartCard(annual, { date: '2026-06-30', value: 1_000_000_000 }).reading).not.toHaveProperty('note');
    });
  });

  it('dates every reading of a monthly series, December too', () => {
    const monthly: ChartSeries = { ...series('a', 'percent', 2), dataset: { selection: { freq: { code: 'M' } } } };
    expect(chartCard(monthly, monthly.data[0]).reading).toEqual({ label: 'към 31 декември 2023 г.', value: '2%' });
  });

  it('reads the frequency the published series state', () => {
    const published = charts as unknown as ChartSeries[];
    const debt = published.find(({ id }) => id === 'government-debt-eur') as ChartSeries;
    const inflation = published.find(({ id }) => id === 'inflation-annual-rate') as ChartSeries;
    const at = (chart: ChartSeries, date: string) => chart.data.find((point) => point.date === date) as ChartPoint;

    expect(chartCard(debt, at(debt, '2013-12-31')).reading?.label).toBe('за 2013 г. —');
    expect(chartCard(debt, at(debt, '2026-06-30')).reading?.label).toBe('към 30 юни 2026 г.');
    expect(chartCard(inflation, at(inflation, '2013-12-31')).reading?.label).toBe('към 31 декември 2013 г.');
  });

  it('prints the reading in the units the reader has chosen', () => {
    const chart = series('a', 'EUR', 1_000_000_000);

    expect(chartCard(chart, chart.data[0], { currency: 'EUR', magnitude: 1_000_000_000 }).reading?.value).toMatch(/^1 млрд/);
    expect(chartCard(chart, chart.data[0], { currency: 'BGN', magnitude: 1_000_000 }).reading?.value).toMatch(/^1\s?955,83 млн/);
  });

  it('adds no unit to a coefficient, whose axis names it', () => {
    const chart = series('a', 'coefficient', 37.7);
    expect(chartCard(chart, chart.data[0]).reading?.value).toBe('37,7');
  });

  it('finds at least one linked source for every published series', () => {
    for (const chart of charts as unknown as ChartSeries[]) {
      const { sources } = chartCard(chart);
      expect(sources?.length, chart.id).toBeGreaterThan(0);
      expect(sources?.every(({ name, link }) => name && link?.length), chart.id).toBe(true);
    }
  });
});

describe('nearestPoint', () => {
  const points = [
    { date: '2020-12-31', value: 1 },
    { date: '2021-12-31', value: 2 },
    { date: '2022-12-31', value: 3 },
  ];

  it('picks the point closest to the click, on either side of it', () => {
    expect(nearestPoint(points, +new Date('2021-03-01'))?.value).toBe(1);
    expect(nearestPoint(points, +new Date('2021-11-01'))?.value).toBe(2);
  });

  it('keeps to the ends past either end of the series', () => {
    expect(nearestPoint(points, +new Date('1990-01-01'))?.value).toBe(1);
    expect(nearestPoint(points, +new Date('2040-01-01'))?.value).toBe(3);
  });

  it('finds nothing in an empty series', () => {
    expect(nearestPoint([], 0)).toBeNull();
  });
});

describe('the point mark', () => {
  const chart = series('a', 'EUR', 1_000_000_000);

  it('sits on the point in the units the line is drawn in, by the same date', () => {
    const { data } = pointMark(chart, chart.data[0], { currency: 'EUR', magnitude: 1_000_000 }, '#123456');
    expect(data).toEqual([{ coord: ['2023-12-31', 1_000] }]);
  });

  it('lets a click through to the point beneath', () => {
    expect(pointMark(chart, chart.data[0], { currency: 'EUR', magnitude: 1_000_000 }, '#123456').silent).toBe(true);
  });

  it('is built into the series of the picked point, and no other', () => {
    expect(buildLineSeries(chart, undefined, false, '#123456', chart.data[0])).toHaveProperty('markPoint');
    expect(buildLineSeries(chart)).not.toHaveProperty('markPoint');
  });
});

describe('buildLineSeries', () => {
  it('reports a click on the line, not only on its points', () => {
    expect(buildLineSeries(series('a', 'percent')).triggerEvent).toBe('line');
  });

  it('draws on the second grid, by unit', () => {
    expect(buildLineSeries(series('a', 'percent'))).toMatchObject({ xAxisIndex: 1, yAxisIndex: PERCENT_AXIS });
    expect(buildLineSeries(series('b', 'EUR'))).toMatchObject({ xAxisIndex: 1, yAxisIndex: MONEY_AXIS });
    expect(buildLineSeries(series('c', 'coefficient'))).toMatchObject({ xAxisIndex: 1, yAxisIndex: COEFFICIENT_AXIS });
    expect(buildLineSeries({ ...series('d', 'percent'), meta: { axis: 'inflation' } })).toMatchObject({ xAxisIndex: 1, yAxisIndex: INFLATION_AXIS });
  });

  it('shows a coefficient as published, with no money view and no percent sign', () => {
    const line = buildLineSeries(series('a', 'coefficient', 37.7), { currency: 'BGN', magnitude: 1_000 }) as any;
    const html = line.tooltip.formatter({ data: line.data[0], marker: '' });

    expect(line.data[0].value[1]).toBe(37.7);
    expect(html).toContain('37,7</div>');
    expect(html).not.toContain('37,7%');
  });

  it('brings leva and euro to one denomination, in billions', () => {
    const [lev] = buildLineSeries(series('a', 'BGN', 1_955_830_000)).data;
    const [eur] = buildLineSeries(series('b', 'EUR', 1_000_000_000)).data;

    expect(lev.value[1]).toBeCloseTo(1);
    expect(lev.content.change).toBeCloseTo(0.5);
    expect(eur.value[1]).toBe(1);
  });

  it('leaves a percentage alone', () => {
    expect(buildLineSeries(series('a', 'percent', -2.9)).data[0].value[1]).toBe(-2.9);
  });

  describe('the point tooltip', () => {
    beforeAll(() => moment.locale('bg'));
    afterAll(() => moment.locale('en'));

    const tooltip = (chart: ChartSeries) => {
      const line = buildLineSeries(chart) as any;
      return line.tooltip.formatter({ data: line.data[0], marker: '' }) as string;
    };

    it('marks a rise as up, with the arrow, the signed amount and the percent', () => {
      const html = tooltip(series('a', 'EUR', 2_000_000_000));

      expect(html).toContain('data-change="up"');
      expect(html).toContain('▲');
      expect(html).toContain('+1 млрд. евро');
      expect(html).toContain('+10%');
    });

    it('marks a fall as down', () => {
      const chart = series('a', 'EUR', 2_000_000_000);
      const html = tooltip({ ...chart, data: [{ ...chart.data[0], change: -500_000_000, change_percent: -20 }] });

      expect(html).toContain('data-change="down"');
      expect(html).toContain('▼');
      expect(html).toContain('−0,5 млрд. евро');
      expect(html).toContain('−20%');
    });

    it('shows no change on a first point', () => {
      const chart = series('a', 'EUR');
      const html = tooltip({ ...chart, data: [{ date: '2023-12-31', value: 1 }] });

      expect(html).not.toContain('data-change');
      expect(html).not.toContain('▲');
    });

    it('gives a percentage change in points, apart from the relative percent', () => {
      const html = tooltip(series('a', 'percent', -4));

      expect(html).toContain('−2 пр.п.');
      expect(html).toContain('+10%');
    });

    it('dates the point briefly', () => {
      expect(tooltip(series('a', 'EUR'))).toContain('31 дек 2023');
    });
  });
});

describe('the number labels', () => {
  afterEach(() => localStorage.clear());

  it('stay off unless asked for, but show on the hovered point', () => {
    const line = buildLineSeries(series('a', 'percent'));

    expect(line.label.show).toBe(false);
    expect(line.emphasis.label.show).toBe(true);
  });

  it('grow the hovered point to more than twice its size', () => {
    expect(buildLineSeries(series('a', 'percent')).emphasis.scale).toBeGreaterThanOrEqual(2);
  });

  it('show when asked for, to one decimal of what the line plots', () => {
    const line = buildLineSeries(series('a', 'EUR', 1_234_500_000), undefined, true);

    expect(line.label.show).toBe(true);
    expect(line.label.formatter({ data: line.data[0] })).toBe('1,2');
  });

  it('print no sign on a value that rounds to zero', () => {
    const line = buildLineSeries(series('a', 'percent', -0.04), undefined, true);

    expect(line.label.formatter({ data: line.data[0] })).toBe('0');
  });

  it('drop what would collide', () => {
    expect(buildLineSeries(series('a', 'percent')).labelLayout.hideOverlap).toBe(true);
  });

  it('reach the series through the option', () => {
    const row: GanttGroup = { name: 'Ред', items: [{ name: 'а', value: ['2000-01-01', '2001-01-01'] }] };
    const option = buildTimelineOption([row], [row], [series('a', 'percent')], [], { labels: true });

    expect((option.series[2] as any).label.show).toBe(true);
  });

  it('come back as they were left', () => {
    expect(readStoredLabels()).toBe(false);
    storeLabels(true);
    expect(readStoredLabels()).toBe(true);
  });
});

describe('buildLegend', () => {
  const charts = [series('government-deficit-and-surplus-bgn', 'BGN'), series('gdp-bgn', 'BGN')];

  it('opens with its series on', () => {
    expect(buildLegend(charts, undefined).selected).toEqual({ 'government-deficit-and-surplus-bgn': true, 'gdp-bgn': true });
  });

  it('keeps what the reader chose', () => {
    expect(buildLegend(charts, { 'gdp-bgn': true }).selected).toEqual({ 'gdp-bgn': true });
  });

  it('is never drawn: the HTML legend stands in for it', () => {
    expect(buildLegend(charts, undefined).show).toBe(false);
  });
});

describe('a switch on the legend', () => {
  const charts = [series('a', 'BGN'), series('b', 'BGN'), series('c', 'percent')];

  it('turns a series that is on off, and leaves the rest as they were', () => {
    expect(toggledLegend({ b: false }, 'a')).toEqual({ a: false, b: false });
  });

  it('turns a series that is off back on', () => {
    expect(toggledLegend({ a: false, b: false }, 'a')).toEqual({ a: true, b: false });
  });

  it('turns every series on or off at once', () => {
    expect(legendForAll(charts, true)).toEqual({ a: true, b: true, c: true });
    expect(legendForAll(charts, false)).toEqual({ a: false, b: false, c: false });
  });

  it('switches only the series it is given and leaves the rest as they were', () => {
    const selection = { a: false, b: true, c: false };
    expect(legendWith(selection, [series('a', 'percent')], true)).toEqual({ a: true, b: true, c: false });
    expect(legendWith(selection, [series('b', 'percent')], false)).toEqual({ a: false, b: false, c: false });
  });
});

describe('the legend the chart draws', () => {
  const all = [series('a', 'percent'), series('b', 'percent'), series('c', 'percent')];
  const selection = { a: true, c: false };

  it('is the reader\'s own with nothing picked in the search, naming every series', () => {
    expect(drawnLegend(selection, all, new Set())).toEqual({ a: true, b: true, c: false });
  });

  it('draws the series the search leaves out off', () => {
    expect(drawnLegend(selection, all, new Set(['a']))).toEqual({ a: true, b: false, c: false });
  });

  it('leaves a picked series as the reader switched it', () => {
    expect(drawnLegend(selection, all, new Set(['c']))).toEqual({ a: false, b: false, c: false });
  });

  it('keeps the reader\'s switches apart', () => {
    drawnLegend(selection, all, new Set(['a']));
    expect(selection).toEqual({ a: true, c: false });
  });
});

describe('the two grids', () => {
  const row: GanttGroup = { name: 'Ред', items: [{ name: 'а', value: ['2000-01-01', '2001-01-01'] }] };
  const option = buildTimelineOption([row], [row], [series('a', 'percent')]);

  it('share one zoom and one time span', () => {
    expect(option.dataZoom[0].xAxisIndex).toEqual([0, 1]);
    expect(option.xAxis[0].min).toBe(option.xAxis[1].min);
    expect(option.xAxis[0].max).toBe(option.xAxis[1].max);
  });

  it('keep the points outside the view, for a line to run in from them', () => {
    expect(option.dataZoom[0].filterMode).toBe('none');
  });

  it('let the pointer run free: snapping near a point is the component\'s, by pixel', () => {
    expect(option.xAxis[0].axisPointer.snap).toBe(false);
    expect(option.xAxis[1].axisPointer.snap).toBe(false);
  });

  it('draw the pointer under the lines', () => {
    const lineZ = 2; // ECharts' default for a line series
    expect((option.xAxis[1].axisPointer as { z?: number }).z).toBeLessThan(lineZ);
  });

  it('keep their bars and their lines lined up', () => {
    expect(option.grid[0].left).toBe(option.grid[1].left);
    expect(option.grid[0].right).toBe(option.grid[1].right);
  });

  it('stand every value axis on the left, so switching one on keeps both edges', () => {
    const charts = [series('a', 'percent'), series('g', 'coefficient')];
    const option = (legend: Record<string, boolean>) => buildTimelineOption([row], [row], charts, [], { legend });
    const on = option({ a: true, g: true });
    const off = option({ a: true, g: false });

    expect((on.yAxis.slice(1) as any[]).map(({ position }) => position)).toEqual(['left', 'left', 'left', 'left', 'left']);
    expect([on.grid[0].left, on.grid[0].right]).toEqual([off.grid[0].left, off.grid[0].right]);
    expect((on.yAxis[3] as any).offset).toBeGreaterThan(0);
  });

  it('show the percent axis only with a percentage to plot', () => {
    const [, percent, money] = buildTimelineOption([row], [row], [series('a', 'BGN')]).yAxis as any[];

    expect(percent.show).toBe(false);
    expect(money).toMatchObject({ offset: 0, show: true, splitLine: { show: true } });
    expect((option.yAxis[1] as any).show).toBe(true);
    expect(option.yAxis[2]).toMatchObject({ splitLine: { show: false } });
  });

  it('never step past a year, so that each keeps its gridline', () => {
    const year = 365 * 24 * 60 * 60 * 1000;
    const steps = (option.xAxis as any[]).map(({ maxInterval }) => maxInterval / year);

    expect(steps).toEqual([1.25, 1.25]);
  });

  it('put a today line on each', () => {
    const indices = option.series.filter((entry: any) => entry.markLine).map((entry: any) => entry.xAxisIndex);

    expect(indices).toEqual([0, 1]);
  });

  it('shorten the row names on a narrow chart, and keep the full name as the category', () => {
    const named = (name: string): GanttGroup => ({ name, items: row.items });
    const groups = [named('Председател на комисия по бюджет и финанси'), named('Вицепрезидент')];
    const yAxis = (narrow: boolean) => (buildTimelineOption(groups, groups, [], [], { narrow }).yAxis as any[])[0];
    const printed = (narrow: boolean) => yAxis(narrow).data.map((name: string) => yAxis(narrow).axisLabel.formatter(name));

    expect(printed(true)).toEqual(['Бюджетна комисия', 'Вицепрезидент']);
    expect(printed(false)).toEqual(['Председател на комисия по бюджет и финанси', 'Вицепрезидент']);
    expect(yAxis(true).data).toEqual(yAxis(false).data);
    expect(yAxis(true).axisLabel.formatter('\0Вицепрезидент')).toBe('');
  });

  it('keep each line its colour whatever events there are', () => {
    const band = (id: string) => ({ id, meta: { style: { itemStyle: { color: 'grey' } } }, items: [{ name: id, value: ['2020-01-01', null] as [string, null] }] });
    const colors = (count: number) => {
      const events = Array.from({ length: count }, (_, index) => band(`event-${index}`));
      const { series: entries } = buildTimelineOption([row], [row], [series('a', 'EUR'), series('b', 'percent')], events);
      return (entries as any[]).filter(({ name }) => name === 'a' || name === 'b').map(({ lineStyle }) => lineStyle.color);
    };

    expect(colors(3)).toEqual(colors(0));
    expect(new Set(colors(0)).size).toBe(2);
  });
});

describe('plans', () => {
  const actual = series('actual', 'percent');
  const plan: ChartSeries = { ...series('plan', 'percent', 5), meta: { planOf: 'actual' } };

  it('hang on the series they name and leave the list', () => {
    const [only, ...rest] = attachPlans([actual, plan, series('other', 'percent')]);

    expect(only).toMatchObject({ id: 'actual', plan: { id: 'plan' } });
    expect(rest.map(({ id }) => id)).toEqual(['other']);
  });

  it('take the axis and the whole-year drawing of their series, whatever they carry', () => {
    const monthly: ChartSeries = { ...series('monthly', 'EUR'), meta: { axis: 'monthly', wholeYear: true } };
    const own: ChartSeries = { ...series('own', 'EUR'), meta: { planOf: 'monthly', axis: 'inflation', style: { step: 'end' } } };
    const [{ plan: drawn }] = attachPlans([monthly, own]);

    expect(drawn?.meta).toEqual({ planOf: 'monthly', axis: 'monthly', wholeYear: true, style: { step: 'end' } });
    expect(attachPlans([actual, { ...plan, meta: { planOf: 'actual', wholeYear: true } }])[0].plan?.meta).toEqual({ planOf: 'actual' });
  });

  it('stay series of their own when what they name is missing', () => {
    expect(attachPlans([plan]).map(({ id }) => id)).toEqual(['plan']);
  });

  it('go by their series name, which the legend switches, and keep their own id', () => {
    expect(buildLineSeries(plan)).toMatchObject({ id: 'plan', name: 'actual' });
    expect(buildLineSeries(actual)).toMatchObject({ id: 'actual', name: 'actual' });
  });

  it('are found by their line id when clicked', () => {
    const charts = attachPlans([actual, plan]);

    expect(chartOfLine(charts, 'actual', 'plan')).toBe(charts[0].plan);
    expect(chartOfLine(charts, 'actual', 'actual')?.id).toBe('actual');
    expect(chartOfLine(charts, 'missing', 'missing')).toBeUndefined();
  });

  it('take their series colour', () => {
    const charts = attachPlans([series('first', 'percent'), actual, plan]);

    expect(chartColor(charts, charts[1].plan!)).toBe(LINE_COLORS[1]);
  });

  it('are drawn after their series, in its colour', () => {
    const row: GanttGroup = { name: 'Ред', items: [{ name: 'а', value: ['2000-01-01', '2001-01-01'] }] };
    const option = buildTimelineOption([row], [row], attachPlans([actual, plan])) as any;
    const drawn = option.series.filter((entry: any) => entry.name === 'actual');

    expect(drawn.map((entry: any) => entry.id)).toEqual(['actual', 'plan']);
    expect(drawn[1].lineStyle.color).toBe(drawn[0].lineStyle.color);
  });
});
