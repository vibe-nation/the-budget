import { describe, expect, it } from 'vitest';

import { timeWindow, valueAxisPatches, valueAxisRanges } from './timeline-value-axes';
import { DEFAULT_MONEY } from './timeline-money';
import { ChartPoint, ChartSeries } from './timeline.model';

const points = (...values: number[]): ChartPoint[] => values.map((value, index) => ({ date: `20${10 + index}-12-31`, value }));
const series = (id: string, unit: ChartSeries['unit'], values: ChartPoint[], lines?: ChartSeries['horizontalLines']): ChartSeries => ({
  id,
  name: id,
  unit,
  data: values,
  horizontalLines: lines,
});

const allYears = { from: Date.UTC(2000, 0, 1), to: Date.UTC(2030, 0, 1) };
const billions = (...values: number[]) => values.map((value) => value * 1_000_000_000);
const zeroShare = ({ min, max }: { min: number; max: number }) => -min / (max - min);

describe('valueAxisRanges', () => {
  describe('with a line held across each year', () => {
    const held = (...values: number[]): ChartSeries => ({ ...series('held', 'percent', points(...values)), meta: { wholeYear: true } });
    /* 2011 closes the second point, so a view ending midway stands on it without reaching it. */
    const upToMid2011 = { from: Date.UTC(2010, 0, 1), to: Date.UTC(2011, 6, 1) };

    it('counts the level at the edge of the view, which is the next point, not a slope towards it', () => {
      expect(valueAxisRanges([held(1, 100)], DEFAULT_MONEY, undefined, upToMid2011).percent?.max).toBe(100);
    });

    it('counts the slope at the edge of the view once the reader draws it as a plain line', () => {
      const max = valueAxisRanges([held(1, 100)], DEFAULT_MONEY, undefined, upToMid2011, 'line').percent?.max ?? 0;

      expect(max).toBeGreaterThanOrEqual(50);
      expect(max).toBeLessThan(100);
    });

    it('counts the first year, where the line stands before its first point', () => {
      const inFirstYear = { from: Date.UTC(2010, 1, 1), to: Date.UTC(2010, 5, 1) };

      expect(valueAxisRanges([held(50, 100)], DEFAULT_MONEY, undefined, inFirstYear).percent?.max).toBe(50);
    });

    it('counts nothing before the first year, where no line is drawn', () => {
      const earlier = { from: Date.UTC(2000, 0, 1), to: Date.UTC(2005, 0, 1) };

      expect(valueAxisRanges([held(50, 100)], DEFAULT_MONEY, undefined, earlier).percent?.max).toBe(0);
    });
  });

  it('puts zero at one height on both axes when their data disagrees', () => {
    const { percent, money } = valueAxisRanges(
      [series('deficit', 'percent', points(-5.5, 3.5)), series('debt', 'EUR', points(...billions(0.5, 38)))],
      DEFAULT_MONEY,
      undefined,
      allYears
    );

    expect(percent).toEqual({ min: -6, max: 8, interval: 2 });
    expect(money).toEqual({ min: -30, max: 40, interval: 10 });
    expect(zeroShare(percent!)).toBeCloseTo(zeroShare(money!));
  });

  it('gives both axes the same number of ticks', () => {
    const { percent, money } = valueAxisRanges(
      [series('a', 'percent', points(-3.1, 71)), series('b', 'EUR', points(...billions(-7, 12)))],
      DEFAULT_MONEY,
      undefined,
      allYears
    );
    const ticks = (range: typeof percent) => (range!.max - range!.min) / range!.interval;

    expect(ticks(percent)).toBeCloseTo(ticks(money));
  });

  it('leaves out a series the legend has off', () => {
    const charts = [series('small', 'percent', points(1)), series('big', 'percent', points(90))];

    expect(valueAxisRanges(charts, DEFAULT_MONEY, { big: false }, allYears).percent?.max).toBe(1);
  });

  it('marks an axis with nothing on as absent', () => {
    expect(valueAxisRanges([series('a', 'percent', points(1))], DEFAULT_MONEY, { a: false }, allYears)).toEqual({
      percent: null,
      money: null,
      coefficient: null,
      inflation: null,
      monthly: null,
    });
  });

  it('ranges a coefficient on its own axis, with zero level with the others', () => {
    const { percent, money, coefficient } = valueAxisRanges(
      [
        series('deficit', 'percent', points(-5.5, 3.5)),
        series('debt', 'EUR', points(...billions(0.5, 38))),
        series('gini', 'coefficient', points(31.2, 40.8)),
      ],
      DEFAULT_MONEY,
      undefined,
      allYears
    );

    expect(coefficient).toEqual({ min: -30, max: 50, interval: 10 });
    expect(zeroShare(coefficient!)).toBeCloseTo(zeroShare(percent!));
    expect(zeroShare(coefficient!)).toBeCloseTo(zeroShare(money!));
  });

  it('keeps a series with an axis of its own off the shared percent axis', () => {
    const inflation = { ...series('inflation', 'percent', points(547.6, 6)), meta: { axis: 'inflation' as const } };
    const { percent, inflation: own } = valueAxisRanges([series('debt', 'percent', points(30)), inflation], DEFAULT_MONEY, undefined, allYears);

    expect(percent?.max).toBeLessThan(100);
    expect(own?.max).toBeGreaterThanOrEqual(547.6);
    expect(zeroShare(own!)).toBeCloseTo(zeroShare(percent!));
  });

  it('keeps a coefficient out of the money axis', () => {
    expect(valueAxisRanges([series('gini', 'coefficient', points(37.7))], DEFAULT_MONEY, undefined, allYears).money).toBeNull();
  });

  it('reads only the years in view', () => {
    const charts = [series('a', 'percent', points(90, 1, 2))];
    const window = { from: Date.UTC(2012, 0, 1), to: Date.UTC(2013, 0, 1) };

    expect(valueAxisRanges(charts, DEFAULT_MONEY, undefined, window).percent?.max).toBe(2);
  });

  it('makes room for a line running in from a point left of the view', () => {
    const charts = [series('a', 'percent', [{ date: '2010-01-01', value: 90 }, { date: '2020-01-01', value: 10 }, { date: '2021-01-01', value: 10 }])];
    const window = { from: +new Date('2015-01-01'), to: +new Date('2021-01-01') };

    expect(valueAxisRanges(charts, DEFAULT_MONEY, undefined, window).percent?.max).toBeGreaterThanOrEqual(50);
  });

  it('makes room for a line running out to a point right of the view', () => {
    const charts = [series('a', 'percent', [{ date: '2010-01-01', value: 10 }, { date: '2011-01-01', value: 10 }, { date: '2021-01-01', value: 90 }])];
    const window = { from: +new Date('2010-01-01'), to: +new Date('2016-01-01') };

    expect(valueAxisRanges(charts, DEFAULT_MONEY, undefined, window).percent?.max).toBeGreaterThanOrEqual(50);
  });

  it('adds nothing past the ends of a series', () => {
    const charts = [series('a', 'percent', [{ date: '2010-01-01', value: 90 }])];
    const window = { from: +new Date('2015-01-01'), to: +new Date('2021-01-01') };

    expect(valueAxisRanges(charts, DEFAULT_MONEY, undefined, window).percent?.max).toBe(0);
  });

  it('keeps a horizontal line in view though the data stops short of it', () => {
    const charts = [series('a', 'percent', points(1), [{ value: -3, color: 'red', width: 2 }])];

    expect(valueAxisRanges(charts, DEFAULT_MONEY, undefined, allYears).percent?.min).toBeLessThanOrEqual(-3);
  });

  it('follows the money view', () => {
    const charts = [series('a', 'EUR', points(...billions(30)))];

    expect(valueAxisRanges(charts, { ...DEFAULT_MONEY, magnitude: 1_000_000 }, undefined, allYears).money?.max).toBe(30_000);
  });

  it('prints whole steps without rounding noise', () => {
    expect(valueAxisRanges([series('a', 'percent', points(-0.25, 0.28))], DEFAULT_MONEY, undefined, allYears).percent).toEqual({
      min: -0.4,
      max: 0.4,
      interval: 0.2,
    });
  });

  it('copes with a flat series at zero', () => {
    expect(valueAxisRanges([series('a', 'percent', points(0))], DEFAULT_MONEY, undefined, allYears).percent).toEqual({ min: 0, max: 0, interval: 1 });
  });
});

