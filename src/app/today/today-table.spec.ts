import { afterEach, describe, expect, it } from 'vitest';

import { ChartSeries, LawCitation, TodayData } from '../charts/timeline/timeline.model';
import {
  daysInYear,
  formatAmount,
  perDay,
  readTodayMagnitude,
  sourceHref,
  sourceLabel,
  sourceTitle,
  storeTodayMagnitude,
  toTodayRows,
  todayTotal,
} from './today-table';

const citation = (over: Partial<LawCitation> = {}): LawCitation => ({
  title: 'Закон за държавния бюджет на Република България за 2026 г.',
  amount: 2115233.2,
  amountUnit: 'хил. евро',
  article: 12,
  paragraph: 1,
  row: 'II. РАЗХОДИ',
  column: 'Сума',
  gazette: {
    citation: 'ДВ, бр. 69 от 31.07.2026 г.',
    date: '2026-07-31',
    page: 14,
    actUrl: 'https://dv.example/act',
    issueUrl: null,
  },
  fileUrl: 'https://minfin.example/law.pdf',
  filePage: 14,
  ...over,
});

const series = (id: string, points: readonly [string, number][]): ChartSeries => ({
  id,
  name: id,
  unit: 'EUR',
  data: points.map(([date, value]) => ({ date, value, change: 0, sources: [citation()] })),
});

const plain = (text: string) => text.replace(/\s/g, ' ');

describe('toTodayRows', () => {
  it('puts the largest institution first', () => {
    const data: TodayData = {
      year: 2026,
      entries: [
        { name: 'Малка', value: 10, sources: [citation()] },
        { name: 'Голяма', value: 30, sources: [citation()] },
      ],
    };

    expect(toTodayRows(data, []).map((row) => row.name)).toEqual(['Голяма', 'Малка']);
  });

  it('takes a series figure of the page year, not its latest', () => {
    const data: TodayData = { year: 2026, entries: [{ name: 'МВР', series: 'mvr' }] };
    const charts = [
      series('mvr', [
        ['2026-12-31', 100],
        ['2027-12-31', 999],
      ]),
    ];

    expect(toTodayRows(data, charts)[0].amount).toBe(100);
  });

  it('leaves out an institution with no figure that year rather than showing a zero', () => {
    const data: TodayData = { year: 2026, entries: [{ name: 'Няма', series: 'absent' }] };

    expect(toTodayRows(data, [])).toEqual([]);
  });

  it('keeps the parts under their institution, largest first', () => {
    const data: TodayData = {
      year: 2026,
      entries: [
        {
          name: 'Съдебна власт',
          value: 30,
          sources: [citation()],
          parts: [
            { name: 'Резерв', value: 10, sources: [citation()] },
            { name: 'Съдилища', value: 20, sources: [citation()] },
          ],
        },
      ],
    };

    expect(toTodayRows(data, [])[0].parts.map((part) => part.name)).toEqual(['Съдилища', 'Резерв']);
  });
});

describe('todayTotal', () => {
  it('adds the institutions without counting their parts again', () => {
    const data: TodayData = {
      year: 2026,
      entries: [
        { name: 'МВР', value: 100, sources: [citation()] },
        {
          name: 'Съдебна власт',
          value: 30,
          sources: [citation()],
          parts: [{ name: 'Съдилища', value: 30, sources: [citation()] }],
        },
      ],
    };

    expect(todayTotal(toTodayRows(data, []))).toBe(130);
  });
});

describe('perDay', () => {
  it('divides by the days of that year', () => {
    expect(daysInYear(2026)).toBe(365);
    expect(daysInYear(2028)).toBe(366);
    expect(perDay(365, 2026)).toBe(1);
    expect(perDay(366, 2028)).toBe(1);
  });
});

describe('formatAmount', () => {
  it('prints whole euro with every thousand grouped', () => {
    expect(plain(formatAmount(9964.4, { currency: 'EUR', magnitude: 1 }))).toBe('9 964 €');
    expect(plain(formatAmount(2115233200, { currency: 'EUR', magnitude: 1 }))).toBe('2 115 233 200 €');
  });

  it('converts to leva at the fixed rate', () => {
    expect(plain(formatAmount(1000, { currency: 'BGN', magnitude: 1 }))).toBe('1 956 лв.');
  });

  it('states a scaled amount with two decimals and names the scale', () => {
    expect(plain(formatAmount(2115233200, { currency: 'EUR', magnitude: 1_000_000_000 }))).toBe('2,12 млрд. €');
    expect(plain(formatAmount(1_000_000, { currency: 'BGN', magnitude: 1_000_000 }))).toBe('1,96 млн. лв.');
    expect(plain(formatAmount(9964.4, { currency: 'EUR', magnitude: 1_000 }))).toBe('9,96 хил. €');
  });

  it('never rounds a small amount down to a zero', () => {
    expect(plain(formatAmount(2879, { currency: 'EUR', magnitude: 1_000_000_000 }))).toBe('< 0,01 млрд. €');
  });
});

describe('the stored scale', () => {
  afterEach(() => localStorage.clear());

  it('starts at whole units, where every amount reads in full', () => {
    expect(readTodayMagnitude()).toBe(1);
  });

  it('comes back as it was stored', () => {
    storeTodayMagnitude(1_000_000);

    expect(readTodayMagnitude()).toBe(1_000_000);
  });

  it('ignores a value that is not on offer', () => {
    localStorage.setItem('the-budget.today-magnitude', '7');

    expect(readTodayMagnitude()).toBe(1);
  });
});

describe('the source of a row', () => {
  it('gives the article and page of the state budget act', () => {
    expect(sourceLabel({ source: citation() })).toBe('чл. 12, ал. 1 · стр. 14');
  });

  it('names a different law and its gazette issue', () => {
    const source = citation({
      article: 1,
      paragraph: 2,
      gazette: {
        citation: 'ДВ, бр. 68 от 28.07.2026 г.',
        date: '2026-07-28',
        page: null,
        actPage: 34,
        actUrl: 'https://dv.example/nzok',
        issueUrl: null,
      },
    });

    expect(sourceLabel({ source, lawShort: 'ЗБНЗОК' })).toBe(
      'ЗБНЗОК, чл. 1, ал. 2 · ДВ, бр. 68/2026, акт от стр. 34',
    );
  });

  it('links to the published law, opened on the page', () => {
    expect(sourceHref(citation())).toBe('https://minfin.example/law.pdf#page=14');
  });

  it('spells out the row, column and printed amount', () => {
    const title = plain(sourceTitle(citation()));

    expect(title).toContain('ДВ, бр. 69 от 31.07.2026 г., стр. 14');
    expect(title).toContain('ред „II. РАЗХОДИ“');
    expect(title).toContain('колона „Сума“');
    expect(title).toContain('2 115 233,2 хил. евро');
  });
});
