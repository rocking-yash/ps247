import Link from "next/link";
import Lifecycle from "@/components/landing/Lifecycle";
import ScrollProgress from "@/components/landing/ScrollProgress";
import SiteNav from "@/components/landing/SiteNav";
import EventRow, { EventTableHead, TH, TD } from "@/components/dashboard/EventRow";
import { getLandingData } from "@/lib/landing";
import { CORRECT_RESPONSE, judgeEvent, scoreSession } from "@/lib/models";
import {
  DRONE_TYPES, RESPONSES, DRONE_LABELS, RESPONSE_LABELS, SCORING, detectionScore,
} from "@/lib/constants";
import { formatDateTime, formatScore } from "@/lib/format";

// Shows live figures from the training database — never prerender.
export const dynamic = "force-dynamic";

const SECTIONS = [
  ["#skills", "Graded skills"],
  ["#lifecycle", "One contact"],
  ["#decision-table", "Decision table"],
  ["#live-figures", "Live figures"],
  ["#verdicts", "Verdicts"],
  ["#randomisation", "Randomisation"],
];

// Why each row of the decision table is the correct response.
const RATIONALE = {
  quad_recon: "Surveillance. Deny the control link; there is no need to destroy it.",
  fixedwing_kamikaze: "Armed and committed to its target. It has to be stopped kinetically.",
  decoy_civilian: "Not a threat. Engaging it is the failure being tested for.",
};

const { weights } = SCORING;
const seconds = (ms) => `${ms / 1000} s`;

const SKILLS = [
  {
    name: "Detect",
    measures: "How long the trainee takes to flag a contact after it appears.",
    scored: `Full marks at ${seconds(SCORING.detectFullMs)} or faster, none at ${seconds(SCORING.detectZeroMs)} or slower. A contact that finishes its run unflagged is a miss.`,
    weight: weights.detection,
  },
  {
    name: "Classify",
    measures: "Whether the trainee names the right type of contact once it is flagged.",
    scored: "The share of flagged contacts identified correctly. Engaging a civilian decoy is recorded as a false positive.",
    weight: weights.classification,
  },
  {
    name: "Respond",
    measures: "Whether the counter-measure chosen is the correct one for that contact.",
    scored: "The share of flagged contacts answered as the decision table requires.",
    weight: weights.response,
  },
];

const COMPOSITE = [
  ["Detection", `${weights.detection}`],
  ["Classification", `${weights.classification}`],
  ["Response", `${weights.response}`],
  ["Each false positive", `−${SCORING.falsePositivePenalty}`],
  ["Each missed contact", `−${SCORING.missedPenalty}`],
];

// The contact that plays out in the dark band: a recon quad, flagged after
// 2.4 s and handled correctly. Its score is worked out by the same functions
// that grade a real session, so the band cannot disagree with the product.
const EXAMPLE_LATENCY_MS = 2400;
function lifecycleExample() {
  const droneType = "quad_recon";
  const event = judgeEvent({
    droneType,
    spawnTime: 0,
    detectedAt: EXAMPLE_LATENCY_MS,
    resolvedAt: EXAMPLE_LATENCY_MS,
    classifiedAs: droneType,
    responseChosen: CORRECT_RESPONSE[droneType],
  });
  return {
    droneType,
    correctResponse: CORRECT_RESPONSE[droneType],
    options: DRONE_TYPES.map((type) => [type, DRONE_LABELS[type]]),
    responses: RESPONSES.map((response) => [response, RESPONSE_LABELS[response]]),
    latency: seconds(EXAMPLE_LATENCY_MS),
    rows: [
      ["Detection", `${Math.round(detectionScore(EXAMPLE_LATENCY_MS) * weights.detection)} of ${weights.detection}`],
      ["Classification", `${weights.classification} of ${weights.classification}`],
      ["Response", `${weights.response} of ${weights.response}`],
    ],
    composite: `${scoreSession([event]).composite} of 100`,
  };
}

const WRAP = "mx-auto w-full max-w-6xl px-6";
const SECTION = "scroll-mt-14 border-t border-rule py-20 sm:py-28";
const H2 = "max-w-3xl text-3xl font-semibold leading-tight tracking-tight sm:text-4xl";
const LEAD = "mt-4 max-w-prose text-lg leading-relaxed text-ink/75";
const BODY = "max-w-prose leading-relaxed text-ink/75";

