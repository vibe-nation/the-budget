import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { App } from './app';
import { routes } from './app.routes';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter(routes), provideHttpClient()],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the brand in the header', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.site-brand-name')?.textContent).toContain('Бюджетът');
  });

  it('should link the repository from the header corner, named in Bulgarian', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const corner = (fixture.nativeElement as HTMLElement).querySelector<HTMLAnchorElement>(
      '.site-header a.github-corner',
    );
    expect(corner?.href).toBe('https://github.com/vibe-nation/the-budget');
    expect(corner?.getAttribute('aria-label')).toContain('GitHub');
  });

  async function renderAt(url: string): Promise<HTMLElement> {
    const fixture = TestBed.createComponent(App);
    await TestBed.inject(Router).navigateByUrl(url);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('should render the chart toolbar in the header, not over the chart', async () => {
    const compiled = await renderAt('/');
    expect(compiled.querySelector('.site-header .chart-toolbar')).not.toBeNull();
    expect(compiled.querySelector('.stage .chart-toolbar')).toBeNull();
  });

  it('should show the documentation in place of the chart and its toolbar', async () => {
    const compiled = await renderAt('/documentation');
    expect(compiled.querySelector('main h1')?.textContent).toContain('Документация');
    expect(compiled.querySelector('.stage')).toBeNull();
    expect(compiled.querySelector('.site-header .chart-toolbar')).toBeNull();
  });

  it('should link the current year from the header', async () => {
    const compiled = await renderAt('/documentation');
    const link = compiled.querySelector<HTMLAnchorElement>('.site-header a[href$="/today"]');
    expect(link?.textContent).toContain('Днес');
  });

  it('should show the current year in place of the chart and its toolbar', async () => {
    const compiled = await renderAt('/today');
    expect(compiled.querySelector('.today')).not.toBeNull();
    expect(compiled.querySelector('.stage')).toBeNull();
    expect(compiled.querySelector('.site-header .chart-toolbar')).toBeNull();
  });

  it('should fall back to the chart on an unknown address', async () => {
    const compiled = await renderAt('/no-such-page');
    expect(compiled.querySelector('.site-header .chart-toolbar')).not.toBeNull();
  });
});