describe('timeWindow', () => {
  const axis = { min: 1000, max: 2000 };

  it('turns the zoom shares into times', () => {
    expect(timeWindow({ start: 50, end: 100 }, axis)).toEqual({ from: 1500, to: 2000 });
  });

  it('is the opening view before any zoom', () => {
    expect(timeWindow(undefined, axis)).toEqual({ from: Date.UTC(1989, 0, 1), to: 2000 });
  });
});

describe('a monthly amount', () => {
  const threshold: ChartSeries = { ...series('threshold', 'EUR', points(1000, 2300)), meta: { axis: 'monthly' } };

  it('keeps its own axis in whole euro, whatever magnitude the money axis shows', () => {
    const { money, monthly } = valueAxisRanges([threshold, series('debt', 'EUR', points(...billions(1, 38)))], DEFAULT_MONEY, undefined, allYears);

    expect(monthly?.max).toBeGreaterThanOrEqual(2300);
    expect(monthly?.max).toBeLessThan(10_000);
    expect(money?.max).toBeLessThan(100);
  });

  it('follows the currency', () => {
    const { monthly } = valueAxisRanges([threshold], { ...DEFAULT_MONEY, currency: 'BGN' }, undefined, allYears);

    expect(monthly?.max).toBeGreaterThanOrEqual(4498);
  });

  it('keeps zero level with the other axes', () => {
    const { percent, monthly } = valueAxisRanges([threshold, series('deficit', 'percent', points(-5.5, 3.5))], DEFAULT_MONEY, undefined, allYears);

    expect(zeroShare(monthly!)).toBeCloseTo(zeroShare(percent!));
  });

  it('stands out from whichever axes before it are on, and carries the gridlines alone', () => {
    const range = { min: 0, max: 10, interval: 2 };

    expect(valueAxisPatches({ percent: null, money: null, coefficient: range, inflation: range, monthly: range }).monthly.offset).toBe(88);
    expect(valueAxisPatches({ percent: null, money: null, coefficient: null, inflation: range, monthly: range }).monthly.offset).toBe(44);
    expect(valueAxisPatches({ percent: null, money: null, coefficient: null, inflation: null, monthly: range }).monthly).toMatchObject({ offset: 0, show: true, splitLine: { show: true } });
    expect(valueAxisPatches({ percent: range, money: null, coefficient: null, inflation: null, monthly: range }).monthly.splitLine.show).toBe(false);
  });

  it('lifts a name a line only where it would run into the one beside it', () => {
    const range = { min: 0, max: 10, interval: 2 };
    /* Axes 50 px apart: two 70 px names collide, a 10 px one clears either. */
    const layout = {
      widths: { percent: 50, money: 50, coefficient: 50, inflation: 50, monthly: 50 },
      names: { percent: 10, money: 70, coefficient: 70, inflation: 10, monthly: 70 },
    };
    const all = valueAxisPatches({ percent: range, money: range, coefficient: range, inflation: range, monthly: range }, layout);

    expect([all.percent, all.money, all.coefficient, all.inflation, all.monthly].map(({ nameGap }) => nameGap)).toEqual([8, 8, 22, 8, 8]);
    expect(valueAxisPatches({ percent: null, money: range, coefficient: null, inflation: null, monthly: range }, layout).monthly.nameGap).toBe(22);
  });
});

