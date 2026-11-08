import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EventsMenu } from './events-menu';

describe('EventsMenu', () => {
  let fixture: ComponentFixture<EventsMenu>;
  let element: HTMLElement;

  const trigger = () => element.querySelector<HTMLButtonElement>('.events-trigger')!;
  const items = () => element.querySelectorAll<HTMLInputElement>('input[type=checkbox]');
  const settle = () => fixture.whenStable();

  beforeEach(async () => {
    fixture = TestBed.createComponent(EventsMenu);
    fixture.componentRef.setInput('toggles', [
      { id: 'covid', label: 'COVID-19', color: 'grey', shown: true },
      { id: 'war', label: 'Война', color: 'red', shown: false },
    ]);
    element = fixture.nativeElement;
    document.body.appendChild(element);
    await settle();
  });

  it('counts the shown events and starts closed', () => {
    expect(trigger().textContent).toContain('1/2');
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
    expect(items().length).toBe(0);
  });

  it('reports a tick and stays open for the next one', async () => {
    const toggled = vi.fn();
    fixture.componentInstance.toggled.subscribe(toggled);
    trigger().click();
    await settle();

    expect([...items()].map((item) => item.checked)).toEqual([true, false]);
    items()[1].click();
    await settle();

    expect(toggled).toHaveBeenCalledWith('war');
    expect(items().length).toBe(2);
  });

  it('closes on a click outside it and on Escape', async () => {
    trigger().click();
    await settle();
    document.body.click();
    await settle();
    expect(items().length).toBe(0);

    trigger().click();
    await settle();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await settle();
    expect(items().length).toBe(0);
  });
});
