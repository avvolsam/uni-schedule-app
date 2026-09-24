import type { SavedSelection } from './types';

const KEY = 'uni-schedule:selection';

export function loadSelection(): SavedSelection | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.groupCode === 'string') return parsed as SavedSelection;
    return null;
  } catch {
    return null;
  }
}

export function saveSelection(selection: SavedSelection): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(selection));
  } catch {
    // Private browsing / storage disabled: the app still works, it just re-asks
    // for the group next time it's opened.
  }
}

export function clearSelection(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
