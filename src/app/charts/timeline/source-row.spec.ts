import { describe, expect, it } from 'vitest';

import { mirrorLinks, sourceKind, toExcerpt, toSourceRow } from './source-row';

describe('sourceKind', () => {
  it('names the kind of document', () => {
    expect(sourceKind('https://dv.parliament.bg/DVWeb/showMaterialDV.jsp?idMat=1')).toBe('official');
    expect(sourceKind('https://bg.wikipedia.org/wiki/X')).toBe('reference');
    expect(sourceKind('https://www.minfin.bg/upload/a.PDF')).toBe('pdf');
    expect(sourceKind('https://notgov.bg/x')).toBe('document');
    expect(sourceKind('')).toBe('document');
  });
});

describe('toExcerpt', () => {
  it('splits the trailing locator from the quote', () => {
    expect(toExcerpt('Иван Иванов за министър [ДВ, бр. 1 от 2 януари 2020 г.]')).toEqual({
      text: 'Иван Иванов за министър',
      locator: 'ДВ, бр. 1 от 2 януари 2020 г.',
    });
  });

  it('keeps brackets inside the text', () => {
    expect(toExcerpt('Текст [бел. ред.] и още')).toEqual({ text: 'Текст [бел. ред.] и още' });
  });

  it('drops an empty quote, and one that repeats the title', () => {
    expect(toExcerpt('  ')).toBeNull();
    expect(toExcerpt('Заглавие', 'Заглавие')).toBeNull();
  });
});

describe('mirrorLinks', () => {
  it('lists the other copies without duplicates or the first link', () => {
    expect(mirrorLinks(['https://a.bg/1', 'https://a.bg/1', 'https://bnr.bg/2', 'https://bnr.bg/2']).map((mirror) => mirror.label)).toEqual(['БНР']);
  });
});

describe('toSourceRow', () => {
  it('prints a source with no link at all', () => {
    expect(toSourceRow({ name: 'Закон', media: 'Държавен вестник' })).toMatchObject({ url: '', kind: 'document', media: 'Държавен вестник', mirrors: [] });
  });

  it('names Eurostat as the publisher of its data browser', () => {
    expect(toSourceRow({ name: 'Набор', link: ['https://ec.europa.eu/eurostat/databrowser/view/ILC_DI12/default/table'] })).toMatchObject({
      kind: 'official',
      media: 'Евростат',
    });
  });
});
