import { Component, ElementRef, computed, inject, input, model, signal } from '@angular/core';

import { readNames, storeNames } from './role-order';
import { lineColor } from './timeline-lines';
import { ChartSeries } from './timeline.model';

const RECENT_STORAGE_KEY = 'the-budget.recentSeries';
export const MAX_RECENT_SERIES = 5;

const tidied = (text: string): string => text.trim().replace(/\s+/g, ' ');
const folded = (text: string): string => tidied(text).toLocaleLowerCase('bg');

/** Whether a name holds every word of the query, in any order. */
export function matchesQuery(name: string, query: string): boolean {
  const haystack = folded(name);
  return folded(query)
    .split(' ')
    .every((word) => haystack.includes(word));
}

/** Whether the legend lists a series: all of them until one is picked, then the picks. */
export const isListed = (picked: ReadonlySet<string>, id: string): boolean => !picked.size || picked.has(id);

/** The recent picks with this one first, and once. */
export const withRecent = (recent: readonly string[], id: string): readonly string[] =>
  [id, ...recent.filter((other) => other !== id)].slice(0, MAX_RECENT_SERIES);

export const readStoredRecent = (): readonly string[] => (readNames(RECENT_STORAGE_KEY) ?? []).slice(0, MAX_RECENT_SERIES);

/** One row of the dropdown: a series, by name. */
interface SearchOption {
  readonly id: string;
  readonly name: string;
  readonly color: string;
  readonly picked: boolean;
  readonly recent: boolean;
}

/* The toolbar's field for narrowing the legend to some of its series: the text
   narrows the dropdown, and a row picked from it narrows the legend and the chart
   to the picks (the others are drawn off until the picks are cleared). A pick leaves
   the list open with its text, so several can be made in one go, and the same row
   takes one back. While the text is empty the recent picks lead the list.
   `TimelineChart` owns the picks; what is typed and the recent picks are this
   field's own.

   The rows hold still while the list is open, for the next click to land where the
   reader aims it: a pick is remembered at once, but joins the recent ones on show
   when the list next opens. Focus stays in the text throughout: the list's
   `mousedown` keeps it there, and the active row is named by
   `aria-activedescendant`. */
@Component({
  selector: 'app-legend-search',
  templateUrl: './legend-search.html',
  styleUrl: './legend-search.css',
  host: {
    role: 'search',
    '[class.is-miss]': 'miss()',
    '(document:pointerdown)': 'onDocumentPointerDown($event)',
    '(focusout)': 'onFocusOut($event)',
  },
})
export class LegendSearch {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly charts = input.required<readonly ChartSeries[]>();
  /** The ids of the series the legend is narrowed to; none means all of them. */
  readonly picked = model.required<ReadonlySet<string>>();

  protected readonly text = signal('');
  protected readonly open = signal(false);
  /** Index into `options()`; -1 for none. */
  protected readonly active = signal(-1);
  private readonly recent = signal(readStoredRecent());
  /** The recent picks as the list has them, behind `recent` while it is open. */
  private readonly listedRecent = signal(this.recent());

  private readonly searching = computed(() => tidied(this.text()) !== '');

  protected readonly options = computed<readonly SearchOption[]>(() => {
    const picked = this.picked();
    const rows = this.charts().map((chart, index) => ({
      id: chart.id,
      name: chart.name,
      color: lineColor(index),
      picked: picked.has(chart.id),
      recent: false,
    }));
    if (this.searching()) return rows.filter((row) => matchesQuery(row.name, this.text()));
    const recent = this.listedRecent().flatMap((id) => rows.find((row) => row.id === id) ?? []);
    return [...recent.map((row) => ({ ...row, recent: true })), ...rows.filter((row) => !recent.includes(row))];
  });
  /** How many recent picks lead the list: the index of the first other row. */
  protected readonly recentCount = computed(() => this.options().filter((option) => option.recent).length);

  /* A list with nothing in it isn't drawn: the field's count speaks alone. */
  protected readonly shown = computed(() => this.open() && this.options().length > 0);
  protected readonly miss = computed(() => this.searching() && !this.options().length);
  protected readonly clearable = computed(() => !!this.text() || this.picked().size > 0);
  protected readonly count = computed(() => {
    if (this.miss()) return 'няма';
    if (this.searching()) return `${this.options().length}`;
    return this.picked().size ? `${this.picked().size} от ${this.charts().length}` : null;
  });

  protected openList(): void {
    this.open.set(true);
  }

  protected onInput(event: Event): void {
    this.text.set((event.target as HTMLInputElement).value);
    this.open.set(true);
    this.active.set(-1);
  }

  protected pick(id: string): void {
    const picks = new Set(this.picked());
    if (!picks.delete(id)) {
      picks.add(id);
      this.setRecent(withRecent(this.recent(), id));
    }
    this.picked.set(picks);
  }

  protected clear(): void {
    this.text.set('');
    this.picked.set(new Set());
    this.active.set(-1);
  }

  protected forgetRecent(): void {
    this.setRecent([]);
    this.listedRecent.set([]);
    this.active.set(-1);
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      this.step(event.key === 'ArrowDown' ? 1 : -1);
    } else if (event.key === 'Enter') {
      const options = this.options();
      /* With text that leaves one row, that row is what Enter means. */
      const target = options[this.active()] ?? (this.searching() && options.length === 1 ? options[0] : null);
      if (target) this.pick(target.id);
    } else if (event.key === 'Escape') {
      this.dismiss(event);
    }
  }

  /* One Escape, one dismissal: the list, then the text. With neither left it goes
     on to the chart, whose Escape shuts its card and panel. */
  private dismiss(event: Event): void {
    if (this.shown()) this.close();
    else if (this.text()) this.text.set('');
    else return;
    event.stopPropagation();
  }

  /* From nothing active, down enters at the top and up at the bottom. */
  private step(delta: 1 | -1): void {
    const count = this.options().length;
    if (!count) return;
    this.open.set(true);
    const from = this.active();
    const next = from === -1 ? (delta === 1 ? 0 : count - 1) : (from + delta + count) % count;
    this.active.set(next);
    this.host.nativeElement.querySelectorAll('[role=option]')[next]?.scrollIntoView({ block: 'nearest' });
  }

  protected onDocumentPointerDown(event: Event): void {
    if (!this.host.nativeElement.contains(event.target as Node)) this.close();
  }

  /* Tabbing on; a window losing focus has nowhere to go and keeps the list open. */
  protected onFocusOut(event: FocusEvent): void {
    const next = event.relatedTarget as Node | null;
    if (next && !this.host.nativeElement.contains(next)) this.close();
  }

  private close(): void {
    this.open.set(false);
    this.active.set(-1);
    this.listedRecent.set(this.recent());
  }

  private setRecent(recent: readonly string[]): void {
    this.recent.set(recent);
    storeNames(RECENT_STORAGE_KEY, recent);
  }
}
