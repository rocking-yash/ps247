// The dark band: one contact from first appearance to verdict, in five
// stages. Every visual state is a function of --p (0 → 1), which the pinned
// version takes from scroll position and the static frames have fixed, so
// there is one set of markup and no timeline to keep in step.
//
//   0.0–0.2  appears far off      0.6–0.8  response chosen
//   0.2–0.4  closes, is flagged   0.8–1.0  verdict and score
//   0.4–0.6  classified

import ScrollProgress from './ScrollProgress';

const STAGES = [
  { name: 'Appears', title: 'A contact appears', text: 'Far out, small, hard to make out. The clock for detection starts now.' },
  { name: 'Detected', title: 'The trainee flags it', text: 'One click on the contact. Time from appearance to flag is the detection score.' },
  { name: 'Classified', title: 'What is it?', text: 'Shape and movement are the only clues. Nothing in the view is labelled.' },
  { name: 'Answered', title: 'What should be done?', text: 'One counter-measure, checked against the decision table.' },
  { name: 'Graded', title: 'The verdict', text: 'Each skill is scored on its own, then combined.' },
];

// Opacity window for stage i: in just after it starts, out just before it ends.
function stageWindow(i) {
  const start = i * 0.2;
  return {
    '--in0': i === 0 ? -1 : start,
    '--in1': i === 0 ? -0.5 : start + 0.03,
    '--out0': i === 4 ? 2 : start + 0.18,
    '--out1': i === 4 ? 3 : start + 0.2,
  };
}

const range = (from, until) => ({ '--from': from, '--until': until });

