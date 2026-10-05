'use client';

// Who is using this browser, kept in localStorage. This is identity for the
// demo, not authentication: there are no passwords or sessions, and nothing
// here is trusted by the server beyond "this trainee id exists". In a real
// deployment identity would come from the unit's own system.

import { useSyncExternalStore } from 'react';

export const TRAINEE_KEY = 'ps247.traineeId';  // the trainee last picked
export const ROLE_KEY = 'ps247.role';          // 'instructor' (default) | 'trainee'

const CHANGED = 'ps247:stored';

function read(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;  // storage blocked: behave as if nothing was remembered
  }
}

// value: a string, or null to forget it.
export function setStored(key, value) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Nothing to remember it in; the pick still holds for this page via the event.
  }
  window.dispatchEvent(new Event(CHANGED));
}

function subscribe(onChange) {
  window.addEventListener('storage', onChange);  // other tabs
  window.addEventListener(CHANGED, onChange);    // this tab
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(CHANGED, onChange);
  };
}

// The stored value, or null. Null on the server and until the page has hydrated.
export function useStored(key) {
  return useSyncExternalStore(subscribe, () => read(key), () => null);
}
