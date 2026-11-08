import { NgTemplateOutlet } from '@angular/common';
import { httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import {
  LucideBookOpen,
  LucideChevronDown,
  LucideDatabase,
  LucideDynamicIcon,
  LucideFileText,
  LucideLandmark,
  LucidePencil,
  LucidePlay,
  provideLucideIcons,
} from '@lucide/angular';

import { MetricDescription, chartsFileUrl, descriptionHtml, metricEditUrl, metricUrl } from './metric-description';
import { SourceKind, SourceRow, toSourceRow } from './source-row';
import { electionSources, formatPercent, formatVotes, SeatRow, seatRows, totalSeats } from './timeline-elections';
import { fullDuration, durationParts, sumDurations } from './timeline-format';
import { DateAgoPipe, HumanDatePipe } from './timeline-pipes';
import { RelatedTenureRow } from './timeline-selection';
import { CardContent, Election } from './timeline.model';

/** A tenure row plus its pre-rendered „7 години, 11 месеца, 7 дни“ duration. */
interface TenureRow extends RelatedTenureRow {
  readonly duration: string;
}

/* Lucide has no PDF glyph, so the template draws that kind's own file icon. */
const KIND_ICON: Readonly<Record<Exclude<SourceKind, 'pdf'>, string>> = {
  official: 'landmark',
  video: 'play',
  reference: 'book-open',
  document: 'file-text',
};

@Component({
  selector: 'app-detail-card',
  imports: [LucideDynamicIcon, HumanDatePipe, DateAgoPipe, NgTemplateOutlet, MetricDescription],
  templateUrl: './detail-card.html',
  styleUrl: './detail-card.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [provideLucideIcons(LucideBookOpen, LucideChevronDown, LucideDatabase, LucideFileText, LucideLandmark, LucidePencil, LucidePlay)],
})
export class DetailCard {
  readonly content = input.required<CardContent>();
  /** The selected person's bars, chronological. */
  readonly relatedTenures = input<readonly RelatedTenureRow[]>([]);
  /** A related row was clicked: select that bar on the chart. */
  readonly selectTenure = output<string>();
  /** The date row was clicked: bring what the card describes back into view. */
  readonly locate = output<void>();

  /* Collapsed by default to keep the card short; not reset when the selection
     changes, so browsing a career through the list keeps it open. */
  readonly tenuresOpen = signal(false);

  /** The card's headline; a bar named after its own row has none. */
  readonly headName = computed(() => {
    const { name, group } = this.content();
    return name && name !== group ? name : '';
  });

  readonly roleUnderName = computed(() => (this.headName() ? this.content().group : ''));

  /** What the date row prints; a series spans no dates of its own. */
  readonly span = computed(() => {
    const { from, to } = this.content();
    return from === undefined || to === undefined ? null : { from, to };
  });

  /** An event of one day: it has a date, not a range or a length. */
  readonly singleDay = computed(() => this.span()?.from === this.span()?.to);

  readonly duration = computed(() => {
    const span = this.span();
    return span ? fullDuration(durationParts(span.from, span.to)) : '';
  });

  /* A law's title, or an assembly's spelled-out name where no election stands in
     for it. A stripe's title only repeats that it is a term. */
  readonly subtitle = computed(() => {
    const { title, name, election } = this.content();
    return title && name && title !== name && !election ? title : '';
  });

  /* Latest first: the reader lands on the current or most recent role. */
  readonly tenureRows = computed<readonly TenureRow[]>(() =>
    [...this.relatedTenures()].reverse().map((row) => ({ ...row, duration: fullDuration(durationParts(row.from, row.to)) }))
  );

  /* The sum of the rows, which is what the reader can check by adding them up:
     concurrent roles are counted once each, not merged. */
  readonly tenuresTotal = computed(() => fullDuration(sumDurations(this.relatedTenures().map((row) => [row.from, row.to] as const))));

  readonly election = computed<Election | null>(() => this.content().election ?? null);
  readonly seatRows = computed<SeatRow[]>(() => {
    const election = this.election();
    return election ? seatRows(election) : [];
  });
  readonly totalSeats = computed(() => {
    const election = this.election();
    return election ? totalSeats(election) : 0;
  });
  readonly electionSources = computed(() => {
    const election = this.election();
    return election ? electionSources(election) : [];
  });

  /* The lead source sits under „Източник“; the rest under „Други източници и контекст“. */
  readonly primarySource = computed<SourceRow | null>(() => {
    const source = this.content().sources?.[0];
    return source ? toSourceRow(source) : null;
  });
  readonly otherSources = computed<SourceRow[]>(() => (this.content().sources ?? []).slice(1).map(toSourceRow));

  readonly firstSourceUrl = computed(() => this.primarySource()?.url ?? '');

  /* A series without a file fails the request, and the section stays out. */
  private readonly metricFile = httpResource.text(() => {
    const { metric } = this.content();
    return metric ? metricUrl(metric) : undefined;
  });
  readonly metricHtml = computed(() => (this.metricFile.hasValue() ? descriptionHtml(this.metricFile.value()) : ''));
  readonly metricEditLink = computed(() => metricEditUrl(this.content().metric ?? ''));

  protected readonly chartsFileUrl = chartsFileUrl;
  protected readonly formatVotes = formatVotes;
  protected readonly formatPercent = formatPercent;

  iconFor(kind: Exclude<SourceKind, 'pdf'>): string {
    return KIND_ICON[kind];
  }

  onTenureClick(row: RelatedTenureRow): void {
    if (!row.isCurrent) this.selectTenure.emit(row.id);
  }
}
