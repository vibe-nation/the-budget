import { describe, expect, it } from 'vitest';

import { buildTimelineOption } from './timeline-chart-option';
import { laneCount } from './timeline-lanes';
import { buildGanttSeries } from './timeline-series';
import { GanttGroup } from './timeline.model';

const stripes = (group: GanttGroup) => (buildGanttSeries([group]).data as any[]).filter((bar) => bar.value[5] === 1);

describe('the rest-of-term stripe', () => {
  const held: GanttGroup = {
    name: 'Офис',
    items: [{ name: 'Иван Иванов', value: ['2020-01-01', null] }],
    mandate: [{ value: ['2020-01-01', '2099-01-01'], comment: 'срок' }],
  };

  it('carries the holder on from now to the end of the term, in their lane and colour', () => {
    const bars = buildGanttSeries([held]).data as any[];
    const [stripe] = stripes(held);

    expect(stripe.value[0]).toBe(bars[0].value[0]);
    expect(stripe.value[1]).toBeGreaterThanOrEqual(bars[0].value[1]);
    expect(stripe.value[2]).toBe(+new Date('2099-01-01'));
    expect(stripe.itemStyle.color).toBe(bars[0].itemStyle.color);
    expect(stripe.content).toMatchObject({ title: 'Мандат', comment: 'срок', from: +new Date('2020-01-01') });
  });

  it('draws nothing for a vacant office', () => {
    expect(stripes({ ...held, items: [{ name: 'Иван Иванов', value: ['2020-01-01', '2021-01-01'] }] })).toEqual([]);
  });

  it('draws nothing for a term with no fixed end, or one not yet started', () => {
    expect(stripes({ ...held, mandate: [{ value: ['2020-01-01', null] }] })).toEqual([]);
    expect(stripes({ ...held, mandate: [{ value: ['2098-01-01', '2099-01-01'] }] })).toEqual([]);
  });

  it('follows the latest of two running holders', () => {
    const two: GanttGroup = {
      ...held,
      items: [
        { name: 'Първи', value: ['2020-01-01', null] },
        { name: 'Втори', value: ['2021-01-01', null] },
      ],
    };
    const bars = buildGanttSeries([two]).data as any[];

    expect(stripes(two)[0].value[0]).toBe(bars[1].value[0]);
  });

  it('never opens a lane of its own', () => {
    expect(laneCount(held)).toBe(1);
  });
});

describe('a bar announced for the future', () => {
  it('shares the lane of the holder whose term it follows', () => {
    const group: GanttGroup = {
      name: 'Офис',
      items: [
        { name: 'Иван Иванов', value: ['2020-01-01', null] },
        { name: 'Иван Иванов', value: ['2098-01-01', '2099-01-01'] },
      ],
    };

    expect(laneCount(group)).toBe(1);
  });
});

describe('the time axis', () => {
  const row: GanttGroup = { name: 'Ред', items: [{ name: 'а', value: ['2000-01-01', '2001-01-01'] }] };
  const far: GanttGroup = { name: 'Далечен', items: [], mandate: [{ value: ['2090-01-01', '2099-01-01'] }] };

  it('reaches past the last term of every row, shown or not', () => {
    expect(buildTimelineOption([row], [row, far]).xAxis[0].max).toBe('2099-04-01');
  });
});
