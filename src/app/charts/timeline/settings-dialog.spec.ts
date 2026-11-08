import { TestBed } from '@angular/core/testing';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { SettingsDialog } from './settings-dialog';
import { LineShape, readStoredLineShape, storeLineShape } from './timeline-lines';

/* jsdom has no <dialog> behaviour of its own. */
beforeAll(() => {
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.open = false;
  };
});

function render(shape: LineShape = 'step') {
  const fixture = TestBed.createComponent(SettingsDialog);
  fixture.componentRef.setInput('lineShape', shape);
  fixture.detectChanges();
  const host: HTMLElement = fixture.nativeElement;
  const dialog = host.querySelector('dialog')!;
  const options = [...host.querySelectorAll<HTMLButtonElement>('.segmented-option')];
  return { fixture, host, dialog, options };
}

describe('SettingsDialog', () => {
  it('opens the dialog from the gear', () => {
    const { host, dialog } = render();

    host.querySelector<HTMLButtonElement>('.settings-trigger')!.click();

    expect(dialog.open).toBe(true);
  });

  it('closes on its ✕ and on the backdrop', () => {
    const { host, dialog } = render();
    host.querySelector<HTMLButtonElement>('.settings-trigger')!.click();
    host.querySelector<HTMLButtonElement>('.settings-close')!.click();
    expect(dialog.open).toBe(false);

    host.querySelector<HTMLButtonElement>('.settings-trigger')!.click();
    dialog.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(dialog.open).toBe(false);
  });

  it('marks the shape in force', () => {
    const { options } = render('line');

    expect(options.map((option) => option.getAttribute('aria-pressed'))).toEqual(['false', 'true']);
  });

  it('asks for the shape picked', () => {
    const { fixture, options } = render('step');
    const picked: LineShape[] = [];
    fixture.componentInstance.lineShapeChange.subscribe((shape) => picked.push(shape));

    options[1].click();

    expect(picked).toEqual(['line']);
  });
});

describe('the stored line shape', () => {
  afterEach(() => localStorage.clear());

  it('opens on steps', () => {
    expect(readStoredLineShape()).toBe('step');
  });

  it('keeps the reader’s choice', () => {
    storeLineShape('line');

    expect(readStoredLineShape()).toBe('line');
  });

  it('falls back to steps on a value it does not know', () => {
    localStorage.setItem('the-budget.lineShape', '"curve"');

    expect(readStoredLineShape()).toBe('step');
  });
});
