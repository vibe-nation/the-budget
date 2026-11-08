import moment from 'moment';

import { GanttGroup, GanttItem } from './timeline.model';

const LANE_OVERLAP_TOLERANCE_MS = 10 * 24 * 3600 * 1000;
const OVERLAP_THRESHOLD_DAYS = 31;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Which lane of its row each bar sits in; bars that overlap get their own. */
export function assignLanes(items: readonly GanttItem[]): number[] {
  const lanes: number[] = new Array(items.length).fill(0);
  const laneEnds: number[] = [];

  const sorted = items.map((item, idx) => ({ idx, from: +new Date(item.value[0]) })).sort((a, b) => a.from - b.from);

  sorted.forEach(({ idx, from }) => {
    const end = items[idx].value[1];
    const to = end === null ? Date.now() : +new Date(end);
    let lane = laneEnds.findIndex((laneEnd) => from >= laneEnd - LANE_OVERLAP_TOLERANCE_MS);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(to);
    } else {
      laneEnds[lane] = to;
    }
    lanes[idx] = lane;
  });

  return lanes;
}

export function laneCount(group: GanttGroup): number {
  return group.items.length ? Math.max(...assignLanes(group.items)) + 1 : 1;
}

export interface GanttCategories {
  /** One label per lane. A lane that continues a row is `\0`-prefixed and prints nothing. */
  readonly labels: string[];
  readonly isGroupStart: boolean[];
}

export function buildGanttCategories(groups: readonly GanttGroup[]): GanttCategories {
  const labels: string[] = [];
  const isGroupStart: boolean[] = [];

  groups.forEach((group) => {
    const lanes = laneCount(group);
    for (let lane = 0; lane < lanes; lane++) {
      labels.push(lane === 0 ? group.name : `\0${group.name}`);
      isGroupStart.push(lane === 0);
    }
  });

  return { labels, isGroupStart };
}

/* A date no source pins down is only known to the month. When two such dates
   collide — the outgoing holder "ended" just after the next one "began" — both
   move to mid-month, so a guess at the day cannot open a lane of its own. */
export function adjustImpreciseOverlaps(groups: readonly GanttGroup[]): void {
  groups.forEach((group) => {
    const items = [...group.items].sort((a, b) => +new Date(a.value[0]) - +new Date(b.value[0]));

    for (let k = 0; k < items.length - 1; k++) {
      const a = items[k];
      const b = items[k + 1];

      if (a.value[1] === null) continue;

      const aEnd = +new Date(a.value[1]);
      const bStart = +new Date(b.value[0]);

      if (aEnd < bStart) continue;
      if ((aEnd - bStart) / MS_PER_DAY >= OVERLAP_THRESHOLD_DAYS) continue;
      if (!isEndImprecise(a) || !isStartImprecise(b)) continue;

      a.value[1] = toMidMonth(a.value[1]);
      b.value[0] = toMidMonth(b.value[0]);
    }
  });
}

function isStartImprecise(item: GanttItem): boolean {
  const sources = item.sources ?? [];
  return sources.length > 0 && sources.every((source) => !source.from?.date);
}

function isEndImprecise(item: GanttItem): boolean {
  const sources = item.sources ?? [];
  return sources.length > 0 && sources.every((source) => !source.to?.date);
}

function toMidMonth(date: string): string {
  return moment(date).date(15).format('YYYY-MM-DD');
}
