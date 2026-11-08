import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { LawCitation, TodayData } from '../charts/timeline/timeline.model';
import { NavSlot } from '../navigation/nav-slot';
import { Today } from './today';

const source: LawCitation = {
  title: 'Закон за държавния бюджет на Република България за 2026 г.',
  amount: 365,
  amountUnit: 'хил. евро',
  article: 12,
  paragraph: 1,
  row: 'II. РАЗХОДИ',
  column: 'Сума',
  gazette: {
    citation: 'ДВ, бр. 69 от 31.07.2026 г.',
    date: '2026-07-31',
    page: 14,
    actUrl: 'https://dv.example/act',
    issueUrl: null,
  },
  fileUrl: 'https://minfin.example/law.pdf',
  filePage: 14,
};

const data: TodayData = {
  year: 2026,
  entries: [{ name: 'Министерство на вътрешните работи', abbr: 'МВР', value: 365_000, sources: [source] }],
};

const text = (element: Element | null | undefined) => (element?.textContent ?? '').replace(/\s+/g, ' ').trim();

describe('Today', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [Today],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  async function open(): Promise<HTMLElement> {
    const fixture = TestBed.createComponent(Today);
    await fixture.whenStable();
    http.expectOne('data/today.json').flush(data);
    http.expectOne('data/charts.json').flush([]);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows the year total and the daily amount with the source linked to its page', async () => {
    const page = await open();

    expect(text(page.querySelector('h1'))).toBe('Бюджетът през 2026 г.');
    const cells = [...page.querySelectorAll('tbody tr:first-child > *')].map(text);
    expect(cells).toEqual(['Министерство на вътрешните работи МВР', '1 000 €', '365 000 €', 'чл. 12, ал. 1 · стр. 14']);
    expect(page.querySelector('tbody a')?.getAttribute('href')).toBe('https://minfin.example/law.pdf#page=14');
  });

  it('names the law once, in the note under the table', async () => {
    const page = await open();

    expect(text(page.querySelector('.today-note'))).toContain(
      'Закон за държавния бюджет на Република България за 2026 г., ДВ, бр. 69 от 31.07.2026 г. Страниците',
    );
  });

  it('marks the source link as leading off the site', async () => {
    const page = await open();

    expect(page.querySelector('.today-source a svg')?.getAttribute('aria-hidden')).toBe('true');
  });

  function toolbar(): HTMLElement {
    const view = TestBed.inject(NavSlot).content()!.createEmbeddedView({});
    view.detectChanges();
    return view.rootNodes.find((node) => node instanceof HTMLElement) as HTMLElement;
  }

  it('offers the same scales as the chart', async () => {
    await open();

    const groups = [...toolbar().querySelectorAll('[aria-label="Мерна единица"] button')].map(text);
    expect(groups).toEqual(['млрд', 'млн', 'хил', 'единици']);
  });

  it('rescales the amounts and leaves the scale of the chart alone', async () => {
    const page = await open();

    const button = [...toolbar().querySelectorAll('button')].find((candidate) => text(candidate) === 'хил');
    button?.click();
    await TestBed.inject(ApplicationRef).whenStable();

    const cells = [...page.querySelectorAll('tbody tr:first-child > td')].map(text);
    expect(cells.slice(0, 2)).toEqual(['1,00 хил. €', '365,00 хил. €']);
    expect(localStorage.getItem('the-budget.money')).toBeNull();
  });

  it('closes the table with the total for the year and per day', async () => {
    const page = await open();

    const cells = [...page.querySelectorAll('tfoot tr > *')].map(text);
    expect(cells).toEqual(['Общо за показаните институции', '1 000 €', '365 000 €', '']);
  });

  it('says that the total is not the whole state budget', async () => {
    const page = await open();

    expect(text(page.querySelector('.today-note'))).toContain('„Общо“ е сборът на институциите в таблицата, а не целият държавен бюджет.');
  });

  it('says that money added during the year is not in the figures', async () => {
    const page = await open();

    expect(text(page.querySelector('.today-note'))).toContain(
      'Допълнителните средства, отпуснати през годината с постановления на Министерския съвет, не са включени.',
    );
  });

  it('puts the currency switch in the header and clears it on leaving', async () => {
    const fixture = TestBed.createComponent(Today);
    await fixture.whenStable();
    http.expectOne('data/today.json').flush(data);
    http.expectOne('data/charts.json').flush([]);
    await fixture.whenStable();
    const slot = TestBed.inject(NavSlot);

    expect(slot.content()).not.toBeNull();
    fixture.destroy();
    await fixture.whenStable();
    expect(slot.content()).toBeNull();
  });

  it('reports a failed load instead of an empty table', async () => {
    const fixture = TestBed.createComponent(Today);
    await fixture.whenStable();
    http.expectOne('data/today.json').flush('', { status: 404, statusText: 'Not Found' });
    http.expectOne('data/charts.json');
    await fixture.whenStable();
    const page = fixture.nativeElement as HTMLElement;

    expect(text(page.querySelector('[role="alert"]'))).toContain('404');
    expect(page.querySelector('table')).toBeNull();
  });
});