// Pinned while its panels travel sideways. With reduced motion it is an
// ordinary section with the panels stacked.
const PIN = "motion-safe:sticky top-14 flex flex-col justify-center overflow-hidden py-16 motion-safe:h-[calc(100svh-3.5rem)] motion-safe:py-0";
const TRACK = "mt-12 flex w-max gap-0 motion-safe:scrub-x motion-reduce:w-auto motion-reduce:flex-col";
const PANEL = "w-[min(84vw,40rem)] shrink-0 border-l border-ink pl-6 pr-10 motion-reduce:w-auto motion-reduce:pb-10 sm:pl-8 sm:pr-16";

function Figure({ label, value, note }) {
  return (
    <div className="border-t border-ink pt-4">
      <dt className="text-ink/75">{label}</dt>
      <dd className="mt-2 text-6xl font-semibold tracking-tight sm:text-7xl">{value}</dd>
      <dd className="mt-2 text-sm leading-relaxed text-ink/75">{note}</dd>
    </div>
  );
}

function bearing(deg) {
  if (deg === 0) return "Dead ahead";
  return `${Math.abs(deg)}° ${deg < 0 ? "left" : "right"}`;
}

export default async function Home() {
  const data = await getLandingData();
  const hasSessions = data.ok && data.stats.sessions > 0;

  return (
    <>
      <a
        href="#skills"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-2 focus:z-30 focus:bg-paper focus:px-3 focus:py-2"
      >
        Skip to content
      </a>

      <SiteNav sections={SECTIONS} darkId="lifecycle" />

      <main>
        <section id="top" className="flex min-h-[88svh] flex-col justify-end pt-32">
          <div className={`${WRAP} pb-16 sm:pb-24`}>
            <h1 className="max-w-5xl text-[clamp(2.5rem,7vw,5.5rem)] font-semibold leading-none tracking-[-0.03em] text-balance">
              Counter-drone training that grades the decision, not the aim.
            </h1>
            <p className="mt-8 max-w-2xl text-xl leading-relaxed text-ink/75">
              A browser exercise in detecting, classifying and responding to drone contacts. Every
              decision is scored and kept for after-action review.
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Link href="/simulator" className="press bg-ink px-6 py-3 font-medium text-paper">
                Run a session
              </Link>
              <Link href="/dashboard" className="press border border-ink px-6 py-3 font-medium">
                Review performance
              </Link>
            </div>
          </div>
        </section>

        <ScrollProgress id="skills" horizontal className="scroll-mt-14 border-t border-rule">
          <div data-sticky className={PIN}>
            <div className={WRAP}>
              <h2 className={H2}>Three skills, graded separately</h2>
              <p className={LEAD}>
                Each contact is worked in this order, and each step has its own score. A trainee
                who spots everything but responds wrongly shows up as exactly that.
              </p>
            </div>
            <div className={`${WRAP} overflow-hidden motion-reduce:overflow-visible`}>
              <ol data-track className={TRACK}>
                {SKILLS.map((skill) => (
                  <li key={skill.name} className={PANEL}>
                    <h3 className="text-5xl font-semibold tracking-tight sm:text-6xl">{skill.name}</h3>
                    <p className="mt-6 text-xl leading-relaxed">{skill.measures}</p>
                    <p className={`${BODY} mt-4`}>{skill.scored}</p>
                    <p className="mt-6">
                      <span className="text-2xl font-semibold">{skill.weight}</span> of 100 points
                    </p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </ScrollProgress>

        <Lifecycle id="lifecycle" data={lifecycleExample()} />

        <ScrollProgress id="decision-table" horizontal className="scroll-mt-14">
          <div data-sticky className={PIN}>
            <div className={WRAP}>
              <h2 className={H2}>The decision table is the marking scheme</h2>
              <p className={LEAD}>
                A response is marked against this table and nothing else. It is plain data in the
                source, not a trained model, so an instructor can read, question and change it.
              </p>
            </div>
            <div className={`${WRAP} overflow-hidden motion-reduce:overflow-visible`}>
              <ol data-track className={TRACK}>
                {Object.entries(CORRECT_RESPONSE).map(([droneType, response]) => (
                  <li key={droneType} className={PANEL}>
                    <p className="text-ink/75">If the contact is</p>
                    <p className="mt-1 text-2xl font-semibold">{DRONE_LABELS[droneType]}</p>
                    <p className="mt-6 text-ink/75">the correct response is</p>
                    <p className="mt-1 text-5xl font-semibold tracking-tight sm:text-6xl">
                      {RESPONSE_LABELS[response]}
                    </p>
                    <p className={`${BODY} mt-6`}>{RATIONALE[droneType]}</p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </ScrollProgress>

        <section className={SECTION}>
          <div className={WRAP}>
            <h2 className={H2}>How the composite score is built</h2>
            <p className={LEAD}>The headline number for a session, from 0 to 100.</p>
            <table className="mt-8 w-full max-w-md text-left">
              <tbody>
                {COMPOSITE.map(([label, points]) => (
                  <tr key={label}>
                    <th scope="row" className="border-b border-rule py-3 pr-5 font-normal">
                      {label}
                    </th>
                    <td className="border-b border-rule py-3 text-right font-semibold">{points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section id="live-figures" className={SECTION}>
          <div className={WRAP}>
            <h2 className={H2}>What has been recorded so far</h2>
            {!data.ok && (
              <p className={LEAD}>
                The training database could not be reached just now, so no figures are shown.
              </p>
            )}
            {data.ok && !hasSessions && (
              <p className={LEAD}>
                No sessions have been recorded yet. The figures appear here after the first one is
                run.
              </p>
            )}
            {hasSessions && (
              <>
                <p className={LEAD}>
                  Live from the training database, read at {formatDateTime(data.readAt)}.
                </p>
                <dl className="mt-12 grid gap-12 sm:grid-cols-3">
                  <Figure
                    label="Sessions recorded"
                    value={data.stats.sessions}
                    note="Every run of the simulator, including misses."
                  />
                  <Figure
                    label="Average composite"
                    value={formatScore(data.stats.avgComposite)}
                    note="Out of 100, across completed sessions."
                  />
                  <Figure
                    label="False positives"
                    value={data.stats.falsePositives}
                    note="Civilian decoys that were engaged."
                  />
                </dl>
              </>
            )}
          </div>
        </section>

        <section id="verdicts" className={SECTION}>
          <div className={WRAP}>
            <h2 className={H2}>Every contact ends in a verdict</h2>
            <p className={LEAD}>
              This is the record an instructor reviews: what appeared, how fast it was seen, what
              the trainee called it and what they did about it.
              {hasSessions && " The rows below are recent contacts from real sessions, with trainee names withheld."}
            </p>
            {hasSessions ? (
              <div className="relative mt-10 overflow-x-auto">
                <table className="w-full min-w-[52rem] text-left">
                  <EventTableHead />
                  <tbody>
                    {data.sample.map((event, i) => (
                      <EventRow key={i} event={event} />
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mt-10 border-y border-rule py-6">
                {data.ok
                  ? "No contacts have been graded yet."
                  : "The sample could not be loaded because the training database is unreachable."}
              </p>
            )}
          </div>
        </section>

        <section id="randomisation" className={SECTION}>
          <div className={WRAP}>
            <h2 className={H2}>No two sessions are the same</h2>
            <p className={LEAD}>
              Each session draws a fresh random seed. Together with the difficulty level and the
              practice focus, the seed decides how many contacts there are, which types, where each
              one appears and when the swarm arrives. A trainee cannot learn a layout by heart,
              because the layout they practised on is not issued again.
            </p>
            <p className={`${BODY} mt-4 text-lg`}>
              All three are stored with the session, so the same numbers regenerate exactly what
              the trainee saw, and an instructor can replay it from the dashboard.
            </p>
            {data.ok && data.layouts.length > 0 && (
              <div className="relative mt-10 overflow-x-auto">
                <table className="w-full min-w-[44rem] text-left">
                  <caption className="pb-3 text-left text-ink/75">
                    The most recent stored seeds and the layout each one regenerates.
                  </caption>
                  <thead>
                    <tr>
                      {["Seed", "Level", "Contacts", "Swarm of", "Swarm arrives", "First contact"].map((heading) => (
                        <th key={heading} className={`${TH} last:pr-0`}>
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.layouts.map((layout) => (
                      <tr key={layout.seed}>
                        <td className={TD}>{layout.seed}</td>
                        <td className={`${TD} whitespace-nowrap`}>{layout.level}</td>
                        <td className={`${TD} whitespace-nowrap`}>{layout.contacts}</td>
                        <td className={`${TD} whitespace-nowrap`}>{layout.swarmSize}</td>
                        <td className={`${TD} whitespace-nowrap`}>{(layout.swarmAtMs / 1000).toFixed(1)} s</td>
                        <td className={`${TD} whitespace-nowrap pr-0`}>
                          {bearing(layout.firstBearingDeg)}, at {(layout.firstAtMs / 1000).toFixed(1)} s
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </main>

      <footer className="border-t border-ink text-sm text-ink/75">
        <div className={`${WRAP} flex flex-col gap-x-10 gap-y-1 py-10 sm:flex-row`}>
          <span>Smart India Hackathon 2026</span>
          <span>Problem statement SIH26247</span>
          <span>Ministry of Defence, Defence Services Staff College</span>
        </div>
      </footer>
    </>
  );
}
