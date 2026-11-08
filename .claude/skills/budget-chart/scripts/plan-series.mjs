#!/usr/bin/env node
/**
 * Turns figures a draft prints, such as a draft budget law or the Draft Budgetary
 * Plan, into a plan series of public/data/charts.json: a dashed continuation of
 * the series it names in `planOf`, switched with it and drawn in its colour.
 *
 *   node plan-series.mjs <input.json> [--into public/data/charts.json] [--write]
 *
 * Without --write nothing changes. A draft has no gazette, so its values carry no
 * law citation: the series cites the document, and every value names its page.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { symmetricPercent } from './budget-series.mjs';

const DASHED = { type: 'dashed', width: 2 };

function check(condition, message) {
  if (!condition) throw new Error(message);
}

/** The plan series for `input`, checked against the series of `charts` it continues. */
export function buildPlan(input, charts) {
  const { id, name, planOf, document: doc, rows } = input;
  check(id && name, 'the input needs an id and a name');
  const parent = charts.find((chart) => chart.id === planOf);
  check(parent, `planOf: no series ${planOf}`);
  check(!parent.meta?.planOf, `planOf: ${planOf} is itself a plan`);
  check(id !== planOf, 'a plan needs an id of its own');
  const other = charts.find((chart) => chart.id === id);
  check(!other || other.meta?.planOf, `${id} is a series of its own, not a plan`);
  const rival = charts.find((chart) => chart.meta?.planOf === planOf && chart.id !== id);
  check(!rival, `${planOf} already has a plan, ${rival?.id}; a line takes one`);
  check(doc?.bg && doc?.en && doc?.code && /^https:\/\//.test(doc?.url ?? ''), 'document needs bg, en, code and an https url');
  check(Array.isArray(rows) && rows.length > 0, 'no rows');

  rows.forEach((row, index) => {
    const at = `row ${index + 1} (${row.date})`;
    check(/^\d{4}-\d{2}-\d{2}$/.test(row.date ?? ''), `${at}: date must be YYYY-MM-DD`);
    check(Number.isFinite(row.value), `${at}: value must be a number in the series' unit (${parent.unit})`);
    check(row.at?.bg && row.at?.en, `${at}: at needs bg and en, the place in the document`);
    check(Array.isArray(row.at.pages) && row.at.pages.length > 0 && row.at.pages.every((page) => Number.isInteger(page) && page > 0), `${at}: at.pages must list the PDF pages`);
    check(!row.sources, `${at}: a draft value carries no law citation; place it with at`);
    check(index === 0 || row.date > rows[index - 1].date, `${at}: dates must rise`);
  });

  const places = new Map(rows.map(({ at }) => [at.bg, at]));
  const step = parent.meta?.style?.step;

  return {
    id,
    name,
    sources: [...places.values()].map((at) => ({
      name: { bg: `${doc.bg}, ${at.bg}`, en: `${doc.en}, ${at.en}` },
      dataset_id: doc.code,
      url: at.pages.map((page) => `${doc.url}#page=${page}`),
    })),
    unit: parent.unit,
    /* Axis and whole-year drawing come from the series at load; a step style does not. */
    meta: { style: { ...(step ? { step } : {}), lineStyle: DASHED }, planOf },
    data: rows.map(({ date, value }, index) => {
      const previous = rows[index - 1]?.value;
      return previous === undefined
        ? { date, value, change: 0, change_percent: 0 }
        : { date, value, change: Number((value - previous).toFixed(10)), change_percent: symmetricPercent(previous, value) };
    }),
  };
}

/** `charts` with `plan` in place of a plan of the same id, or right after the series it continues. */
export function mergePlan(charts, plan) {
  const kept = charts.filter(({ id }) => id !== plan.id);
  const at = kept.findIndex(({ id }) => id === plan.meta.planOf);
  return [...kept.slice(0, at + 1), plan, ...kept.slice(at + 1)];
}

function main([file, ...args]) {
  const into = args.includes('--into') ? args[args.indexOf('--into') + 1] : 'public/data/charts.json';
  const charts = JSON.parse(readFileSync(into, 'utf8'));
  const plan = buildPlan(JSON.parse(readFileSync(file, 'utf8')), charts);

  for (const { date, value, change_percent } of plan.data) console.log(date, String(value).padStart(16), plan.unit, `${change_percent}%`.padStart(8));
  for (const { url } of plan.sources) console.log('  ', url.join(' '));
  if (!args.includes('--write')) return console.log(`dry run: ${plan.id} continues ${plan.meta.planOf}, nothing written`);

  writeFileSync(into, `${JSON.stringify(mergePlan(charts, plan), null, 2)}\n`);
  console.log(`wrote ${plan.id} into ${into}; run prettier on it`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
