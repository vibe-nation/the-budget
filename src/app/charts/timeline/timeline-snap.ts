/* The axis pointer runs free under the cursor, and takes a point only when the
   cursor comes within reach of one. ECharts' own `snap` is all or nothing along
   the axis, so the reach is measured here, and the component re-aims the
   pointer at the point it finds. */

/** How close, in pixels, the cursor has to come to a point for the pointer to take it. */
export const SNAP_RADIUS_PX = 16;

export interface SnapPoint {
  readonly seriesIndex: number;
  /** The point's index in the series as drawn, which an opening may shift from the data's. */
  readonly dataIndex: number;
  readonly time: number;
  readonly value: readonly [string, number];
}

export interface SnapSeries {
  readonly id: string;
  readonly seriesIndex: number;
  readonly points: readonly SnapPoint[];
}

interface DrawnPoint {
  readonly content?: { readonly date?: string };
  readonly value?: readonly [string, number];
  readonly symbol?: string;
}

/**
 * The points the pointer can take, read once per build from the option's series,
 * which fixes each series' index. A drawn opening (`symbol: 'none'`) is no point.
 *
 * @param ids The charted series' names; the option's other lines are not points.
 */
export function snapCandidates(
  series: readonly { readonly name?: string; readonly data?: readonly unknown[] }[],
  ids: readonly string[],
): SnapSeries[] {
  const charted = new Set(ids);
  return series.flatMap((entry, seriesIndex) => {
    if (!entry.name || !charted.has(entry.name)) return [];
    const points = (entry.data ?? []).flatMap((item, dataIndex) => {
      const { content, value, symbol } = item as DrawnPoint;
      if (symbol === 'none' || !content?.date || !value) return [];
      return [{ seriesIndex, dataIndex, time: +new Date(content.date), value }];
    });
    return [{ id: entry.name, seriesIndex, points }];
  });
}

/**
 * The point nearest the cursor within `radius`, or `null`.
 *
 * @param shown Whether a series is on; one the legend has off is not drawn.
 * @param pixel The cursor.
 * @param window The times the cursor's reach spans; only points dated in it are measured,
 *   as converting every point of every series on each move would be wasteful.
 * @param toPixel Where a series draws a value.
 */
export function nearestPoint(
  candidates: readonly SnapSeries[],
  shown: (id: string) => boolean,
  pixel: readonly [number, number],
  window: readonly [number, number],
  toPixel: (
    seriesIndex: number,
    value: readonly [string, number],
  ) => readonly [number, number] | undefined,
  radius = SNAP_RADIUS_PX,
): SnapPoint | null {
  const [from, to] = window[0] <= window[1] ? window : [window[1], window[0]];
  let best: SnapPoint | null = null;
  let bestDistance = radius;

  for (const series of candidates) {
    if (!shown(series.id)) continue;
    for (const point of series.points) {
      if (point.time < from || point.time > to) continue;
      const at = toPixel(point.seriesIndex, point.value);
      if (!at) continue;
      const distance = Math.hypot(at[0] - pixel[0], at[1] - pixel[1]);
      if (distance <= bestDistance) {
        best = point;
        bestDistance = distance;
      }
    }
  }
  return best;
}
