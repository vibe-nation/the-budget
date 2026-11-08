/** A citation, as the data files carry it and the card prints it. */
export interface Source {
  readonly name: string;
  readonly link?: readonly string[];
  readonly date?: string;
  readonly media?: string;
  readonly comment?: string;
  /** What the source says, with any locator in a trailing `[…]`. */
  readonly quote?: string;
  /** Which endpoint the source supports. An item with neither on any source is imprecise. */
  readonly from?: { readonly date?: string };
  readonly to?: { readonly date?: string };
}

/** One bar. `value` is `[from, to]`; a `null` end is a tenure still running. */
export interface GanttItem {
  readonly name: string;
  readonly title?: string;
  readonly value: [string, string | null];
  readonly description?: string;
  readonly comment?: string;
  /** Overrides the colour hashed from `name`, for rows that are a deliberate scale. */
  readonly color?: string;
  /** The election that returned a Народно събрание bar, hung on it at load. */
  election?: Election;
  readonly sources?: readonly Source[];
}

/** One list on the ballot of `public/data/elections.json`. */
export interface ElectionParty {
  readonly name: string;
  /** The short, stable name across the years (`ГЕРБ`, `БСП`). */
  readonly alias?: string;
  readonly votes: number;
  readonly percent: number;
  /** Absent for a list that won no seats. */
  readonly mandates?: number;
}

/** A citation in that data: a full URL, or a path on izboren-den's site. */
export interface ElectionSource {
  readonly name: string;
  readonly url: string;
}

/** One parliamentary election: a snapshot of izboren-den's ЦИК-derived data. */
export interface Election {
  readonly date: string;
  /** The ordinal of the assembly it returned: the join key to the bars. */
  readonly assembly: number;
  /** Turnout, per cent. */
  readonly activity: number;
  readonly metrics: { readonly parties: readonly ElectionParty[] };
  readonly sources: readonly ElectionSource[];
}

/** What the tooltip and the detail card read about a bar. */
export interface BarContent {
  /** Row, name and start day: the same person can hold the same office twice. */
  readonly id: string;
  readonly group: string;
  readonly title?: string;
  /** The office-holder; empty for a rest-of-term stripe. */
  readonly name: string;
  readonly description?: string;
  readonly comment?: string;
  readonly sources?: readonly Source[];
  readonly election?: Election;
  readonly from: number;
  readonly to: number;
}

/** One reading of a series as the card states it under the series' name, already in the reader's units. */
export interface CardReading {
  readonly label: string;
  readonly value: string;
  /** Printed at the far end of the row: the date of a reading labelled by its year. */
  readonly note?: string;
}

/** What the detail card prints: a bar or an event, or a series, which has no span of its own. */
export type CardContent = Omit<BarContent, 'from' | 'to'> &
  Partial<Pick<BarContent, 'from' | 'to'>> & {
    readonly reading?: CardReading;
    /** The name of the series' description in `public/data/metrics`. */
    readonly metric?: string;
  };

/** One data item of the gantt series. */
export interface GanttBar {
  readonly content: BarContent;
  readonly name: string;
  /** Read by slot in `renderBar`: lane, from, to, label, ongoing, term, selection. */
  readonly value: (number | string)[];
  readonly itemStyle: { readonly color: string };
}

/** A term of the office itself, whoever holds it. A `null` end has no fixed date. */
export interface GanttTerm {
  readonly value: [string, string | null];
  readonly comment?: string;
  readonly sources?: readonly Source[];
}

/** One row of the chart, split into as many lanes as its bars overlap. */
export interface GanttGroup {
  readonly name: string;
  readonly description?: string;
  readonly items: GanttItem[];
  readonly mandate?: readonly GanttTerm[];
}

/** One period of an event. A `null` end is an event still running. */
export interface EventItem {
  readonly name: string;
  readonly description?: string;
  /** One day, or a span: a `null` end is still going. */
  readonly value: readonly [string] | readonly [string, string | null];
  readonly sources?: readonly Source[];
}

/** One entry of `public/data/events.json`: its bands and lines across both grids. */
export interface TimelineEvent {
  readonly id: string;
  readonly meta: {
    readonly style: { readonly itemStyle: { readonly color: string } };
    /** `false` drops the name written on its bands and lines; the tooltip still carries it. */
    readonly label?: boolean;
  };
  readonly items: readonly EventItem[];
}

