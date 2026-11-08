import { afterEach, describe, expect, it } from 'vitest';

import { applyOrder, moveRole, ordersEqual, readStoredPanelOpen, reconcileOrder, restoreSelection, storePanelOpen } from './role-order';

describe('reconcileOrder', () => {
  it('uses the canonical order when nothing is stored', () => {
    expect(reconcileOrder(['a', 'b'], null)).toEqual(['a', 'b']);
  });

  it('keeps a stored order', () => {
    expect(reconcileOrder(['a', 'b', 'c'], ['c', 'a', 'b'])).toEqual(['c', 'a', 'b']);
  });

  it('drops rows that are gone and appends new ones', () => {
    expect(reconcileOrder(['a', 'b', 'new'], ['gone', 'b', 'a'])).toEqual(['b', 'a', 'new']);
  });

  it('survives a stored order with duplicates', () => {
    expect(reconcileOrder(['a', 'b'], ['b', 'b', 'a'])).toEqual(['b', 'a']);
  });
});

describe('applyOrder', () => {
  it('rearranges without touching the input', () => {
    const groups = [{ name: 'a' }, { name: 'b' }];

    expect(applyOrder(groups, ['b', 'a']).map((group) => group.name)).toEqual(['b', 'a']);
    expect(groups.map((group) => group.name)).toEqual(['a', 'b']);
  });
});

describe('moveRole', () => {
  it('moves down and up', () => {
    expect(moveRole(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
    expect(moveRole(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b']);
  });

  it('returns the same array for a no-op or an out-of-range move', () => {
    const order = ['a', 'b'];

    expect(moveRole(order, 1, 1)).toBe(order);
    expect(moveRole(order, 0, 5)).toBe(order);
  });
});

describe('ordersEqual', () => {
  it('compares position by position', () => {
    expect(ordersEqual(['a', 'b'], ['a', 'b'])).toBe(true);
    expect(ordersEqual(['a', 'b'], ['b', 'a'])).toBe(false);
    expect(ordersEqual(['a'], ['a', 'b'])).toBe(false);
  });
});

describe('restoreSelection', () => {
  it('selects everything on a first visit', () => {
    expect([...restoreSelection(['a', 'b'], null)]).toEqual(['a', 'b']);
  });

  it('keeps a remembered empty selection empty', () => {
    expect(restoreSelection(['a', 'b'], []).size).toBe(0);
  });

  it('drops names that no longer exist', () => {
    expect([...restoreSelection(['a', 'b'], ['b', 'gone'])]).toEqual(['b']);
  });

  it('falls back to everything when every remembered name went stale', () => {
    expect([...restoreSelection(['a', 'b'], ['gone'])]).toEqual(['a', 'b']);
  });
});

describe('the stored panel state', () => {
  afterEach(() => localStorage.clear());

  it('opens closed, then comes back as it was left', () => {
    expect(readStoredPanelOpen()).toBe(false);
    storePanelOpen(true);
    expect(readStoredPanelOpen()).toBe(true);
    storePanelOpen(false);
    expect(readStoredPanelOpen()).toBe(false);
  });
});
