import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LegendSearch, MAX_RECENT_SERIES, isListed, matchesQuery, readStoredRecent, withRecent } from './legend-search';
import { ChartSeries } from './timeline.model';

const STORAGE_KEY = 'the-budget.recentSeries';

describe('matchesQuery', () => {
  it('matches a part of the name in either case', () => {
    expect(matchesQuery('Бюджет на МВР', 'мвр')).toBe(true);
    expect(matchesQuery('Бюджет на МВР', 'БЮДЖ')).toBe(true);
    expect(matchesQuery('Бюджет на МВР', 'дълг')).toBe(false);
  });

  it('wants every word, in any order', () => {
    expect(matchesQuery('Бюджет на съдебната власт', 'власт бюджет')).toBe(true);
    expect(matchesQuery('Бюджет на съдебната власт', 'власт дълг')).toBe(false);
  });

  it('lets every name through when there is nothing to look for', () => {
    expect(matchesQuery('Държавен дълг', '')).toBe(true);
    expect(matchesQuery('Държавен дълг', '   ')).toBe(true);
  });
});

describe('isListed', () => {
  it('lists every series until one is picked, then only the picks', () => {
    expect(isListed(new Set(), 'mvr')).toBe(true);
    expect(isListed(new Set(['mvr']), 'mvr')).toBe(true);
    expect(isListed(new Set(['mvr']), 'debt')).toBe(false);
  });
});

describe('withRecent', () => {
  it('puts the newest first', () => {
    expect(withRecent(['debt'], 'mvr')).toEqual(['mvr', 'debt']);
  });

  it('moves a repeated pick to the front instead of doubling it', () => {
    expect(withRecent(['debt', 'mvr'], 'mvr')).toEqual(['mvr', 'debt']);
  });

  it('forgets the oldest past the limit', () => {
    const full = Array.from({ length: MAX_RECENT_SERIES }, (_, index) => `s${index}`);
    const next = withRecent(full, 'new');
    expect(next.length).toBe(MAX_RECENT_SERIES);
    expect(next[0]).toBe('new');
    expect(next).not.toContain(full.at(-1));
  });
});

describe('readStoredRecent', () => {
  afterEach(() => localStorage.clear());

  it('holds nothing until something is remembered', () => {
    expect(readStoredRecent()).toEqual([]);
  });

  it('survives what it cannot read', () => {
    localStorage.setItem(STORAGE_KEY, '{');
    expect(readStoredRecent()).toEqual([]);
  });

  it('keeps to the limit however much was stored', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from({ length: 9 }, (_, index) => `s${index}`)));
    expect(readStoredRecent().length).toBe(MAX_RECENT_SERIES);
  });
});

