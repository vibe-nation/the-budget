import { SNAP_RADIUS_PX, nearestPoint, snapCandidates } from './timeline-snap';

const point = (date: string, value: number, symbol?: string) => ({
  content: { date, value },
  value: [date, value] as [string, number],
  ...(symbol ? { symbol } : {}),
});

const optionSeries = [
  { name: 'today', type: 'line', data: [] },
  {
    name: 'a',
    type: 'line',
    data: [point('2019-12-31', 1, 'none'), point('2020-12-31', 1), point('2021-12-31', 3)],
  },
  { name: 'gantt', type: 'custom', data: [{ content: { id: 'x' } }] },
  { name: 'b', type: 'line', data: [point('2020-12-31', 2)] },
];

describe('snapCandidates', () => {
  const candidates = snapCandidates(optionSeries, ['a', 'b']);

  it('keep the charted series, by their place in the option', () => {
    expect(candidates.map(({ id, seriesIndex }) => [id, seriesIndex])).toEqual([
      ['a', 1],
      ['b', 3],
    ]);
  });

  it('skip a drawn opening, and keep the data index of what remains', () => {
    expect(candidates[0].points.map(({ dataIndex }) => dataIndex)).toEqual([1, 2]);
    expect(candidates[0].points[0].time).toBe(+new Date('2020-12-31'));
  });
});

describe('nearestPoint', () => {
  const candidates = snapCandidates(optionSeries, ['a', 'b']);
  /* A year is 100px wide and a unit of value 10px tall. */
  const toPixel = vi.fn(
    (_seriesIndex: number, [date, value]: readonly [string, number]) =>
      [(new Date(date).getFullYear() - 2020) * 100, value * 10] as const,
  );
  const year = 365 * 24 * 3600 * 1000;
  const around = (time: number) => [time - year / 4, time + year / 4] as const;
  const shown = () => true;

  afterEach(() => toPixel.mockClear());

  it('takes the point within reach, nearest by pixel', () => {
    const found = nearestPoint(
      candidates,
      shown,
      [4, 22],
      around(+new Date('2020-12-31')),
      toPixel,
    );
    expect(found).toMatchObject({ seriesIndex: 3, dataIndex: 0 });
  });

  it('takes nothing when every point is out of reach', () => {
    expect(
      nearestPoint(
        candidates,
        shown,
        [4, 22 + SNAP_RADIUS_PX],
        around(+new Date('2020-12-31')),
        toPixel,
      ),
    ).toBeNull();
  });

  it('leaves a series the legend has off', () => {
    const found = nearestPoint(
      candidates,
      (id) => id !== 'b',
      [4, 22],
      around(+new Date('2020-12-31')),
      toPixel,
    );
    expect(found).toMatchObject({ seriesIndex: 1, dataIndex: 1 });
  });

  it('only measures the points dated near the cursor', () => {
    nearestPoint(candidates, shown, [4, 22], around(+new Date('2020-12-31')), toPixel);
    expect(toPixel).toHaveBeenCalledTimes(2);
  });
});