describe('valueAxisPatches', () => {
  const range = { min: -1, max: 1, interval: 1 };

  it('hangs the gridlines on the percent axis while it is on', () => {
    const { percent, money } = valueAxisPatches({ percent: range, money: range, coefficient: null, inflation: null, monthly: null });

    expect(percent.splitLine.show).toBe(true);
    expect(money.splitLine.show).toBe(false);
    expect(money.offset).toBeGreaterThan(0);
  });

  it('hands the gridlines and the place to the money axis when it is off', () => {
    const { percent, money } = valueAxisPatches({ percent: null, money: range, coefficient: null, inflation: null, monthly: null });

    expect(percent.show).toBe(false);
    expect(money).toMatchObject({ show: true, offset: 0, splitLine: { show: true } });
  });

  it('gives the coefficient axis the gridlines only when it stands alone', () => {
    expect(valueAxisPatches({ percent: range, money: null, coefficient: range, inflation: null, monthly: null }).coefficient.splitLine.show).toBe(false);
    expect(valueAxisPatches({ percent: null, money: null, coefficient: range, inflation: null, monthly: null }).coefficient).toMatchObject({
      show: true,
      splitLine: { show: true },
    });
  });

  it('moves the inflation axis to the edge when the coefficient axis is off', () => {
    const beside = valueAxisPatches({ percent: range, money: null, coefficient: range, inflation: range, monthly: null }).inflation;
    const alone = valueAxisPatches({ percent: null, money: null, coefficient: null, inflation: range, monthly: null }).inflation;

    expect(beside).toMatchObject({ show: true, splitLine: { show: false } });
    expect(beside.offset).toBeGreaterThan(0);
    expect(alone).toMatchObject({ show: true, offset: 0, splitLine: { show: true } });
  });
});
