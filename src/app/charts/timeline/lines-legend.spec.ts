import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { LinesLegend } from './lines-legend';
import { lineColor } from './timeline-lines';
import { ChartSeries } from './timeline.model';

const chart = (id: string, name: string) => ({ id, name }) as ChartSeries;

describe('LinesLegend', () => {
  let fixture: ComponentFixture<LinesLegend>;
  let element: HTMLElement;

  const names = () => [...element.querySelectorAll('.legend-name')].map((name) => name.textContent);
  const rows = () => [...element.querySelectorAll<HTMLElement>('.legend-row')];
  const action = (label: string) => [...element.querySelectorAll<HTMLButtonElement>('.legend-action')].find((button) => button.textContent === label)!;
  const pick = async (...ids: string[]) => {
    fixture.componentRef.setInput('picked', new Set(ids));
    await fixture.whenStable();
  };

  beforeEach(async () => {
    fixture = TestBed.createComponent(LinesLegend);
    fixture.componentRef.setInput('charts', [chart('debt', 'Държавен дълг'), chart('mvr', 'Бюджет на МВР'), chart('courts', 'Бюджет на съдилищата')]);
    fixture.componentRef.setInput('selection', { courts: false });
    element = fixture.nativeElement;
    await fixture.whenStable();
  });

  it('lists every series with nothing picked', () => {
    expect(names().length).toBe(3);
  });

  it('lists only the picked series, in their own order', async () => {
    await pick('courts', 'mvr');
    expect(names()).toEqual(['Бюджет на МВР', 'Бюджет на съдилищата']);
  });

  it('keeps each series in its own colour while the list is narrowed', async () => {
    await pick('courts');
    expect(rows()[0].style.getPropertyValue('--mark')).toBe(lineColor(2));
  });

  it('judges the two switches by the rows on show', async () => {
    await pick('mvr');
    expect(action('всички').disabled).toBe(true);
    expect(action('никоя').disabled).toBe(false);
  });
});
