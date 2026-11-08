import { NgTemplateOutlet } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, TemplateRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { forkJoin } from 'rxjs';

import { CHARTS_URL } from '../charts/timeline/timeline-lines';
import { CURRENCIES, Currency, MAGNITUDES, Magnitude, MoneyView, readStoredMoney, storeMoney } from '../charts/timeline/timeline-money';
import { ChartSeries, TodayData } from '../charts/timeline/timeline.model';
import { NavSlot } from '../navigation/nav-slot';
import {
  TodayRow,
  daysInYear,
  formatAmount,
  perDay,
  readTodayMagnitude,
  sourceHref,
  sourceLabel,
  sourceTitle,
  storeTodayMagnitude,
  toTodayRows,
  todayTotal,
} from './today-table';

const TODAY_URL = 'data/today.json';

/** One row of the table, everything already formatted. */
interface TodayCell {
  readonly name: string;
  readonly abbr?: string;
  readonly daily: string;
  readonly total: string;
  readonly sourceLabel: string;
  readonly sourceHref: string;
  readonly sourceTitle: string;
  readonly parts: readonly TodayCell[];
}

function toCell(row: TodayRow, year: number, money: MoneyView): TodayCell {
  return {
    name: row.name,
    abbr: row.abbr,
    daily: formatAmount(perDay(row.amount, year), money),
    total: formatAmount(row.amount, money),
    sourceLabel: sourceLabel(row),
    sourceHref: sourceHref(row.source),
    sourceTitle: sourceTitle(row.source),
    parts: row.parts.map((part) => toCell(part, year, money)),
  };
}

@Component({
  selector: 'app-today',
  imports: [NgTemplateOutlet],
  templateUrl: './today.html',
  styleUrl: './today.css',
})
export class Today {
  private readonly http = inject(HttpClient);
  private readonly navSlot = inject(NavSlot);

  protected readonly toolbar = viewChild.required<TemplateRef<unknown>>('toolbar');
  protected readonly currencies = CURRENCIES;
  protected readonly magnitudes = MAGNITUDES;

  /* The currency is the reader's across the site. The scale is this page's own. */
  protected readonly money = signal<MoneyView>({ currency: readStoredMoney().currency, magnitude: readTodayMagnitude() });

  private readonly data = signal<{ readonly year: number; readonly rows: readonly TodayRow[] } | null>(null);
  protected readonly error = signal<string | null>(null);

  protected readonly year = computed(() => this.data()?.year ?? null);
  protected readonly days = computed(() => {
    const year = this.year();
    return year === null ? null : daysInYear(year);
  });

  protected readonly cells = computed<readonly TodayCell[]>(() => {
    const data = this.data();
    return data ? data.rows.map((row) => toCell(row, data.year, this.money())) : [];
  });

  protected readonly total = computed(() => {
    const data = this.data();
    if (!data?.rows.length) return null;
    const amount = todayTotal(data.rows);
    return { daily: formatAmount(perDay(amount, data.year), this.money()), total: formatAmount(amount, this.money()) };
  });

  /** The act most rows cite, which the note names once so the rows need not. */
  protected readonly law = computed(() => this.data()?.rows.find((row) => !row.lawShort)?.source ?? null);

  constructor() {
    effect((onCleanup) => {
      this.navSlot.content.set(this.toolbar());
      onCleanup(() => this.navSlot.content.set(null));
    });

    forkJoin({
      today: this.http.get<TodayData>(TODAY_URL),
      charts: this.http.get<ChartSeries[]>(CHARTS_URL),
    }).subscribe({
      next: ({ today, charts }) => this.data.set({ year: today.year, rows: toTodayRows(today, charts) }),
      error: (err) => this.error.set(`Данните не можаха да се заредят (${err?.status ?? 'мрежова грешка'}).`),
    });
  }

  protected setCurrency(currency: Currency): void {
    this.money.update((money) => ({ ...money, currency }));
    /* Read afresh, so the chart keeps its own scale. */
    storeMoney({ ...readStoredMoney(), currency });
  }

  protected setMagnitude(magnitude: Magnitude): void {
    this.money.update((money) => ({ ...money, magnitude }));
    storeTodayMagnitude(magnitude);
  }
}
