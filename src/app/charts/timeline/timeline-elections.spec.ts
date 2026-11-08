import { describe, expect, it } from 'vitest';

import { assemblyNumber, attachElections, electionSeatsHtml, formatPercent, partyColor, seatRows } from './timeline-elections';
import { Election, GanttGroup } from './timeline.model';

const election: Election = {
  date: '2022-10-02',
  assembly: 48,
  activity: 39.41,
  sources: [],
  metrics: {
    parties: [
      { name: 'Нова & Партия', votes: 40, percent: 10.5, mandates: 3 },
      { name: 'Движение за права и свободи – ДПС', alias: 'ДПС', votes: 60, percent: 16, mandates: 4 },
      { name: 'ГЕРБ-СДС', alias: 'ГЕРБ', votes: 120, percent: 32, mandates: 8 },
      { name: 'Без места', votes: 10, percent: 2 },
    ],
  },
};

const parliament = (): GanttGroup => ({
  name: 'Народно събрание',
  items: [
    { name: 'VII ВНС', value: ['1990-07-10', '1991-10-02'] },
    { name: '48-о НС', value: ['2022-10-19', '2023-02-03'] },
    { name: '49-о НС', value: ['2023-04-12', '2024-06-19'] },
  ],
});

describe('assemblyNumber', () => {
  it('reads the ordinal off a bar name', () => {
    expect(assemblyNumber('48-о НС')).toBe(48);
    expect(assemblyNumber('51-во НС')).toBe(51);
  });

  it('has no number for the Grand National Assembly', () => {
    expect(assemblyNumber('VII ВНС')).toBeNull();
  });
});

describe('attachElections', () => {
  it('hangs each election on its assembly and leaves the others alone', () => {
    const group = parliament();

    attachElections([group], [election]);

    expect(group.items[1].election).toBe(election);
    expect(group.items[0].election).toBeUndefined();
    expect(group.items[2].election).toBeUndefined();
  });

  it('looks only at the Народно събрание row', () => {
    const other: GanttGroup = { ...parliament(), name: 'Президент' };

    attachElections([other], [election]);

    expect(other.items[1].election).toBeUndefined();
  });
});

describe('seatRows', () => {
  it('lists the parties that won seats, most seats first', () => {
    expect(seatRows(election).map((row) => row.alias)).toEqual(['ГЕРБ', 'ДПС', 'Нова & Партия']);
  });

  it('carries shares that sum to the whole house', () => {
    expect(seatRows(election).reduce((sum, row) => sum + row.share, 0)).toBeCloseTo(1);
  });
});

describe('partyColor', () => {
  it('gives the two lists that split from ДПС distinct colours', () => {
    expect(partyColor('АПС')).not.toBe(partyColor('ДПС-Ново начало'));
  });

  it('falls back to a stable hash', () => {
    expect(partyColor('Нова партия')).toBe(partyColor('Нова партия'));
  });
});

describe('electionSeatsHtml', () => {
  it('draws one segment per seat-winning party', () => {
    expect(electionSeatsHtml(election).match(/class="election-seat"/g)).toHaveLength(3);
  });

  it('escapes the party name rather than injecting it', () => {
    const hostile: Election = { ...election, metrics: { parties: [{ name: '<img src=x>', votes: 1, percent: 1, mandates: 1 }] } };

    expect(electionSeatsHtml(hostile)).not.toContain('<img');
  });
});

describe('formatPercent', () => {
  it('prints one decimal with a comma', () => {
    expect(formatPercent(44.594)).toBe('44,6 %');
  });
});
