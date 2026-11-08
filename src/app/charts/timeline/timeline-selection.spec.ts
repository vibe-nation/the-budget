import { describe, expect, it } from 'vitest';

import { SEL_DIMMED, SEL_NONE, SEL_RELATED, SEL_SELECTED, V_SEL, centeredZoom, paintSelection, relatedTenures } from './timeline-selection';
import { GanttBar } from './timeline.model';

const bar = (id: string, name: string, group: string, from: number): GanttBar => ({
  content: { id, name, group, from, to: from + 10 },
  name,
  value: [0, from, from + 10, name, 0, 0, SEL_NONE],
  itemStyle: { color: '#123456' },
});

const bars = [bar('a', 'Румен Радев', 'Президент', 100), bar('b', 'Румен Радев', 'Министър-председател', 200), bar('c', 'Гълъб Донев', 'Министър-председател', 50), bar('s', '', 'Президент', 300)];
const state = (painted: readonly GanttBar[]) => painted.map((item) => item.value[V_SEL]);

describe('paintSelection', () => {
  it('lights the bar, marks the same person and dims the rest', () => {
    expect(state(paintSelection(bars, 'a'))).toEqual([SEL_SELECTED, SEL_RELATED, SEL_DIMMED, SEL_DIMMED]);
  });

  it('never treats two nameless stripes as one person', () => {
    const stripes = [bar('s1', '', 'Президент', 1), bar('s2', '', 'Министър-председател', 2)];

    expect(state(paintSelection(stripes, 's1'))).toEqual([SEL_SELECTED, SEL_DIMMED]);
  });

  it('rests every bar when nothing is selected, and for a bar no longer on the chart', () => {
    const lit = paintSelection(bars, 'a');

    expect(state(paintSelection(lit, null))).toEqual([SEL_NONE, SEL_NONE, SEL_NONE, SEL_NONE]);
    expect(state(paintSelection(lit, 'gone'))).toEqual([SEL_NONE, SEL_NONE, SEL_NONE, SEL_NONE]);
  });

  it('reuses bars whose state did not change', () => {
    expect(paintSelection(bars, null)[0]).toBe(bars[0]);
  });
});

describe('relatedTenures', () => {
  it('lists the person across rows, chronologically, marking the current one', () => {
    const rows = relatedTenures(bars, 'b');

    expect(rows.map((row) => row.role)).toEqual(['Президент', 'Министър-председател']);
    expect(rows.map((row) => row.isCurrent)).toEqual([false, true]);
  });

  it('is empty for a stripe, which belongs to no one', () => {
    expect(relatedTenures(bars, 's')).toEqual([]);
  });
});

describe('centeredZoom', () => {
  const axis = { min: 0, max: 1000 };
  const current = { start: 80, end: 100 };

  it('leaves a window that already shows part of the span', () => {
    expect(centeredZoom({ from: 700, to: 850 }, current, axis)).toBeNull();
  });

  it('moves to a span out of view, keeping the width', () => {
    expect(centeredZoom({ from: 490, to: 510 }, current, axis)).toEqual({ start: 40, end: 60 });
  });

  it('re-centres on request even when the span is in view', () => {
    expect(centeredZoom({ from: 880, to: 900 }, current, axis, true)?.start).toBeCloseTo(79);
  });

  it('stops at the ends of the axis', () => {
    expect(centeredZoom({ from: 0, to: 10 }, current, axis)).toEqual({ start: 0, end: 20 });
    expect(centeredZoom({ from: 990, to: 1000 }, { start: 0, end: 20 }, axis)).toEqual({ start: 80, end: 100 });
  });
});
