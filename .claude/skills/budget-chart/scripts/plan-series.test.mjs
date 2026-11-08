import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { buildPlan, mergePlan } from './plan-series.mjs';

const charts = JSON.parse(readFileSync(new URL('../../../../public/data/charts.json', import.meta.url)));
const parent = { id: 'x-budget-eur', name: 'Бюджет на X', unit: 'EUR', meta: { wholeYear: true }, data: [] };
const doc = { bg: 'Законопроект', en: 'Draft act', code: 'ZDBRB-2027-DRAFT', url: 'https://www.minfin.bg/draft.pdf' };
const at = { bg: 'чл. 12, ал. 1, ред „Разходи“, стр. 7', en: 'Art. 12(1), row Expenditure, p. 7', pages: [7] };
const input = (over = {}) => ({ id: 'budget-plan-x-eur', name: 'Бюджет на X по законопроекта', planOf: parent.id, document: doc, rows: [{ date: '2027-12-31', value: 100, at }], ...over });

test('reproduces every published plan from its own data and sources', () => {
  const plans = charts.filter(({ meta }) => meta?.planOf);
  assert.ok(plans.length > 0);
  for (const published of plans) {
    const [source] = published.sources;
    const [url] = source.url[0].split('#');
    const [docBg, ...placeBg] = source.name.bg.split(/(?<=г\.\)), /);
    const [docEn, ...placeEn] = source.name.en.split(/(?<=\d{4}\)), /);
    const place = { bg: placeBg.join(', '), en: placeEn.join(', '), pages: source.url.map((link) => Number(link.split('#page=')[1])) };
    const plan = buildPlan(
      {
        id: published.id,
        name: published.name,
        planOf: published.meta.planOf,
        document: { bg: docBg, en: docEn, code: source.dataset_id, url },
        rows: published.data.map(({ date, value }) => ({ date, value, at: place })),
      },
      charts
    );

    assert.deepEqual(plan.data, published.data, published.id);
    assert.deepEqual(plan.sources, published.sources, published.id);
    assert.equal(plan.meta.planOf, published.meta.planOf);
  }
});

test('takes the unit of the series it continues and draws dashed', () => {
  const plan = buildPlan(input(), [parent]);

  assert.equal(plan.unit, 'EUR');
  assert.deepEqual(plan.meta, { style: { lineStyle: { type: 'dashed', width: 2 } }, planOf: parent.id });
  assert.deepEqual(plan.sources[0].url, ['https://www.minfin.bg/draft.pdf#page=7']);
});

test('keeps a step style, which the series cannot lend it at load', () => {
  const stepped = { ...parent, meta: { axis: 'monthly', style: { step: 'end' } } };

  assert.equal(buildPlan(input(), [stepped]).meta.style.step, 'end');
});

test('refuses a value without its page', () => {
  assert.throws(() => buildPlan(input({ rows: [{ date: '2027-12-31', value: 1, at: { bg: 'x', en: 'x', pages: [] } }] }), [parent]), /pages/);
});

test('refuses a law citation, which a draft cannot have', () => {
  assert.throws(() => buildPlan(input({ rows: [{ date: '2027-12-31', value: 1, at, sources: [{}] }] }), [parent]), /law citation/);
});

test('refuses a missing series, a plan of a plan and an id that is a series', () => {
  assert.throws(() => buildPlan(input({ planOf: 'nothing' }), [parent]), /no series/);
  assert.throws(() => buildPlan(input({ planOf: 'p' }), [{ ...parent, id: 'p', meta: { planOf: 'x' } }]), /itself a plan/);
  assert.throws(() => buildPlan(input({ id: 'other' }), [parent, { ...parent, id: 'other', meta: {} }]), /series of its own/);
});

test('refuses a second plan for one line, which the chart could not show', () => {
  const first = { ...parent, id: 'budget-plan-first-eur', meta: { planOf: parent.id } };

  assert.throws(() => buildPlan(input(), [parent, first]), /already has a plan/);
  assert.doesNotThrow(() => buildPlan(input({ id: first.id }), [parent, first]));
});

test('refuses a document without a link', () => {
  assert.throws(() => buildPlan(input({ document: { ...doc, url: '' } }), [parent]), /https/);
});

test('replaces a plan in place, and puts a new one after its series', () => {
  const plan = buildPlan(input(), [parent]);
  const other = { id: 'other' };

  assert.deepEqual(mergePlan([parent, other], plan).map(({ id }) => id), [parent.id, plan.id, 'other']);
  assert.deepEqual(mergePlan([parent, other, { ...plan, name: 'old' }], plan).map(({ id, name }) => name ?? id), ['Бюджет на X', plan.name, 'other']);
});
