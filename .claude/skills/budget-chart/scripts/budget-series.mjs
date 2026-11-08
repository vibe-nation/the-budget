#!/usr/bin/env node
/**
 * Turns checked figures from Bulgarian budget laws into one series of
 * public/data/charts.json. It refuses a value a reader couldn't find and check.
 *
 *   node budget-series.mjs <input.json> [--into public/data/charts.json] [--after <id>] [--write]
 *
 * Without --write nothing changes. The input's shape is in the skill's SKILL.md.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ACTS = join(HERE, '..', 'references', 'state-budget-acts.json');
const EUR_TO_BGN = 1.95583;

/** How many euro one printed unit is worth. */
const IN_EUR = { 'лв.': 1 / EUR_TO_BGN, 'хил. лв.': 1_000 / EUR_TO_BGN, 'млн. лв.': 1_000_000 / EUR_TO_BGN, евро: 1, 'хил. евро': 1_000 };

const STATE_BUDGET_SOURCE = {
  name: {
    en: 'State Budget Acts of the Republic of Bulgaria, 2000–2026 (adopted expenditure, State Gazette)',
    bg: 'Закони за държавния бюджет на Република България, 2000–2026 г. (приети разходи, „Държавен вестник“)',
  },
  dataset_id: 'ZDBRB',
  url: ['https://dv.parliament.bg/DVWeb/broeveList.faces', 'https://www.minfin.bg/bg/247'],
};

const round2 = (value) => Math.round(value * 100) / 100;

/* The same measure as the Eurostat series: a plain percentage means nothing across a sign change. */
export const symmetricPercent = (previous, value) => {
  const mean = (Math.abs(previous) + Math.abs(value)) / 2;
  return mean === 0 ? 0 : Number((((value - previous) / mean) * 100).toFixed(2));
};

/* A location may name its own act: an amendment that changes the figure is cited beside the law it amends. */
function citation(where, row, rowAct) {
  const { article, paragraph, point, letter, annex, label, column, page, actPage, filePage, checks, amount = row.amount, unit = row.unit, act = rowAct } = where;
  const at = `${row.date}: ${label ?? 'a source'}`;
  for (const [name, value] of Object.entries({ article, label, column, filePage, checks })) {
    if (value === undefined || value === null || value === '') throw new Error(`${at} has no ${name}`);
  }
  /* „единствен“ is the act's only article, printed „Член единствен“: a decree's usual shape. */
  if (!(Number.isInteger(article) && article > 0) && article !== 'единствен') {
    throw new Error(`${at}: article must be its number, or "единствен" for „Член единствен“`);
  }
  if (paragraph === undefined && point === undefined) throw new Error(`${at} has no paragraph or point`);
  if (page === undefined) throw new Error(`${at} has no page`);
  if (!Number.isInteger(page) && !(page === null && Number.isInteger(actPage))) {
    throw new Error(`${at}: page must be the page printed in the gazette, a number, or null with actPage, where the act starts`);
  }
  if (!IN_EUR[unit]) throw new Error(`${at}: unknown unit ${unit}`);
  if (!act.actUrl && !act.issueUrl) throw new Error(`${row.date}: ${act.title} has no gazette link`);
  if (!checks.file) throw new Error(`${at}: not read in the file`);
  if (!checks.gazetteAct && !checks.gazetteIssue) throw new Error(`${at}: not confirmed in the gazette`);
  const { actUrl, issueUrl, citation: cited, issue, extraordinary, date } = act;
  return {
    title: act.title,
    file: act.file,
    fileUrl: act.fileUrl,
    amount,
    amountUnit: unit,
    gazette: { citation: cited, issue, extraordinary, date, page, ...(page === null ? { actPage } : {}), actUrl, issueUrl },
    ...(annex ? { annex } : {}),
    article,
    ...(paragraph === undefined ? {} : { paragraph }),
    ...(point === undefined ? {} : { point }),
    ...(letter ? { letter } : {}),
    row: label,
    column,
    filePage,
    checks,
  };
}

/** The series for `input`, or an error naming the first value that can't be traced. */
export function buildSeries(input, acts) {
  const { id, name, institution, indicator, source = STATE_BUDGET_SOURCE, meta, dated = false, rows } = input;
  if (!id || !name || !rows?.length) throw new Error('input needs id, name and rows');
  const data = [];
  let previous = null;

  for (const raw of rows) {
    const date = raw.date ?? `${raw.year}-12-31`;
    const row = { ...raw, date };
    if (!IN_EUR[row.unit]) throw new Error(`${date}: unknown unit ${row.unit}`);
    const act = row.act ?? input.acts?.[date] ?? acts[String(row.year ?? date.slice(0, 4))];
    if (!act) throw new Error(`${date}: no act in the catalogue, pass one as "act"`);
    if (!row.sources?.length) throw new Error(`${date} has no sources`);
    if (!dated && previous && Number(date.slice(0, 4)) !== Number(previous.date.slice(0, 4)) + 1) {
      throw new Error(`${date} doesn't follow ${previous.date}: an annual series has no gaps`);
    }
    const value = round2(row.amount * IN_EUR[row.unit]);
    data.push({
      date,
      value,
      change: previous ? round2(value - previous.value) : 0,
      change_percent: previous ? symmetricPercent(previous.value, value) : 0,
      sources: row.sources.map((where) => citation(where, row, act)),
      ...(row.note ? { note: row.note } : {}),
    });
    previous = data.at(-1);
  }

  return {
    id,
    name,
    sources: [source],
    dataset: {
      id: source.dataset_id,
      label: input.datasetLabel ?? { en: 'State Budget Act', bg: 'Закон за държавния бюджет' },
      selection: {
        ...(dated ? {} : { freq: { code: 'A', label: { en: 'Annual', bg: 'Годишно' } } }),
        ...(institution ? { institution } : {}),
        indicator: indicator ?? { code: 'EXPENDITURE', label: { en: 'Adopted expenditure', bg: 'Приети разходи' } },
      },
    },
    unit: 'EUR',
    ...(meta ? { meta } : {}),
    data,
  };
}

/** `charts` with `series` added: after `after` when given, otherwise at the end. */
export function mergeSeries(charts, series, after) {
  if (charts.some(({ id }) => id === series.id)) throw new Error(`${series.id} is already there`);
  const at = after ? charts.findIndex(({ id }) => id === after) : charts.length - 1;
  if (at < 0) throw new Error(`no series ${after}`);
  return [...charts.slice(0, at + 1), series, ...charts.slice(at + 1)];
}

function main([file, ...args]) {
  const option = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
  const into = option('--into') ?? 'public/data/charts.json';
  const series = buildSeries(JSON.parse(readFileSync(file, 'utf8')), JSON.parse(readFileSync(ACTS, 'utf8')));

  for (const { date, value, change_percent, sources } of series.data) {
    const [{ amount, amountUnit, article, paragraph, annex, gazette }] = sources;
    console.log(date, String(amount).padStart(11), amountUnit.padEnd(9), '→', value.toFixed(2).padStart(16), '€', `${change_percent}%`.padStart(8), annex ?? `чл. ${article}`, `стр. ${gazette.page ?? `?(акт ${gazette.actPage})`}`);
  }
  if (!args.includes('--write')) return console.log(`dry run: ${series.id}, ${series.data.length} values, nothing written`);

  const merged = mergeSeries(JSON.parse(readFileSync(into, 'utf8')), series, option('--after'));
  writeFileSync(into, `${JSON.stringify(merged, null, 2)}\n`);
  console.log(`wrote ${series.id} into ${into}; run prettier on it`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
