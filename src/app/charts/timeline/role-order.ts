/* Which rows the chart shows and in what order, as data. Row order is the order
   of the array the chart is handed, so rearranging that array is the whole
   mechanism: labels, bars and the side panel all follow. */

/** Row names in display order. */
export type RoleOrder = readonly string[];

const ORDER_STORAGE_KEY = 'the-budget.roleOrder';
const SELECTION_STORAGE_KEY = 'the-budget.selectedRoles';
const PANEL_STORAGE_KEY = 'the-budget.panelOpen';

/* Bring a possibly stale stored order back in line with the rows on offer today.
   A row that no longer exists is dropped; a new one goes to the end, so it can
   never become invisible to a reader with a saved order. */
export function reconcileOrder(names: readonly string[], stored: RoleOrder | null): RoleOrder {
  const available = new Set(names);
  const kept = [...new Set(stored ?? [])].filter((name) => available.has(name));
  const seen = new Set(kept);
  return [...kept, ...names.filter((name) => !seen.has(name))];
}

/** Rearrange `groups` to match `order`. Returns a new array; input untouched. */
export function applyOrder<T extends { readonly name: string }>(groups: readonly T[], order: RoleOrder): T[] {
  const byName = new Map(groups.map((group) => [group.name, group]));
  return order.flatMap((name) => byName.get(name) ?? []);
}

/** Returns `order` itself for a no-op move, so a caller can skip the rebuild. */
export function moveRole(order: RoleOrder, from: number, to: number): RoleOrder {
  if (from === to || from < 0 || to < 0 || from >= order.length || to >= order.length) return order;
  const next = [...order];
  next.splice(to, 0, next.splice(from, 1)[0]);
  return next;
}

export function ordersEqual(a: RoleOrder, b: RoleOrder): boolean {
  return a.length === b.length && a.every((name, i) => name === b[i]);
}

/* A first visit gets `defaults` (everything, if none are given). A remembered
   selection is intersected with the rows on offer, so a renamed row drops out
   silently; if that leaves nothing while something *was* remembered, the names
   all went stale and the defaults are safer than an empty chart. A remembered
   empty selection stays empty. */
export function restoreSelection(
  names: readonly string[],
  stored: readonly string[] | null,
  defaults: readonly string[] = names
): ReadonlySet<string> {
  const available = new Set(names);
  const fallback = defaults.filter((name) => available.has(name));
  if (stored === null) return new Set(fallback);
  const restored = stored.filter((name) => available.has(name));
  return new Set(!restored.length && stored.length ? fallback : restored);
}

/* localStorage throws rather than returning null when it is unavailable
   (private mode, blocked site data), so every access is guarded: the panel keeps
   working, it just stops remembering. */
export function readNames(key: string): string[] | null {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((name): name is string => typeof name === 'string') : null;
  } catch {
    return null;
  }
}

export function storeNames(key: string, names: Iterable<string>): void {
  try {
    localStorage.setItem(key, JSON.stringify([...names]));
  } catch {
    /* Lost on reload; nothing else depends on it. */
  }
}

export const readStoredOrder = (): RoleOrder | null => readNames(ORDER_STORAGE_KEY);
export const storeOrder = (order: RoleOrder): void => storeNames(ORDER_STORAGE_KEY, order);
export const readStoredSelection = (): readonly string[] | null => readNames(SELECTION_STORAGE_KEY);
export const storeSelection = (selected: ReadonlySet<string>): void => storeNames(SELECTION_STORAGE_KEY, selected);

export function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === 'true';
  } catch {
    return false;
  }
}

export function storeFlag(key: string, value: boolean): void {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    /* Lost on reload; nothing else depends on it. */
  }
}

export const readStoredPanelOpen = (): boolean => readFlag(PANEL_STORAGE_KEY);
export const storePanelOpen = (open: boolean): void => storeFlag(PANEL_STORAGE_KEY, open);

export function clearStoredOrder(): void {
  try {
    localStorage.removeItem(ORDER_STORAGE_KEY);
  } catch {
    /* Nothing to do: the next read returns whatever is there. */
  }
}
