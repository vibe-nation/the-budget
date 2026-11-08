import { describe, expect, it } from 'vitest';

import { buildCurrentDateLine, buildGanttSeries } from './timeline-series';
import { SEL_NONE, SEL_SELECTED, V_SEL } from './timeline-selection';
import { GanttGroup } from './timeline.model';

const group: GanttGroup = { name: 'Ред', items: [{ name: 'а', value: ['2000-01-01', '2001-01-01'] }] };

function barHeight(rowHeight: number, selection = SEL_NONE): number {
  const { renderItem } = buildGanttSeries([group]) as any;
  const values: Record<number, unknown> = { 0: 0, 1: 0, 2: 400, 3: '', 4: 0, 5: 0, [V_SEL]: selection };
  const api = {
    value: (index: number) => values[index],
    coord: ([x]: number[]) => [x, 200],
    size: () => [0, rowHeight],
    visual: () => '#123456',
  };
  const params = { coordSys: { x: 0, y: 0, width: 1000, height: 1000 } };

  return renderItem(params, api).children[0].shape.height;
}

describe('a gantt bar', () => {
  it('fills most of a tight row', () => {
    expect(barHeight(20)).toBeCloseTo(16);
  });

  it('stops growing in a tall row', () => {
    expect(barHeight(120)).toBe(28);
  });

  it('still rises when clicked in a tall row', () => {
    expect(barHeight(120, SEL_SELECTED)).toBeGreaterThan(28);
  });
});

/* ECharts draws a line series at z 3; the bars are drawn at z 10. */
describe('buildCurrentDateLine', () => {
  it('stands over the bars and under the data lines', () => {
    expect((buildCurrentDateLine(0) as any).markLine.z).toBeGreaterThan(10);
    expect((buildCurrentDateLine(1) as any).markLine.z).toBeLessThan(3);
  });
});