/** Where one figure stands in a budget law, so that a reader can find and check it. */
export interface LawCitation {
  /** The act's exact title. */
  readonly title: string;
  /** The figure as the law prints it. */
  readonly amount: number;
  readonly amountUnit: string;
  readonly article: number;
  /** A law's list can have no paragraphs, and then `point` and `letter` place the figure. */
  readonly paragraph?: number;
  readonly point?: number;
  readonly letter?: string;
  /** Set when the figure stands in an annex to the article. */
  readonly annex?: string;
  readonly row: string;
  readonly column: string;
  readonly gazette: {
    readonly citation: string;
    readonly date: string;
    /** The page printed in the gazette, not the page of a PDF; `null` where no copy of the issue shows it. */
    readonly page: number | null;
    /** Where the act starts, given only when `page` is unknown. */
    readonly actPage?: number;
    /** A year can lack either link, never both. */
    readonly actUrl: string | null;
    readonly issueUrl: string | null;
  };
  readonly fileUrl: string;
  /** The page of `fileUrl`. */
  readonly filePage: number;
}

/** One reading of a statistical series. */
export interface ChartPoint {
  readonly date: string;
  readonly value: number;
  readonly change?: number;
  readonly change_percent?: number;
  /** The reading's own citations, for a series whose figures don't share one table. */
  readonly sources?: readonly LawCitation[];
}

/** A level drawn across the line grid, in the series' own unit. */
export interface HorizontalLine {
  readonly value: number;
  readonly color: string;
  readonly width: number;
  /** Solid when left out. */
  readonly type?: 'solid' | 'dashed' | 'dotted';
  /** Printed on the line at all times. */
  readonly label?: string;
}

/** One entry of `public/data/chart-extras.json`: what a series brings along when it is on. */
export interface ChartExtras {
  readonly chartId: string;
  readonly horizontalLines?: readonly HorizontalLine[];
}

/** A dataset behind a series, as `public/data/charts.json` cites it. */
export interface ChartSource {
  readonly name: { readonly en: string; readonly bg: string };
  readonly dataset_id: string;
  readonly url: readonly string[];
}

/** One series of `public/data/charts.json`, as bulfin-bigtime normalises it. */
export interface ChartSeries {
  readonly id: string;
  readonly name: string;
  readonly shortName?: string;
  /** `coefficient` is a published scale such as Gini's 0–100: not a percentage, and drawn on its own axis. */
  readonly unit: 'BGN' | 'EUR' | 'percent' | 'coefficient';
  readonly sources?: readonly ChartSource[];
  /** The dataset's filters; `freq.code` is Eurostat's: `A` annual, `M` monthly. */
  readonly dataset?: { readonly selection?: { readonly freq?: { readonly code: string } } };
  /**
   * `axis` takes a series off the shared axis, where the scales would flatten one line or the
   * other: a large percentage, or an amount per person a month beside billions.
   * `startsOff` keeps a part of a larger total out of the opening view, which would otherwise crowd it.
   * `wholeYear` marks a figure that stands for a calendar year and is dated on its last day, such as a
   * budget or a year's deficit: its line holds flat across the year, as nothing lies between two years.
   * `planOf` makes the series the planned figures of the series with that id, such as a draft budget's
   * deficit beside Eurostat's: it is drawn in that series' colour and switched with it, and has no
   * legend entry of its own.
   */
  readonly meta?: {
    readonly style?: Readonly<Record<string, unknown>>;
    readonly axis?: 'inflation' | 'monthly';
    readonly startsOff?: boolean;
    readonly wholeYear?: boolean;
    readonly planOf?: string;
  };
  readonly data: readonly ChartPoint[];
  /** From `chart-extras.json`, which is kept apart so that regenerating the series leaves it alone. */
  readonly horizontalLines?: readonly HorizontalLine[];
  /** The series whose `meta.planOf` names this one, hung on it at load. */
  readonly plan?: ChartSeries;
}

/* `public/data/budget-periods.json` — when each budget law was actually in
   force. Every law applies from 1 January even when parliament passes it in
   July; until then spending runs on the previous year's framework. */

export interface BudgetPeriodLaw {
  readonly title: string;
  readonly dv: string;
  readonly promulgated?: string;
  readonly url?: string;
  readonly note?: string;
  readonly inForceReference?: string | null;
  /** Whether the „влиза в сила“ clause was read in the law itself. */
  readonly inForceFromVerified?: boolean;
  /** `null` where the PDF is a scan without a usable text layer — never guessed. */
  readonly adopted: string | null;
  readonly assembly?: string | null;
}

export interface BudgetPeriodYear {
  readonly year: number;
  readonly law: BudgetPeriodLaw;
  readonly lateByDays: number;
  /** The stretch of the year before its own law: the extension laws behind it. */
  readonly gap?: { readonly laws: readonly BudgetPeriodLaw[] };
}

/** One segment of a gapless, non-overlapping partition of the whole span. */
export interface BudgetRegime {
  readonly from: string;
  readonly to: string;
  readonly budgetYear: number;
  /** `own` — that year's own law; `carryover` — the previous year's, extended. */
  readonly kind: 'own' | 'carryover';
  /** The ДВ citations of the laws that made this segment. */
  readonly laws: readonly string[];
}

export interface BudgetPeriods {
  readonly budgets: readonly BudgetPeriodYear[];
  readonly regimes: readonly BudgetRegime[];
}
