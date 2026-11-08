import { describe, expect, it } from 'vitest';

import { BUDGET_PERIOD_ROW, toBudgetPeriodGroup } from './budget-periods';
import { adjustImpreciseOverlaps, assignLanes, buildGanttCategories } from './timeline-lanes';
import { BudgetPeriods, GanttGroup } from './timeline.model';

const periods: BudgetPeriods = {
  budgets: [{ year: 2026, lateByDays: 211, law: { title: 'ЗДБРБ 2026', dv: 'ДВ, бр. 69', adopted: null } }],
  regimes: [
    { from: '2026-01-01', to: '2026-07-30', budgetYear: 2025, kind: 'carryover', laws: ['ДВ, бр. 1'] },
    { from: '2026-07-31', to: '2026-12-31', budgetYear: 2026, kind: 'own', laws: ['ДВ, бр. 69'] },
    { from: '2027-01-01', to: '2027-12-31', budgetYear: 2027, kind: 'own', laws: [] },
  ],
};

describe('toBudgetPeriodGroup', () => {
  it('draws a carryover and an own stretch in their two shades', () => {
    const { name, items } = toBudgetPeriodGroup(periods);

    expect(name).toBe(BUDGET_PERIOD_ROW);
    expect(items.map((item) => item.name)).toEqual(['2025 (удължен)', '2026']);
    expect(items[0].color).not.toBe(items[1].color);
    expect(items[0].title).toContain('удължен до приемането на бюджета за 2026 г.');
  });

  it('never states an adoption date the law did not yield', () => {
    expect(toBudgetPeriodGroup(periods).items[1].description).toContain('не е установена');
  });
});

describe('assignLanes', () => {
  it('keeps back-to-back bars on one lane and splits real overlaps', () => {
    const items = [
      { name: 'a', value: ['2000-01-01', '2001-01-01'] as [string, string] },
      { name: 'b', value: ['2001-01-01', '2002-01-01'] as [string, string] },
      { name: 'c', value: ['2000-06-01', '2000-09-01'] as [string, string] },
    ];

    expect(assignLanes(items)).toEqual([0, 0, 1]);
  });

  it('treats an open end as running to now', () => {
    const items = [
      { name: 'a', value: ['2000-01-01', null] as [string, null] },
      { name: 'b', value: ['2020-01-01', '2021-01-01'] as [string, string] },
    ];

    expect(assignLanes(items)).toEqual([0, 1]);
  });
});

describe('buildGanttCategories', () => {
  it('labels a row once however many lanes it takes', () => {
    const group: GanttGroup = {
      name: 'Р',
      items: [
        { name: 'a', value: ['2000-01-01', '2002-01-01'] },
        { name: 'b', value: ['2001-01-01', '2003-01-01'] },
      ],
    };

    expect(buildGanttCategories([group])).toEqual({ labels: ['Р', '\0Р'], isGroupStart: [true, false] });
  });
});

describe('adjustImpreciseOverlaps', () => {
  const uncited = [{ name: 'източник' }];

  it('moves two uncited dates that collide to mid-month', () => {
    const group: GanttGroup = {
      name: 'Р',
      items: [
        { name: 'a', value: ['2000-01-01', '2001-03-20'], sources: uncited },
        { name: 'b', value: ['2001-03-01', '2002-01-01'], sources: uncited },
      ],
    };

    adjustImpreciseOverlaps([group]);

    expect(group.items[0].value[1]).toBe('2001-03-15');
    expect(group.items[1].value[0]).toBe('2001-03-15');
  });

  it('leaves a cited date alone', () => {
    const group: GanttGroup = {
      name: 'Р',
      items: [
        { name: 'a', value: ['2000-01-01', '2001-03-20'], sources: [{ name: 'източник', to: { date: '2001-03-20' } }] },
        { name: 'b', value: ['2001-03-01', '2002-01-01'], sources: uncited },
      ],
    };

    adjustImpreciseOverlaps([group]);

    expect(group.items[0].value[1]).toBe('2001-03-20');
  });
});
