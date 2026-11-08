import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { buildSeries, mergeSeries, updateSeries } from './budget-series.mjs';

const acts = JSON.parse(readFileSync(new URL('../references/state-budget-acts.json', import.meta.url)));
const charts = JSON.parse(readFileSync(new URL('../../../../public/data/charts.json', import.meta.url)));

const where = { article: 2, paragraph: 1, label: 'II. РАЗХОДИ', column: 'Сума', page: 12, filePage: 5, checks: { file: true, gazetteAct: true, gazetteIssue: false } };
const input = (rows) => ({ id: 'x-budget-eur', name: 'Бюджет на X', rows });
const row = (over = {}) => ({ year: 2014, amount: 434000, unit: 'хил. лв.', sources: [where], ...over });

test('reproduces the published series for the judiciary', () => {
  const published = charts.find(({ id }) => id === 'judiciary-budget-eur');
  const rows = published.data.map(({ date, sources }) => ({
    year: Number(date.slice(0, 4)),
    amount: sources[0].amount,
    unit: sources[0].amountUnit,
    sources: [{ ...where, page: sources[0].gazette.page, filePage: sources[0].filePage }],
  }));

  const { data } = buildSeries(input(rows), acts);

  assert.deepEqual(data.map(({ value }) => value), published.data.map(({ value }) => value));
  assert.deepEqual(data.map(({ change_percent }) => change_percent), published.data.map(({ change_percent }) => change_percent));
});

test('states a euro year as printed and a leva year at the fixed rate', () => {
  const { data } = buildSeries(input([row({ year: 2025, amount: 1000 }), row({ year: 2026, amount: 1000, unit: 'хил. евро' })]), acts);

  assert.equal(data[0].value, 511291.88);
  assert.equal(data[1].value, 1000000);
});

test('carries the act from the catalogue onto every value', () => {
  const [{ sources }] = buildSeries(input([row()]), acts).data;

  assert.equal(sources[0].title, 'Закон за държавния бюджет на Република България за 2014 г.');
  assert.equal(sources[0].gazette.citation, 'ДВ, бр. 109 от 20.12.2013 г.');
  assert.match(sources[0].gazette.actUrl, /idMat=81175/);
});

test('keeps a location its own amount, for a rounded second table', () => {
  const rounded = { ...where, paragraph: 2, label: 'Всичко', amount: 121.9, unit: 'млн. лв.' };
  const [{ sources }] = buildSeries(input([row({ year: 2002, amount: 121873.7, sources: [where, rounded] })]), acts).data;

  assert.deepEqual([sources[0].amount, sources[1].amount, sources[1].amountUnit], [121873.7, 121.9, 'млн. лв.']);
});

test('cites a location in its own act, for an amendment that changes the figure', () => {
  const amendment = { title: 'Закон за изменение на Закона за бюджета на X за 2014 г.', citation: 'ДВ, бр. 67 от 12.08.2014 г.', issue: 67, date: '2014-08-12', actUrl: 'https://dv.parliament.bg/DVWeb/showMaterialDV.jsp?idMat=1', issueUrl: null };
  const amended = { ...where, act: amendment };
  const adopted = { ...where, amount: 400000 };
  const [{ value, sources }] = buildSeries(input([row({ sources: [amended, adopted] })]), acts).data;

  assert.equal(value, 221900676.44);
  assert.deepEqual([sources[0].title, sources[0].gazette.citation, sources[0].amount], [amendment.title, amendment.citation, 434000]);
  assert.deepEqual([sources[1].title, sources[1].amount], ['Закон за държавния бюджет на Република България за 2014 г.', 400000]);
  assert.throws(() => buildSeries(input([row({ sources: [{ ...amended, act: { ...amendment, actUrl: null } }] })]), acts), /no gazette link/);
});

for (const missing of ['article', 'label', 'column', 'page', 'filePage', 'checks']) {
  test(`refuses a value with no ${missing}`, () => {
    const { [missing]: _, ...rest } = where;
    assert.throws(() => buildSeries(input([row({ sources: [rest] })]), acts), new RegExp(`no ${missing}`));
  });
}

test('keeps a comment on the value it explains', () => {
  const { data } = buildSeries(input([row({ comment: 'изменена сума' }), row({ year: 2015 })]), acts);

  assert.equal(data[0].comment, 'изменена сума');
  assert.equal('comment' in data[1], false);
});

test('takes „Член единствен“ as the article, and refuses any other word', () => {
  const [{ sources }] = buildSeries(input([row({ sources: [{ ...where, article: 'единствен' }] })]), acts).data;

  assert.equal(sources[0].article, 'единствен');
  assert.throws(() => buildSeries(input([row({ sources: [{ ...where, article: 'първи' }] })]), acts), /article must be/);
  assert.throws(() => buildSeries(input([row({ sources: [{ ...where, article: '12' }] })]), acts), /article must be/);
});

