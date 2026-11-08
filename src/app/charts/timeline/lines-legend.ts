import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { isListed } from './legend-search';
import { LegendSelection, lineColor } from './timeline-lines';
import { ChartSeries } from './timeline.model';

/** One row of the legend: a series, by name. */
export interface LegendRow {
  readonly id: string;
  readonly name: string;
  readonly color: string;
  readonly shown: boolean;
}

/* The line grid's legend, drawn in HTML beside it rather than by ECharts: one
   name to a line, from the top of the chart down, scrolling once the series
   outnumber the lines that fit. It holds no state — the chart's legend
   component still owns which series is on, and `TimelineChart` switches it
   through actions. A pick in the search narrows this list, and `TimelineChart`
   draws the series it leaves out off; every series keeps its own colour. */
@Component({
  selector: 'app-lines-legend',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './lines-legend.html',
  styleUrl: './lines-legend.css',
  host: { '[class.is-narrow]': 'narrow()' },
})
export class LinesLegend {
  readonly charts = input.required<readonly ChartSeries[]>();
  readonly selection = input.required<LegendSelection>();
  /** The series picked in the search, to list alone; none lists them all. */
  readonly picked = input<ReadonlySet<string>>(new Set());
  /** Under the chart instead of beside it. */
  readonly narrow = input(false);

  readonly toggled = output<string>();
  /** The row under the pointer, or `null` once it has left. */
  readonly hovered = output<string | null>();
  readonly shownAll = output<void>();
  readonly hiddenAll = output<void>();

  protected readonly rows = computed<readonly LegendRow[]>(() => {
    const selection = this.selection();
    return this.charts()
      .map((chart, index) => ({
        id: chart.id,
        name: chart.name,
        color: lineColor(index),
        shown: selection[chart.id] !== false,
      }))
      .filter((row) => isListed(this.picked(), row.id));
  });

  protected readonly hiddenCount = computed(() => this.rows().filter((row) => !row.shown).length);
  protected readonly shownCount = computed(() => this.rows().length - this.hiddenCount());
}
