'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Scene from './Scene';
import { buildScenario, newSeed } from '@/lib/scenario';
import {
  DRONE_TYPES, RESPONSES, DRONE_LABELS, RESPONSE_LABELS, VERDICT_LABELS,
} from '@/lib/constants';

const BUTTON = 'press w-full border border-readout px-4 py-2 text-sm font-medium';
const PRIMARY = `${BUTTON} bg-readout text-panel disabled:cursor-not-allowed disabled:opacity-40`;
const ROW = 'flex items-baseline justify-between gap-4 border-b border-panel-rule py-2 text-sm';

function formatClock(ms) {
  return `T+${(ms / 1000).toFixed(1).padStart(5, '0')} s`;
}

function Readout({ label, value, tone = '' }) {
  return (
    <div className={ROW}>
      <dt className="text-readout/60">{label}</dt>
      <dd className={`text-right ${tone}`}>{value}</dd>
    </div>
  );
}

// One decision as a column of large, separated switches. The chosen one
// inverts, so it cannot be mistaken; the gaps between them are dead space, so
// a slip of the pointer selects nothing.
function ChoiceGroup({ legend, options, labels, value, onChange }) {
  return (
    <fieldset className="mt-5">
      <legend className="text-sm font-semibold">{legend}</legend>
      <div className="mt-2 flex flex-col gap-1.5">
        {options.map((option) => {
          const chosen = value === option;
          return (
            <label
              key={option}
              className={`press relative flex min-h-9 cursor-pointer items-center gap-3 border px-3 py-2 text-sm has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-readout ${
                chosen ? 'border-readout bg-readout font-semibold text-panel' : 'border-readout/40'
              }`}
            >
              <input
                type="radio"
                name={legend}
                className="sr-only"
                checked={chosen}
                onChange={() => onChange(option)}
              />
              <span
                aria-hidden="true"
                className={`h-2.5 w-2.5 shrink-0 border ${chosen ? 'border-panel bg-panel' : 'border-readout/60'}`}
              />
              {labels[option]}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function DecisionPanel({ detectedAt, waiting, onSubmit }) {
  const [classifiedAs, setClassifiedAs] = useState(null);
  const [responseChosen, setResponseChosen] = useState(null);

  return (
    <>
      <h2 className="text-sm font-semibold">Contact flagged</h2>
      <p className="text-sm text-readout/60">
        {formatClock(detectedAt)}, marked with the solid ring.
        {waiting > 0 && ` ${waiting} more flagged and waiting.`}
      </p>
      <ChoiceGroup
        legend="Classify"
        options={DRONE_TYPES}
        labels={DRONE_LABELS}
        value={classifiedAs}
        onChange={setClassifiedAs}
      />
      <ChoiceGroup
        legend="Respond"
        options={RESPONSES}
        labels={RESPONSE_LABELS}
        value={responseChosen}
        onChange={setResponseChosen}
      />
      {/* Set apart from the choices, and it reads back what will be submitted. */}
      <div className="mt-5 border-t border-panel-rule pt-3">
        <p className="text-sm text-readout/60">
          {classifiedAs && responseChosen ? (
            <>
              Submitting <span className="text-readout">{DRONE_LABELS[classifiedAs]}</span>, response{' '}
              <span className="text-readout">{RESPONSE_LABELS[responseChosen]}</span>.
            </>
          ) : (
            'Choose a classification and a response.'
          )}
        </p>
        <button
          className={`${PRIMARY} mt-3`}
          disabled={!classifiedAs || !responseChosen}
          onClick={() => onSubmit(classifiedAs, responseChosen)}
        >
          Submit decision
        </button>
      </div>
    </>
  );
}

function tone(ok) {
  return ok ? 'text-pass-lit' : 'text-fail-lit';
}

function percent(share) {
  return `${Math.round(share * 100)}%`;
}

// What the next session will be and why, in the server's own words: the
// level and its reason, then what the scenario will practise and its reason.
function NextUp({ assignment }) {
  return (
    <div className="mt-4 border-t border-panel-rule pt-3 text-sm text-readout/60">
      <p>
        {assignment.levelReason} It will be by {assignment.lighting}.
      </p>
      {assignment.focusReason && <p className="mt-2">{assignment.focusReason}</p>}
    </div>
  );
}

// Starting needs the server's assignment; say so if it could not be fetched.
function StartButton({ assignment, label, onBegin, onRetry }) {
  if (assignment === false) {
    return (
      <>
        <p className="mt-4 text-sm text-fail-lit">The next assignment could not be loaded.</p>
        <button className={`${BUTTON} mt-2`} onClick={onRetry}>
          Try again
        </button>
      </>
    );
  }
  return (
    <button className={`${PRIMARY} mt-4`} disabled={!assignment} onClick={onBegin}>
      {label}
    </button>
  );
}

function ResultPanel({ result, replay, assignment, onRestart, onRetry }) {
  const { scores, events } = result;

  return (
    <>
      <h2 className="text-sm font-semibold">{replay ? 'Replay report' : 'Session report'}</h2>
      <p className="text-sm text-readout/60">
        {replay
          ? `Not saved. The original record is unchanged; it scored ${replay.originalComposite}.`
          : 'Saved to the training record.'}
      </p>
      <dl className="mt-3 border-t border-panel-rule">
        <Readout label="Composite" value={`${scores.composite} / 100`} tone="font-semibold" />
        <Readout
          label="Detect"
          value={scores.detectionAvgMs === null ? 'None detected' : `${(scores.detectionAvgMs / 1000).toFixed(2)} s average`}
        />
        <Readout label="Classify" value={`${percent(scores.classificationAccuracy)} correct`} />
        <Readout label="Respond" value={`${percent(scores.responseAccuracy)} correct`} />
        <Readout label="False positives" value={scores.falsePositives} tone={scores.falsePositives ? tone(false) : ''} />
        <Readout label="Missed" value={scores.missed} tone={scores.missed ? tone(false) : ''} />
      </dl>

      {result.weakness && <p className="mt-3 text-sm">{result.weakness}</p>}

      <h3 className="mt-5 text-sm font-semibold">Contacts, in order of appearance</h3>
      <ol className="mt-1 border-t border-panel-rule">
        {events.map((event, i) => (
          <li key={i} className={ROW}>
            <span>{DRONE_LABELS[event.droneType]}</span>
            <span className={`text-right ${tone(event.verdict === 'correct')}`}>
              {VERDICT_LABELS[event.verdict]}
            </span>
          </li>
        ))}
      </ol>

      <p className="mt-3 break-all text-xs text-readout/60">
        {result.id && (
          <>
            Session {result.id}
            <br />
          </>
        )}
        Seed {result.scenarioSeed}
      </p>
      {assignment && !replay && <NextUp assignment={assignment} />}
      <StartButton
        assignment={assignment}
        label={replay ? 'Replay again' : 'Run another session'}
        onBegin={onRestart}
        onRetry={onRetry}
      />
    </>
  );
}

// The server decides level and lighting from the trainee's record.
// Resolves to false if it cannot be reached.
async function fetchAssignment() {
  try {
    const res = await fetch('/api/sessions/next');
    return res.ok ? await res.json() : false;
  } catch {
    return false;
  }
}

const FOCUS_LABEL = { none: 'General', detect: 'Detection', classify: 'Classification', respond: 'Response' };
const LEVEL_SOURCE = { instructor: 'set by instructor', adaptive: 'adaptive', replay: 'as recorded' };

const BLANK = { status: 'pending', detectedAt: null, resolvedAt: null, classifiedAs: null, responseChosen: null };
const isOver = (record) => record.status === 'resolved' || record.status === 'missed';

// replay: null for a new session, or the recorded session to rerun
// (see lib/replay.js). A replay reuses that session's seed, level and
// lighting, and its result is never saved.
export default function Simulator({ replay = null }) {
  const replayAssignment =
    replay && replay.exact
      ? { level: replay.level, lighting: replay.lighting, focus: replay.focus, setBy: 'replay' }
      : null;
  const [phase, setPhaseState] = useState('idle'); // idle | running | saving | done | error
  const [scenario, setScenario] = useState(null);
  // One record per contact, same order as scenario.drones.
  // status: pending (not yet flagged) | flagged | resolved | missed
  const [records, setRecords] = useState([]);
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  // Level and lighting for the next session, set by the server from the
  // trainee's record. null until loaded; false if it could not be loaded.
  const [assignment, setAssignment] = useState(replayAssignment);
  // The assignment the current (or just finished) session is running under.
  const [running, setRunning] = useState(null);

  // Mirrors of state for callbacks fired from the render loop, which must not
  // act twice on a stale value.
  const phaseRef = useRef('idle');
  const recordsRef = useRef([]);
  const scenarioRef = useRef(null);
  const runningRef = useRef(null);
  const clock = useRef({ start: null, stop: null });
  const pending = useRef(null);

  function setPhase(next) {
    phaseRef.current = next;
    setPhaseState(next);
  }

  // Milliseconds from session start — the only clock events are recorded on.
  const getElapsed = useCallback(() => {
    const { start, stop } = clock.current;
    return start === null ? null : (stop ?? performance.now()) - start;
  }, []);

  useEffect(() => {
    if (phase !== 'running') return;
    const id = setInterval(() => setElapsed(getElapsed()), 100);
    return () => clearInterval(id);
  }, [phase, getElapsed]);

  async function loadAssignment() {
    if (replay) return;  // a replay's level and lighting are fixed
    setAssignment(null);
    setAssignment(await fetchAssignment());
  }

  useEffect(() => {
    if (replay) return;
    let ignore = false;
    fetchAssignment().then((next) => {
      if (!ignore) setAssignment(next);
    });
    return () => {
      ignore = true;
    };
  }, [replay]);

  function begin() {
    // A fresh random seed every session; with the level it fixes the scenario.
    // A replay uses the recorded session's seed instead, so it is the same one.
    const next = buildScenario(replay ? replay.seed : newSeed(), assignment.level, assignment.focus ?? null);
    scenarioRef.current = next;
    runningRef.current = assignment;
    setRunning(assignment);
    if (!replay) setAssignment(null);
    recordsRef.current = next.drones.map(() => BLANK);
    setScenario(next);
    setRecords(recordsRef.current);
    setResult(null);
    setError(null);
    setElapsed(0);
    clock.current = { start: performance.now(), stop: null, wallStart: new Date().toISOString() };
    setPhase('running');
  }

  async function save(payload) {
    pending.current = payload;
    setPhase('saving');
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Save failed (${res.status})`);
      setResult(data);
      setPhase('done');
      loadAssignment();  // the session just saved may change the next level
    } catch (err) {
      setError(err.message);
      setPhase('error');
    }
  }

  // The session ends when every contact is either decided or missed.
  function finish(finalRecords) {
    setElapsed(Math.round(getElapsed()));
    clock.current.stop = performance.now();

    const { seed, drones } = scenarioRef.current;
    save({
      scenarioSeed: seed,
      startedAt: clock.current.wallStart,
      endedAt: new Date().toISOString(),
      completed: true,
      replay: Boolean(replay),
      difficulty: {
        level: runningRef.current.level,
        setBy: replay ? undefined : runningRef.current.setBy,
        focus: runningRef.current.focus ?? null,
      },
      conditions: { lighting: runningRef.current.lighting, terrain: 'rural' },
      // One event per contact, each graded on its own.
      events: drones.map((drone, i) => ({
        droneType: drone.droneType,
        spawnTime: drone.spawnTime,
        detectedAt: finalRecords[i].detectedAt,
        resolvedAt: finalRecords[i].resolvedAt,
        classifiedAs: finalRecords[i].classifiedAs,
        responseChosen: finalRecords[i].responseChosen,
      })),
    });
  }

  function updateRecord(index, patch) {
    const next = recordsRef.current.map((record, i) => (i === index ? { ...record, ...patch } : record));
    recordsRef.current = next;
    setRecords(next);
    if (next.every(isOver)) finish(next);
  }

  // Flagged contacts are decided one at a time, in the order they were flagged.
  const flagged = records
    .map((record, index) => ({ ...record, index }))
    .filter((record) => record.status === 'flagged')
    .sort((a, b) => a.detectedAt - b.detectedAt);
  const active = flagged[0] ?? null;

  function handleDetect(index) {
    if (phaseRef.current !== 'running' || recordsRef.current[index].status !== 'pending') return;
    updateRecord(index, { status: 'flagged', detectedAt: Math.round(getElapsed()) });
  }

  // A contact whose run ends unflagged is a miss. One that was flagged holds
  // where it is until the trainee has decided, so the decision is judged on
  // correctness; the pressure comes from the contacts still unflagged.
  function handleEnd(index) {
    if (phaseRef.current !== 'running' || recordsRef.current[index].status !== 'pending') return;
    const drone = scenarioRef.current.drones[index];
    updateRecord(index, { status: 'missed', resolvedAt: drone.spawnTime + drone.durationMs });
  }

  function handleSubmit(classifiedAs, responseChosen) {
    if (phaseRef.current !== 'running' || !active) return;
    updateRecord(active.index, {
      status: 'resolved',
      classifiedAs,
      responseChosen,
      resolvedAt: Math.round(getElapsed()),
    });
  }

  const atRest = phase === 'idle' || phase === 'done';
  // Readouts and view show the session in progress or just finished; before
  // the first session they show the one coming up.
  const shown = phase === 'idle' ? assignment : running;

  // The view is kept clear: every control and readout lives in the
  // instrument column beside it (below it on a narrow screen).
  return (
    <div className="fixed inset-0 flex flex-col bg-panel text-readout [--focus:var(--color-readout)] md:flex-row">
      <div className="relative min-h-0 flex-1">
        <Scene
          scenario={scenario}
          lighting={shown ? shown.lighting : 'day'}
          statuses={records.map((record) => record.status)}
          activeIndex={active ? active.index : -1}
          getElapsed={getElapsed}
          onDetect={handleDetect}
          onEnd={handleEnd}
        />
      </div>

      <aside className="flex max-h-[55vh] w-full shrink-0 flex-col overflow-y-auto border-t border-panel-rule md:max-h-none md:w-80 md:border-l md:border-t-0">
        <div className="px-5 pt-4">
          <h1 className="text-sm font-semibold">Counter-drone exercise</h1>
          <dl className="mt-2 border-t border-panel-rule">
            <Readout label="Elapsed" value={formatClock(elapsed)} />
            <Readout label="Conditions" value={shown ? (shown.lighting === 'night' ? 'Night' : 'Day') : 'Pending'} />
            <Readout
              label="Level"
              value={shown ? `${shown.level}, ${LEVEL_SOURCE[shown.setBy]}` : 'Pending'}
            />
            <Readout label="Practice focus" value={shown ? FOCUS_LABEL[shown.focus ?? 'none'] : 'Pending'} />
            {replay && <Readout label="Replay of" value={`Session of ${replay.recordedAt}`} />}
          </dl>
        </div>

        <div className="px-5 py-5" aria-live="polite">
          {phase === 'idle' && replay && !replay.exact && (
            <p className="text-sm">
              This session was recorded under an earlier scenario generator, so its seed no longer
              produces the same contacts and it cannot be replayed.
            </p>
          )}
          {phase === 'idle' && replay && replay.exact && (
            <>
              <p className="text-sm">
                This reruns a recorded session from its stored seed: the same contacts, of the same
                types, appear at the same moments on the same paths.
              </p>
              <p className="mt-2 text-sm text-readout/60">
                A replay is scored but not saved, so the original record and the trainee&apos;s
                averages are not affected.
              </p>
              <StartButton assignment={assignment} label="Begin replay" onBegin={begin} onRetry={loadAssignment} />
            </>
          )}
          {phase === 'idle' && !replay && (
            <>
              <p className="text-sm">
                You are observing the airspace over a defended compound. Contacts arrive singly
                and in groups. Flag each one as soon as you see it, then classify it and choose a
                response.
              </p>
              <p className="mt-2 text-sm text-readout/60">
                Graded on how quickly you detect, how accurately you classify and whether the
                response is correct. Not every contact is a threat. The rings on the ground are 100 m
                apart, measured from your post; a contact&apos;s shadow shows which it is over.
              </p>
              {assignment && <NextUp assignment={assignment} />}
              <StartButton assignment={assignment} label="Begin session" onBegin={begin} onRetry={loadAssignment} />
            </>
          )}
          {phase === 'running' && !active && (
            <p className="text-sm">Scan the airspace. Select a contact in the view to flag it.</p>
          )}
          {phase === 'running' && active && (
            <div key={`${scenario.seed}-${active.index}`} className="reveal-in">
              <div>
                <DecisionPanel
                  detectedAt={active.detectedAt}
                  waiting={flagged.length - 1}
                  onSubmit={handleSubmit}
                />
              </div>
            </div>
          )}
          {phase === 'saving' && <p className="text-sm">Saving session.</p>}
          {phase === 'done' && result && (
            <div className="reveal-in">
              <div>
                <ResultPanel
                  result={result}
                  replay={replay}
                  assignment={assignment}
                  onRestart={begin}
                  onRetry={loadAssignment}
                />
              </div>
            </div>
          )}
          {phase === 'error' && (
            <>
              <h2 className="text-sm font-semibold text-fail-lit">Session not saved</h2>
              <p className="mt-1 text-sm">{error}</p>
              <button className={`${PRIMARY} mt-4`} onClick={() => save(pending.current)}>
                Retry save
              </button>
            </>
          )}
        </div>

        {atRest && (
          <p className="mt-auto px-5 pb-4 text-sm">
            {replay ? (
              <Link href={`/dashboard/${replay.traineeId}`} className="underline underline-offset-4">
                Back to the session record
              </Link>
            ) : (
              <Link href="/" className="underline underline-offset-4">
                Leave the simulator
              </Link>
            )}
          </p>
        )}
      </aside>
    </div>
  );
}