test('refuses a location with neither a paragraph nor a point, and takes a point alone', () => {
  const { paragraph: _, ...rest } = where;

  assert.throws(() => buildSeries(input([row({ sources: [rest] })]), acts), /no paragraph or point/);
  const [{ sources }] = buildSeries(input([row({ sources: [{ ...rest, point: 2, letter: 'г' }] })]), acts).data;
  assert.deepEqual([sources[0].point, sources[0].letter], [2, 'г']);
});

test('takes an unknown printed page only with the page where the act starts', () => {
  assert.throws(() => buildSeries(input([row({ sources: [{ ...where, page: null }] })]), acts), /actPage/);
  const [{ sources }] = buildSeries(input([row({ sources: [{ ...where, page: null, actPage: 79 }] })]), acts).data;
  assert.deepEqual([sources[0].gazette.page, sources[0].gazette.actPage], [null, 79]);
});

test('refuses a page that is not the printed one', () => {
  assert.throws(() => buildSeries(input([row({ sources: [{ ...where, page: '19' }] })]), acts), /printed in the gazette/);
});

test('refuses a value not confirmed in the gazette', () => {
  const checks = { file: true, gazetteAct: false, gazetteIssue: false };
  assert.throws(() => buildSeries(input([row({ sources: [{ ...where, checks }] })]), acts), /not confirmed/);
});

test('refuses an act with no gazette link', () => {
  const act = { ...acts[2014], actUrl: null, issueUrl: null };
  assert.throws(() => buildSeries(input([row({ act })]), acts), /no gazette link/);
});

test('refuses a year missing from an annual series, and allows it where dates are the point', () => {
  const rows = [row({ year: 2012 }), row({ year: 2014 })];

  assert.throws(() => buildSeries(input(rows), acts), /no gaps/);
  assert.equal(buildSeries({ ...input(rows), dated: true }, acts).data.length, 2);
});

test('takes a new id only, after the named series', () => {
  const list = [{ id: 'a' }, { id: 'b' }];

  assert.deepEqual(mergeSeries(list, { id: 'n' }, 'a').map(({ id }) => id), ['a', 'n', 'b']);
  assert.deepEqual(mergeSeries(list, { id: 'n' }).map(({ id }) => id), ['a', 'b', 'n']);
  assert.throws(() => mergeSeries(list, { id: 'a' }), /already there/);
});

const published = (rows) => [buildSeries(input(rows), acts)];
const threeYears = () => published([row({ year: 2014, amount: 100 }), row({ year: 2015, amount: 200 }), row({ year: 2016, amount: 300 })]);
const update = (rows) => ({ id: 'x-budget-eur', rows });

test('updates one value, recounts it and the next year, and leaves the rest alone', () => {
  const charts = threeYears();
  const [{ data }] = updateSeries(charts, update([row({ year: 2015, amount: 400, comment: 'изменена' })]), acts);
  const expected = buildSeries(input([row({ year: 2014, amount: 100 }), row({ year: 2015, amount: 400 }), row({ year: 2016, amount: 300 })]), acts).data;

  assert.equal(data[1].value, expected[1].value);
  assert.equal(data[1].change, expected[1].change);
  assert.equal(data[2].change_percent, expected[2].change_percent);
  assert.equal(data[2].value, charts[0].data[2].value);
  assert.equal(data[0], charts[0].data[0]);
  assert.equal(data[1].comment, 'изменена');
});

test('keeps the old citations after the new ones when asked', () => {
  const charts = threeYears();
  const kept = updateSeries(charts, update([row({ year: 2015, amount: 400, keepSources: true })]), acts)[0].data[1];
  const replaced = updateSeries(charts, update([row({ year: 2015, amount: 400 })]), acts)[0].data[1];

  assert.equal(kept.sources.length, 2);
  assert.equal(kept.sources[0].amount, 400);
  assert.equal(kept.sources[1].amount, 200);
  assert.equal(replaced.sources.length, 1);
});

test('adds a comment without touching the figure', () => {
  const charts = threeYears();
  const [{ data }] = updateSeries(charts, update([{ year: 2015, comment: 'скок' }]), acts);

  assert.deepEqual({ ...data[1], comment: undefined }, { ...charts[0].data[1], comment: undefined });
  assert.equal(data[1].comment, 'скок');
  assert.equal(data[2], charts[0].data[2]);
});

test('refuses an update it could not trace', () => {
  const charts = threeYears();
  const unchecked = { ...where, checks: { file: true, gazetteAct: false, gazetteIssue: false } };

  assert.throws(() => updateSeries(charts, { id: 'nope', rows: [{ year: 2015, comment: 'x' }] }, acts), /no series nope/);
  assert.throws(() => updateSeries(charts, update([{ year: 1999, comment: 'x' }]), acts), /no value for 1999/);
  assert.throws(() => updateSeries(charts, update([{ year: 2015 }]), acts), /sources, a comment or a note/);
  assert.throws(() => updateSeries(charts, update([row({ year: 2015, sources: [unchecked] })]), acts), /not confirmed in the gazette/);
});
