'use client';

// Every session in one table: sortable by any column, filterable by unit,
// trainee and lighting. The rows arrive from the server; sorting and
// filtering happen here, and the filters are mirrored into the address so a
// filtered list can be linked to.

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LEVEL_UP_AT, LEVEL_DOWN_AT } from '@/lib/constants';

const TH = 'border-b border-rule py-3 pr-4 text-sm font-medium text-body';
const TD = 'border-b border-rule py-3 pr-4 whitespace-nowrap';
const FIELD = 'rounded-lg border border-rule bg-paper px-2 py-1.5';

// key, heading, right-aligned (numbers), and which way a first click sorts
const COLUMNS = [
  ['startedAt', 'Date and time', false, 'desc'],
  ['trainee', 'Trainee', false, 'asc'],
  ['unit', 'Unit', false, 'asc'],
  ['lighting', 'Conditions', false, 'asc'],
  ['level', 'Level', true, 'desc'],
  ['detect', 'Detect', true, 'asc'],
  ['classify', 'Classify', true, 'asc'],
  ['respond', 'Respond', true, 'asc'],
  ['composite', 'Composite', true, 'asc'],
  ['falsePositives', 'False positives', true, 'desc'],
  ['missed', 'Misses', true, 'desc'],
];

// The same thresholds the adaptive difficulty uses: strong sessions and weak
// ones stand out, the middle stays plain.
function compositeTone(score) {
  if (score >= LEVEL_UP_AT) return 'bg-pass/10 text-pass';
  if (score <= LEVEL_DOWN_AT) return 'bg-fail/10 text-fail';
  return '';
}

function compare(a, b, key) {
  const x = a[key], y = b[key];
  if (x === null || x === undefined) return 1;   // blanks last either way
  if (y === null || y === undefined) return -1;
  return typeof x === 'number' ? x - y : String(x).localeCompare(String(y));
}

// sessions: rows from listSessions(), each with a ready-made dateLabel
// initial: { unit, trainee, lighting } taken from the address, '' for "all"
export default function SessionsTable({ sessions, units, trainees, initial }) {
  const router = useRouter();
  const [filters, setFilters] = useState(initial);
  const [sort, setSort] = useState({ key: 'startedAt', direction: 'desc' });

  function applyFilters(next) {
    setFilters(next);
    const query = new URLSearchParams(Object.entries(next).filter(([, v]) => v)).toString();
    window.history.replaceState(null, '', query ? `?${query}` : window.location.pathname);
  }

  const setFilter = (name, value) => applyFilters({ ...filters, [name]: value });
  const clearFilters = () => applyFilters({ unit: '', trainee: '', lighting: '' });

  function sortBy(key, firstDirection) {
    setSort((current) =>
      current.key === key
        ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: firstDirection },
    );
  }

  const shown = sessions
    .filter((s) => (!filters.unit || s.unit === filters.unit)
      && (!filters.trainee || s.traineeId === filters.trainee)
      && (!filters.lighting || s.lighting === filters.lighting))
    .sort((a, b) => compare(a, b, sort.key) * (sort.direction === 'asc' ? 1 : -1));

  const filtered = Boolean(filters.unit || filters.trainee || filters.lighting);

  return (
    <>
      <div className="no-print mt-6 flex flex-wrap items-center gap-x-5 gap-y-3 text-sm">
        <label className="flex items-center gap-2">
          <span>Unit</span>
          <select value={filters.unit} onChange={(e) => setFilter('unit', e.target.value)} className={FIELD}>
            <option value="">All units</option>
            {units.map((unit) => (
              <option key={unit} value={unit}>{unit}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          <span>Trainee</span>
          <select value={filters.trainee} onChange={(e) => setFilter('trainee', e.target.value)} className={FIELD}>
            <option value="">All trainees</option>
            {trainees.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          <span>Conditions</span>
          <select value={filters.lighting} onChange={(e) => setFilter('lighting', e.target.value)} className={FIELD}>
            <option value="">Day and night</option>
            <option value="day">Day</option>
            <option value="night">Night</option>
          </select>
        </label>
        {filtered && (
          <button
            type="button"
            onClick={clearFilters}
            className="press border border-rule bg-paper px-3 py-1.5 font-medium"
          >
            Clear filters
          </button>
        )}
        <span role="status" className="text-body">
          Showing {shown.length} of {sessions.length} {sessions.length === 1 ? 'session' : 'sessions'}
        </span>
      </div>

      <div className="relative mt-4 overflow-x-auto rounded-xl border border-rule bg-paper px-5 py-2">
        <table className="w-full min-w-[60rem] text-left">
          <thead>
            <tr>
              {COLUMNS.map(([key, heading, numeric, firstDirection], i) => {
                const active = sort.key === key;
                return (
                  <th
                    key={key}
                    aria-sort={active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className={`${TH} ${numeric ? 'text-right' : ''} ${i === COLUMNS.length - 1 ? 'pr-0' : ''}`}
                  >
                    <button
                      type="button"
                      onClick={() => sortBy(key, firstDirection)}
                      className={`link-wipe font-medium ${active ? 'text-ink' : ''}`}
                    >
                      {heading}
                      <span aria-hidden="true" className="ml-1 inline-block w-3 text-xs">
                        {active ? (sort.direction === 'asc' ? '▲' : '▼') : ''}
                      </span>
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {shown.map((s) => (
              <tr
                key={s.id}
                onClick={() => router.push(`/dashboard/sessions/${s.id}`)}
                className="row-hover cursor-pointer"
              >
                <td className={TD}>
                  {/* The link is the keyboard and screen-reader way in; the whole row is clickable too. */}
                  <Link
                    href={`/dashboard/sessions/${s.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="link-wipe font-medium text-accent"
                  >
                    {s.dateLabel}
                  </Link>
                  {!s.completed && <span className="ml-2 text-sm text-body">Not completed</span>}
                </td>
                <td className={TD}>{s.trainee}</td>
                <td className={TD}>{s.unit}</td>
                <td className={`${TD} capitalize`}>{s.lighting}</td>
                <td className={`${TD} text-right`}>{s.level}</td>
                <td className={`${TD} text-right`}>{s.detect ?? '—'}</td>
                <td className={`${TD} text-right`}>{s.classify ?? '—'}</td>
                <td className={`${TD} text-right`}>{s.respond ?? '—'}</td>
                <td className={`${TD} text-right`}>
                  <span className={`inline-block min-w-10 rounded-md px-2 py-0.5 text-center font-semibold ${compositeTone(s.composite)}`}>
                    {s.composite}
                  </span>
                </td>
                <td className={`${TD} text-right`}>{s.falsePositives}</td>
                <td className={`${TD} pr-0 text-right`}>{s.missed}</td>
              </tr>
            ))}
            {shown.length === 0 && (
              <tr>
                <td className={`${TD} pr-0 whitespace-normal`} colSpan={COLUMNS.length}>
                  {sessions.length === 0
                    ? 'No sessions have been recorded yet. Run one in the simulator and it will appear here.'
                    : 'No sessions match these filters.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
