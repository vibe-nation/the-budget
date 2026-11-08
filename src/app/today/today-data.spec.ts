import { describe, expect, it } from 'vitest';

import charts from '../../../public/data/charts.json';
import today from '../../../public/data/today.json';
import { ChartSeries, TodayData } from '../charts/timeline/timeline.model';
import { TodayRow, toTodayRows } from './today-table';

/* The shipped files themselves: a figure that stops resolving or adding up would otherwise
   just vanish from the page. */
const data = today as unknown as TodayData;
const rows = toTodayRows(data, charts as unknown as ChartSeries[]);
const everyRow: readonly TodayRow[] = rows.flatMap((row) => [row, ...row.parts]);

describe('public/data/today.json', () => {
  it('resolves every institution and part to a figure', () => {
    expect(rows.length).toBe(data.entries.length);
    for (const entry of data.entries) {
      const row = rows.find(({ name }) => name === entry.name);
      expect(row?.parts.length, entry.name).toBe(entry.parts?.length ?? 0);
    }
  });

  it('cites, for each figure, the amount the law prints', () => {
    for (const { name, amount, source } of everyRow) {
      expect(source.amountUnit, name).toBe('хил. евро');
      expect(Math.round(source.amount * 1000), name).toBe(Math.round(amount));
    }
  });

  it('places each figure at an article, row, column and page', () => {
    for (const { name, source } of everyRow) {
      expect(source.article, name).toBeTruthy();
      expect(source.row, name).toBeTruthy();
      expect(source.column, name).toBeTruthy();
      expect(source.filePage, name).toBeGreaterThan(0);
      expect(source.gazette.page ?? source.gazette.actPage, name).toBeGreaterThan(0);
      expect(source.gazette.actUrl, name).toMatch(/^https:\/\/dv\.parliament\.bg\//);
    }
  });

  it('adds the parts of an institution up to its total', () => {
    for (const { name, amount, parts } of rows.filter((row) => row.parts.length)) {
      expect(parts.reduce((sum, part) => sum + part.amount, 0), name).toBe(amount);
    }
  });
});