// Options surface one after another, then the correct one fills in while the
// others fall back.
function Options({ legend, options, correct, surfaceAt, settleAt }) {
  return (
    <>
      <p className="text-sm font-semibold">{legend}</p>
      <ul className="mt-2 flex flex-col gap-1.5">
        {options.map(([value, label], i) => (
          <li key={value} className="scrub scrub-fade" style={range(surfaceAt + i * 0.015, surfaceAt + 0.03 + i * 0.015)}>
            <span
              className={`scrub flex min-h-9 items-center gap-3 border border-readout/40 px-3 py-2 text-sm ${
                value === correct ? 'scrub-chosen' : 'scrub-dim'
              }`}
              style={range(settleAt, settleAt + 0.05)}
            >
              <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 border border-current" />
              {label}
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}

function Contact() {
  return (
    <div className="scrub-contact absolute left-1/2 top-[64%] h-0 w-0 sm:left-[56%] sm:top-[52%]">
      <div className="absolute -left-14 -top-6 w-28 text-readout sm:-left-20 sm:-top-9 sm:w-40">
        <svg viewBox="0 0 160 70" aria-hidden="true" className="block w-full">
          <g fill="currentColor" opacity="0.55">
            <ellipse cx="30" cy="20" rx="26" ry="7" />
            <ellipse cx="130" cy="20" rx="26" ry="7" />
            <ellipse cx="42" cy="46" rx="30" ry="8" />
            <ellipse cx="118" cy="46" rx="30" ry="8" />
          </g>
          <path d="M30 20 118 46M130 20 42 46" stroke="currentColor" strokeWidth="5" />
          <rect x="64" y="25" width="32" height="18" rx="2" fill="currentColor" />
        </svg>
      </div>
      <div
        className="scrub scrub-ring absolute -left-20 -top-20 h-40 w-40 rounded-full border-2 border-[#e8b341] sm:-left-28 sm:-top-28 sm:h-56 sm:w-56"
        style={range(0.28, 0.35)}
      />
    </div>
  );
}

// data: { options, responses, droneType, correctResponse, latency, rows, composite }
function Frame({ data, className = '', style }) {
  return (
    <div className={`flex flex-col overflow-hidden bg-panel text-readout md:flex-row ${className}`} style={style}>
      {/* The view: sky, a hard horizon, the contact, and the stage's caption */}
      <div className="relative min-h-0 flex-1 overflow-hidden [container-type:size]">
        <div className="absolute inset-x-0 bottom-0 h-[20%] border-t border-panel-rule bg-[#080c10]" />
        <Contact />
        {STAGES.map((stage, i) => (
          <div key={stage.name} className="scrub-window absolute left-6 top-6 max-w-sm pr-6" style={stageWindow(i)}>
            <h3 className="text-2xl font-semibold leading-tight sm:text-3xl">{stage.title}</h3>
            <p className="mt-2 text-readout/70">{stage.text}</p>
          </div>
        ))}
      </div>

      {/* The instrument column, as in the simulator */}
      <div className="flex h-[52%] shrink-0 flex-col border-t border-panel-rule md:h-auto md:w-80 md:border-l md:border-t-0">
        <ol className="flex justify-between gap-x-2 border-b border-panel-rule px-5 py-3 text-xs">
          {STAGES.map((stage, i) => (
            <li key={stage.name} className="relative pb-1 text-readout/60">
              {stage.name}
              <span className="scrub-window absolute inset-x-0 bottom-0 h-0.5 bg-readout" style={stageWindow(i)} />
            </li>
          ))}
        </ol>

        <div className="relative flex-1">
          <div className="scrub-window absolute inset-0 px-5 py-4" style={stageWindow(0)}>
            <p className="text-sm text-readout/70">Scanning. Nothing flagged yet.</p>
          </div>

          <div className="scrub-window absolute inset-0 px-5 py-4" style={stageWindow(1)}>
            <div className="scrub scrub-fade" style={range(0.32, 0.36)}>
              <p className="text-sm font-semibold">Contact flagged</p>
              <p className="mt-1 text-3xl font-semibold">{data.latency}</p>
              <p className="text-sm text-readout/70">after it appeared</p>
            </div>
          </div>

          <div className="scrub-window absolute inset-0 px-5 py-4" style={stageWindow(2)}>
            <Options legend="Classify" options={data.options} correct={data.droneType} surfaceAt={0.42} settleAt={0.5} />
          </div>

          <div className="scrub-window absolute inset-0 px-5 py-4" style={stageWindow(3)}>
            <Options legend="Respond" options={data.responses} correct={data.correctResponse} surfaceAt={0.62} settleAt={0.7} />
          </div>

          <div className="scrub-window absolute inset-0 px-5 py-4" style={stageWindow(4)}>
            <p className="text-sm font-semibold">Verdict</p>
            <p className="mt-1 text-3xl font-semibold text-pass-lit">Correct</p>
            <dl className="mt-3 border-t border-panel-rule text-sm">
              {data.rows.map(([label, value], i) => (
                <div
                  key={label}
                  className="scrub scrub-fade flex justify-between gap-4 border-b border-panel-rule py-2"
                  style={range(0.84 + i * 0.025, 0.87 + i * 0.025)}
                >
                  <dt className="text-readout/70">{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
              <div className="scrub scrub-fade flex justify-between gap-4 py-2 font-semibold" style={range(0.93, 0.97)}>
                <dt>Composite</dt>
                <dd>{data.composite}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}

// --p at the end of each stage, for the static frames.
const STAGE_ENDS = [0.17, 0.37, 0.57, 0.77, 1];

export default function Lifecycle({ id, data }) {
  return (
    <div id={id} className="scroll-mt-14">
      {/* Pinned and driven by scroll */}
      <ScrollProgress aria-label="One contact, from first sight to verdict" className="h-[420svh] motion-reduce:hidden">
        <div data-sticky className="sticky top-14 h-[calc(100svh-3.5rem)]">
          <Frame data={data} className="h-full" />
        </div>
      </ScrollProgress>

      {/* Reduced motion: the end of each stage, stacked */}
      <div className="hidden motion-reduce:block">
        {STAGE_ENDS.map((p) => (
          <Frame key={p} data={data} className="h-[34rem] border-b border-panel-rule md:h-[26rem]" style={{ '--p': p }} />
        ))}
      </div>
    </div>
  );
}
