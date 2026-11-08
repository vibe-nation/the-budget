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

  it('should fall back to the chart on an unknown address', async () => {
    const compiled = await renderAt('/no-such-page');
    expect(compiled.querySelector('.site-header .chart-toolbar')).not.toBeNull();
  });
});
