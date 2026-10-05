// Display formatting shared by the dashboard pages. Dates are rendered on the
// server, so the time zone is pinned rather than left to the host machine.

const DATE_TIME = new Intl.DateTimeFormat('en-IN', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Kolkata',
});

export function formatDateTime(date) {
  return date ? DATE_TIME.format(new Date(date)) : '—';
}

export function formatSeconds(ms) {
  return ms === null || ms === undefined ? '—' : `${(ms / 1000).toFixed(2)} s`;
}

export function formatScore(score) {
  return score === null || score === undefined ? '—' : String(Math.round(score));
}
