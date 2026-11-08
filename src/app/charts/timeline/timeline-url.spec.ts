import { describe, expect, it } from 'vitest';

import charts from '../../../../public/data/charts.json';
import { DEFAULT_MONEY, MoneyView } from './timeline-money';
import {
  hiddenEventsFromUrl,
  legendFromUrl,
  lineShapeFromUrl,
  moneyFromUrl,
  viewParams,
  viewQuery,
} from './timeline-url';
import { ChartSeries, TimelineEvent } from './timeline.model';

const series = (id: string) => ({ id }) as ChartSeries;
const event = (id: string) => ({ id }) as TimelineEvent;
const lines = [series('a'), series('b'), series('c')];
const events = [event('x'), event('y')];
const STORED: MoneyView = { currency: 'BGN', magnitude: 1_000 };

describe('viewParams', () => {
  it('reads the query of a path', () => {
    expect(viewParams('/?lines=a,b&scale=1').get('lines')).toBe('a,b');
  });

  it('has nothing for a path without one', () => {
    expect(viewParams('/').get('lines')).toBeNull();
  });
});

describe('moneyFromUrl', () => {
  it('takes the currency and the scale from the address', () => {
    expect(moneyFromUrl(viewParams('/?currency=EUR&scale=1000000'), STORED)).toEqual({
      currency: 'EUR',
      magnitude: 1_000_000,
    });
  });

  it('keeps the stored view without them', () => {
    expect(moneyFromUrl(viewParams('/'), STORED)).toEqual(STORED);
  });

  it('takes each part on its own', () => {
    expect(moneyFromUrl(viewParams('/?scale=1'), STORED)).toEqual({
      currency: 'BGN',
      magnitude: 1,
    });
  });

  it('ignores a value not on offer', () => {
    expect(moneyFromUrl(viewParams('/?currency=USD&scale=7'), STORED)).toEqual(STORED);
  });
});

describe('lineShapeFromUrl', () => {
  it('takes the shape from the address', () => {
    expect(lineShapeFromUrl(viewParams('/?shape=line'), 'step')).toBe('line');
    expect(lineShapeFromUrl(viewParams('/?shape=step'), 'line')).toBe('step');
  });

  it('keeps the stored shape without one', () => {
    expect(lineShapeFromUrl(viewParams('/'), 'line')).toBe('line');
  });

  it('ignores a value not on offer', () => {
    expect(lineShapeFromUrl(viewParams('/?shape=curve'), 'line')).toBe('line');
  });
});

describe('legendFromUrl', () => {
  const fallback = { c: false };

  it('switches on only the series named', () => {
    expect(legendFromUrl(viewParams('/?lines=a,c'), lines, fallback)).toEqual({
      a: true,
      b: false,
      c: true,
    });
  });

  it('reads an empty list as none on', () => {
    expect(legendFromUrl(viewParams('/?lines='), lines, fallback)).toEqual({
      a: false,
      b: false,
      c: false,
    });
  });

  it('skips a series that no longer exists', () => {
    expect(legendFromUrl(viewParams('/?lines=gone,b'), lines, fallback)).toEqual({
      a: false,
      b: true,
      c: false,
    });
  });

  it('keeps the fallback without a list', () => {
    expect(legendFromUrl(viewParams('/'), lines, fallback)).toBe(fallback);
  });
});

describe('hiddenEventsFromUrl', () => {
  const fallback = new Set(['y']);

  it('hides the events not named', () => {
    expect(hiddenEventsFromUrl(viewParams('/?events=y'), events, fallback)).toEqual(new Set(['x']));
  });

  it('reads an empty list as all hidden', () => {
    expect(hiddenEventsFromUrl(viewParams('/?events='), events, fallback)).toEqual(
      new Set(['x', 'y']),
    );
  });

  it('keeps the fallback without a list', () => {
    expect(hiddenEventsFromUrl(viewParams('/'), events, fallback)).toBe(fallback);
  });
});

describe('viewQuery', () => {
  it('states the series on, the money and the events shown', () => {
    expect(viewQuery(lines, { b: false }, events, new Set(['x']), STORED, 'line')).toBe(
      'lines=a,c&currency=BGN&scale=1000&events=y&shape=line',
    );
  });

  it('states every part at its default too', () => {
    expect(viewQuery([], {}, [], new Set(), DEFAULT_MONEY, 'step')).toBe(
      'lines=&currency=EUR&scale=1000000000&events=&shape=step',
    );
  });

  it('comes back as the same view', () => {
    const legend = { a: false, b: true, c: true };
    const hidden = new Set(['y']);
    const params = viewParams(`/?${viewQuery(lines, legend, events, hidden, STORED, 'line')}`);
    expect(legendFromUrl(params, lines, {})).toEqual(legend);
    expect(hiddenEventsFromUrl(params, events, new Set())).toEqual(hidden);
    expect(moneyFromUrl(params, DEFAULT_MONEY)).toEqual(STORED);
    expect(lineShapeFromUrl(params, 'step')).toBe('line');
  });

  it('keeps the real series ids readable in the address', () => {
    const real = charts as unknown as ChartSeries[];
    const query = viewQuery(real, {}, [], new Set(), DEFAULT_MONEY, 'step');
    for (const { id } of real) expect(query).toContain(id);
  });
});
