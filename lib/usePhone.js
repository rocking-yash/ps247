'use client';

import { useSyncExternalStore } from 'react';

// A phone-sized screen: narrow and upright, or short and on its side. The
// same two conditions as the `phone` variant in app/globals.css; keep them
// in step. Everything that adapts to a phone is behind one or the other, so
// a desktop window never takes any of it.
export const PHONE_QUERY =
  '(max-width: 47.99rem) and (orientation: portrait), (max-height: 31.25rem) and (orientation: landscape)';

function subscribe(onChange) {
  const query = window.matchMedia(PHONE_QUERY);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

// True on a phone-sized screen. False on the server and on first render.
export function usePhone() {
  return useSyncExternalStore(subscribe, () => window.matchMedia(PHONE_QUERY).matches, () => false);
}
