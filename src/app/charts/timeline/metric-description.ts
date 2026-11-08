import { Component, ViewEncapsulation, input } from '@angular/core';
import { marked } from 'marked';

import { CHARTS_URL } from './timeline-lines';

/** Where the description of a metric is served from. */
export const metricUrl = (metric: string) => `data/metrics/${metric}.md`;

const REPOSITORY = 'https://github.com/vibe-nation/the-budget';

/** The data of every series, at its place in the repository. */
export const chartsFileUrl = `${REPOSITORY}/blob/master/public/${CHARTS_URL}`;

/** The file in GitHub's editor, which asks a reader without access to propose the change. */
export const metricEditUrl = (metric: string) => `${REPOSITORY}/edit/master/public/${metricUrl(metric)}`;

/* A host that serves the app for every unknown path answers a missing file with
   200 and index.html, which must not reach the card as a description. */
const isHtmlPage = (text: string) => /^\s*<!doctype html/i.test(text);

/** The description as HTML, or nothing to show. */
export function descriptionHtml(markdown: string | undefined): string {
  if (!markdown?.trim() || isHtmlPage(markdown)) return '';
  return marked.parse(markdown, { async: false });
}

/* The rendered tags come from outside this template, so the styles can't be scoped
   to it. The `[innerHTML]` binding is what sanitises the output: marked does not. */
@Component({
  selector: 'app-metric-description',
  template: '',
  styleUrl: './metric-description.css',
  encapsulation: ViewEncapsulation.None,
  host: { class: 'metric-description', '[innerHTML]': 'html()' },
})
export class MetricDescription {
  readonly html = input.required<string>();
}
