import { describe, expect, it } from 'vitest';

import { chartsFileUrl, descriptionHtml, metricEditUrl, metricUrl } from './metric-description';

describe('metricUrl', () => {
  it('finds a description by the name of its metric', () => {
    expect(metricUrl('gini-coefficient')).toBe('data/metrics/gini-coefficient.md');
  });
});

describe('metricEditUrl', () => {
  it('opens the file in the editor of the repository', () => {
    expect(metricEditUrl('mvr-budget')).toBe('https://github.com/vibe-nation/the-budget/edit/master/public/data/metrics/mvr-budget.md');
  });
});

describe('chartsFileUrl', () => {
  it('shows the data file in the repository', () => {
    expect(chartsFileUrl).toBe('https://github.com/vibe-nation/the-budget/blob/master/public/data/charts.json');
  });
});

describe('descriptionHtml', () => {
  it('turns Markdown into HTML', () => {
    const html = descriptionHtml('Първи абзац с **важна** дума.\n\n- едно\n- две\n');
    expect(html).toContain('<strong>важна</strong>');
    expect(html).toContain('<li>едно</li>');
  });

  it('is empty when there is no text yet', () => {
    expect(descriptionHtml(undefined)).toBe('');
    expect(descriptionHtml('  \n')).toBe('');
  });

  it('is empty when a server answers a missing file with the page of the app', () => {
    expect(descriptionHtml('<!doctype html>\n<html><body><app-root></app-root></body></html>')).toBe('');
    expect(descriptionHtml('\n<!DOCTYPE html><html></html>')).toBe('');
  });
});
