import { afterEach, describe, expect, it } from 'vitest';

import { buildTimelineOption } from './timeline-chart-option';
import { buildLineSeries } from './timeline-lines';
import {
  DEFAULT_MONEY,
  MoneyView,
  convertMoney,
  moneyAxisName,
  moneySuffix,
  readStoredMoney,
  storeMoney,
  widestMoneyLabel,
} from './timeline-money';
import { ChartSeries, GanttGroup } from './timeline.model';

const lev: MoneyView = { currency: 'BGN', magnitude: 1_000_000 };
const series = (unit: ChartSeries['unit'], value: number): ChartSeries => ({
  id: 'a',
  name: 'Серия',
  unit,
  data: [{ date: '2023-12-31', value, change: value / 2 }],
});

describe('convertMoney', () => {
  it('crosses between the currencies at the fixed rate', () => {
    expect(convertMoney(1_955_830_000, 'BGN', DEFAULT_MONEY)).toBeCloseTo(1);
    expect(convertMoney(1_000_000, 'EUR', lev)).toBeCloseTo(1.95583);
  });

  it('leaves an amount in its own currency alone, down to the unit', () => {
    expect(convertMoney(1234.5, 'BGN', { currency: 'BGN', magnitude: 1 })).toBeCloseTo(1234.5);
    expect(convertMoney(1234.5, 'EUR', { currency: 'EUR', magnitude: 1 })).toBe(1234.5);
  });
});

describe('the labels', () => {
  it('name the denomination', () => {
    expect(moneyAxisName(DEFAULT_MONEY)).toBe('млрд. евро');
    expect(moneyAxisName(lev)).toBe('млн. лв.');
    expect(moneySuffix(DEFAULT_MONEY)).toBe(' млрд. евро');
    expect(moneySuffix(lev)).toBe(' млн. лева');
  });

  it('carry no prefix for plain units', () => {
    const units: MoneyView = { currency: 'BGN', magnitude: 1 };

    expect(moneyAxisName(units)).toBe('лв.');
    expect(moneySuffix(units)).toBe(' лева');
  });
});

describe('widestMoneyLabel', () => {
  it('leaves percentages out', () => {
    expect(widestMoneyLabel([series('percent', 80)], DEFAULT_MONEY)).toBe('0');
  });

  it('grows as the unit shrinks', () => {
    const charts = [series('EUR', 90_000_000_000)];

    expect(widestMoneyLabel(charts, { currency: 'EUR', magnitude: 1 }).length).toBeGreaterThan(widestMoneyLabel(charts, DEFAULT_MONEY).length);
  });
});

describe('buildLineSeries', () => {
  it('states value and change in the chosen denomination, leaving percent alone', () => {
    const [point] = buildLineSeries(series('EUR', 2_000_000), lev).data;

    expect(point.value[1]).toBeCloseTo(3.91166);
    expect(point.content.change).toBeCloseTo(1.95583);
    expect(buildLineSeries(series('percent', -2.9), lev).data[0].value[1]).toBe(-2.9);
  });
});

describe('the option', () => {
  const row: GanttGroup = { name: 'Ред', items: [{ name: 'а', value: ['2000-01-01', '2001-01-01'] }] };

  it('carries the denomination to the axis and the series', () => {
    const option = buildTimelineOption([row], [row], [series('EUR', 2_000_000)], [], { money: lev });

    expect((option.yAxis[2] as any).name).toBe('млн. лв.');
    expect((option.series[2] as any).data[0].value[1]).toBeCloseTo(3.91166);
  });

  it('opens on billions of euro', () => {
    expect((buildTimelineOption([row], [row]).yAxis[2] as any).name).toBe('млрд. евро');
  });
});

describe('the stored choice', () => {
  afterEach(() => localStorage.clear());

  it('comes back as it was left', () => {
    storeMoney(lev);

    expect(readStoredMoney()).toEqual(lev);
  });

  it('falls back on the default when absent, unreadable or out of date', () => {
    expect(readStoredMoney()).toEqual(DEFAULT_MONEY);
    localStorage.setItem('the-budget.money', '{');
    expect(readStoredMoney()).toEqual(DEFAULT_MONEY);
    localStorage.setItem('the-budget.money', JSON.stringify({ currency: 'USD', magnitude: 7 }));
    expect(readStoredMoney()).toEqual(DEFAULT_MONEY);
  });
});
