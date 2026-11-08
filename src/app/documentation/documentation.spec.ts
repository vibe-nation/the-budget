import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { Documentation } from './documentation';

describe('Documentation', () => {
  it('should point every link in the side list at a section on the page', async () => {
    await TestBed.configureTestingModule({
      imports: [Documentation],
      providers: [provideRouter([])],
    }).compileComponents();
    const fixture = TestBed.createComponent(Documentation);
    await fixture.whenStable();
    const page = fixture.nativeElement as HTMLElement;

    const links = [...page.querySelectorAll<HTMLAnchorElement>('.docs-rail a')];
    expect(links.map((link) => link.getAttribute('href')?.split('#').pop())).toEqual([
      'start',
      'eurostat-extract',
      'describe-metric',
      'budget-chart',
      'verify-mandates',
    ]);
    for (const link of links) {
      const id = link.getAttribute('href')?.split('#').pop();
      expect(page.querySelector(`section[id="${id}"]`), id).not.toBeNull();
    }
  });
});
