// A whole number that counts up from zero once, when it first appears.
// The real figure is always in the markup (readable, selectable, printable);
// the counting is a CSS overlay (.count-up in globals.css), so a re-render
// never restarts it and reduced-motion readers just see the figure.

// onView: wait until it scrolls into view (the page must run ScrollMotion).
export default function Count({ value, onView = false }) {
  if (value === null || value === undefined) return '—';
  const n = Math.round(value);
  return (
    <span className={onView ? 'count-up count-on-view' : 'count-up'} style={{ '--to': n }}>
      <span>{n}</span>
    </span>
  );
}