describe('LegendSearch', () => {
  const charts = [
    { id: 'debt', name: 'Държавен дълг' },
    { id: 'mvr', name: 'Бюджет на МВР' },
    { id: 'courts', name: 'Бюджет на съдилищата' },
  ] as ChartSeries[];

  let fixture: ComponentFixture<LegendSearch>;
  let element: HTMLElement;

  const field = () => element.querySelector<HTMLInputElement>('input')!;
  const options = () => [...element.querySelectorAll<HTMLButtonElement>('[role=option]')];
  const names = () => options().map((option) => option.querySelector('.search-option-name')?.textContent?.trim());
  const list = () => element.querySelector('[role=listbox]');
  const head = () => element.querySelector('.search-list-head');
  const forget = () => element.querySelector<HTMLButtonElement>('.search-list-forget')!;
  const clearButton = () => element.querySelector<HTMLButtonElement>('.search-clear');
  const count = () => element.querySelector('.search-count')?.textContent?.trim();
  const picked = () => [...fixture.componentInstance.picked()];
  const settle = () => fixture.whenStable();

  const open = async () => {
    field().focus();
    await settle();
  };
  const type = async (text: string) => {
    field().value = text;
    field().dispatchEvent(new Event('input'));
    await settle();
  };
  const press = async (key: string) => {
    field().dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    await settle();
  };
  const pick = async (index: number) => {
    options()[index].click();
    await settle();
  };

  const create = async () => {
    element?.remove();
    fixture = TestBed.createComponent(LegendSearch);
    fixture.componentRef.setInput('charts', charts);
    fixture.componentRef.setInput('picked', new Set());
    element = fixture.nativeElement;
    document.body.appendChild(element);
    await settle();
  };

  beforeEach(async () => {
    Element.prototype.scrollIntoView = vi.fn();
    await create();
  });
  afterEach(() => {
    element.remove();
    localStorage.clear();
  });

  it('stays shut until the field takes focus, then lists every series', async () => {
    expect(list()).toBeNull();
    expect(field().getAttribute('aria-expanded')).toBe('false');
    await open();
    expect(names()).toEqual(['Държавен дълг', 'Бюджет на МВР', 'Бюджет на съдилищата']);
    expect(field().getAttribute('aria-expanded')).toBe('true');
  });

  it('narrows the list as text is typed, without picking anything', async () => {
    await open();
    await type('бюджет');
    expect(names()).toEqual(['Бюджет на МВР', 'Бюджет на съдилищата']);
    expect(picked()).toEqual([]);
  });

  it('picks a series and stays open on the same rows, text and all', async () => {
    await open();
    await type('бюджет');
    await pick(0);
    expect(picked()).toEqual(['mvr']);
    expect(list()).not.toBeNull();
    expect(field().value).toBe('бюджет');
    expect(names()).toEqual(['Бюджет на МВР', 'Бюджет на съдилищата']);
  });

  it('takes several picks in one go', async () => {
    await open();
    await pick(0);
    await pick(1);
    expect(picked()).toEqual(['debt', 'mvr']);
  });

  it('marks what is picked and takes it back from the same row', async () => {
    await open();
    await pick(1);
    expect(options()[1].getAttribute('aria-selected')).toBe('true');
    await pick(1);
    expect(picked()).toEqual([]);
  });

  it('holds every row where it is while the list is open, so the next click lands', async () => {
    await open();
    await pick(2);
    expect(head()).toBeNull();
    expect(names()).toEqual(['Държавен дълг', 'Бюджет на МВР', 'Бюджет на съдилищата']);
  });

  it('brings a pick up among the recent ones the next time the list opens', async () => {
    await open();
    await pick(2);
    await press('Escape');
    field().click();
    await settle();
    expect(head()).not.toBeNull();
    expect(names()[0]).toBe('Бюджет на съдилищата');
  });

  it('leads with the recent picks, across a reload, each series listed once', async () => {
    await open();
    await pick(1);
    await create();
    await open();

    expect(head()?.textContent).toContain('Последни търсения');
    expect(names()).toEqual(['Бюджет на МВР', 'Държавен дълг', 'Бюджет на съдилищата']);
  });

  it('does not remember a pick that was taken back', async () => {
    fixture.componentRef.setInput('picked', new Set(['mvr']));
    await open();
    await pick(1);
    expect(readStoredRecent()).toEqual([]);
  });

  it('puts the recent picks away while text is typed', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(['courts']));
    await create();
    await open();
    await type('бюджет');
    expect(head()).toBeNull();
    expect(names()).toEqual(['Бюджет на МВР', 'Бюджет на съдилищата']);
  });

  it('skips a remembered series that is no longer on the chart', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(['gone', 'courts']));
    await create();
    await open();
    expect(names()[0]).toBe('Бюджет на съдилищата');
    expect(names().length).toBe(3);
  });

  it('forgets the recent picks and stays open', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(['mvr']));
    await create();
    await open();
    forget().click();
    await settle();

    expect(head()).toBeNull();
    expect(names().length).toBe(3);
    expect(readStoredRecent()).toEqual([]);
    expect(document.activeElement).toBe(field());
  });

  it('walks the list with the arrows, wrapping at its ends', async () => {
    await open();
    await press('ArrowDown');
    expect(field().getAttribute('aria-activedescendant')).toBe(options()[0].id);
    await press('ArrowUp');
    expect(field().getAttribute('aria-activedescendant')).toBe(options()[2].id);
    expect(options()[2].classList.contains('is-active')).toBe(true);
  });

  it('brings the active row into view when the arrows reach past the fold', async () => {
    await open();
    await press('ArrowUp');
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledOnce();
  });

  it('opens from the keyboard after Escape shut the list', async () => {
    await open();
    await press('Escape');
    expect(list()).toBeNull();
    await press('ArrowDown');
    expect(list()).not.toBeNull();
  });

  it('picks the active row on Enter', async () => {
    await open();
    await press('ArrowDown');
    await press('ArrowDown');
    await press('Enter');
    expect(picked()).toEqual(['mvr']);
    expect(list()).not.toBeNull();
    await press('ArrowDown');
    await press('Enter');
    expect(picked()).toEqual(['mvr', 'courts']);
  });

  it('picks on Enter when the text leaves one row, and not when it leaves several', async () => {
    await open();
    await type('бюджет');
    await press('Enter');
    expect(picked()).toEqual([]);
    await type('мвр');
    await press('Enter');
    expect(picked()).toEqual(['mvr']);
  });

  it('says so in the field when the text finds nothing, with the list shut', async () => {
    await open();
    await type('няма такова');
    expect(list()).toBeNull();
    expect(count()).toBe('няма');
  });

  it('counts the matches while typing and the picks once the text is gone', async () => {
    expect(count()).toBeUndefined();
    await open();
    await type('бюджет');
    expect(count()).toBe('2');
    await pick(0);
    await type('');
    expect(count()).toBe('1 от 3');
  });

  it('clears the text and the picks from its button, keeping the focus', async () => {
    expect(clearButton()).toBeNull();
    await open();
    await pick(0);
    clearButton()!.click();
    await settle();

    expect(picked()).toEqual([]);
    expect(clearButton()).toBeNull();
    expect(document.activeElement).toBe(field());
  });

  it('spends Escape on the list, then the text, and only then lets the chart have it', async () => {
    const reached = vi.fn();
    document.addEventListener('keydown', reached);
    await open();
    await type('мвр');

    await press('Escape');
    expect(list()).toBeNull();
    expect(field().value).toBe('мвр');

    await press('Escape');
    expect(field().value).toBe('');
    expect(reached).not.toHaveBeenCalled();

    await press('Escape');
    expect(reached).toHaveBeenCalledOnce();
    document.removeEventListener('keydown', reached);
  });

  it('shuts on a press outside it', async () => {
    await open();
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    await settle();
    expect(list()).toBeNull();
  });

  it('shuts when the focus moves on from it', async () => {
    await open();
    field().dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: document.body }));
    await settle();
    expect(list()).toBeNull();
  });
});
