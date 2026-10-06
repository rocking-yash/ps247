import Link from "next/link";
import ScrollCue from "@/components/landing/ScrollCue";
import AmbientSky from "@/components/landing/AmbientSky";
import ScrollMotion from "@/components/landing/ScrollMotion";
import SiteNav from "@/components/landing/SiteNav";
import SeedValue from "@/components/landing/SeedValue";
import Count from "@/components/Count";
import EventRow, { EventTableHead, TH, TD } from "@/components/dashboard/EventRow";
import { getLandingData } from "@/lib/landing";
import { CORRECT_RESPONSE } from "@/lib/models";
import { DRONE_LABELS, RESPONSE_LABELS, SCORING } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";

// Shows live figures from the training database — never prerender.
export const dynamic = "force-dynamic";

const SECTIONS = [
  ["#skills", "Graded skills"],
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
    scored: `Full marks at ${seconds(SCORING.detectFullMs)} or faster, none at ${seconds(SCORING.detectZeroMs)} or slower. At night, when the contact is harder to see, the limits are ${seconds(SCORING.nightDetectFullMs)} and ${seconds(SCORING.nightDetectZeroMs)}. A contact that reaches the asset unflagged is a miss.`,
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
    scored: "The share of flagged contacts answered as the decision table below requires.",
    weight: weights.response,
  },
];

const COMPOSITE = [
  ["Detection", weights.detection],
  ["Classification", weights.classification],
  ["Response", weights.response],
  ["Each false positive", -SCORING.falsePositivePenalty],
  ["Each missed contact", -SCORING.missedPenalty],
];

// Every section, and the strip under the hero, is spaced by the same amount.
const SECTION = "scroll-mt-14 border-b border-rule py-14";
const WRAP = "mx-auto w-full max-w-6xl px-6";
// Section headings pin under the nav while their section scrolls past. The
// pseudo-element only widens the paper behind the pinned heading; it takes
// up no space.
const H2 = "text-3xl font-bold tracking-tight sticky top-14 z-10 bg-paper before:absolute before:inset-x-0 before:-inset-y-3 before:-z-10 before:bg-paper before:content-['']";
const LEAD = "mt-3 max-w-prose text-lg text-body";
const CARD = "card-hover rounded-xl border border-rule bg-paper p-6";
const PRIMARY = "press bg-accent px-4 py-2.5 font-medium text-white sm:px-5 phone-p:px-3";
const SECONDARY = "press border border-rule bg-paper px-4 py-2.5 font-medium sm:px-5 phone-p:px-3";

// Four things the page goes on to show, in a strip under the hero.
const AT_A_GLANCE = [
  ["Three graded skills", "Detect, classify and respond, scored separately"],
  ["An open marking scheme", "A decision table anyone can read"],
  ["Seeded scenarios", "Never repeated, always replayable"],
  ["After-action review", "For each trainee and each unit"],
];

function Figure({ label, value, note }) {
  return (
    <div className={CARD}>
      <dt className="text-sm font-medium text-body">{label}</dt>
      <dd className="mt-2 text-5xl font-bold tracking-tight">{value}</dd>
      <dd data-rule="top" className="mt-4 border-t border-rule pt-3 text-sm text-body">{note}</dd>
    </div>
  );
}

// The seed table's columns, each saying what its figure is.
const SEED_COLUMNS = [
  "Seed",
  "Difficulty level (1 to 5)",
  "Contacts in the session",
  "Contacts in its swarm",
  "Swarm starts arriving",
  "Where and when the first contact appears",
];

function bearing(deg) {
  if (deg === 0) return "Dead ahead";
  return `${Math.abs(deg)}° ${deg < 0 ? "left" : "right"} of centre`;
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

      <SiteNav sections={SECTIONS} />

      <ScrollMotion />

      <main>
        {/* Hero: the simulator's own scene, edge to edge, with the text over it.
            A scrim in the page's surface colour sits between them wherever
            the text is (hero-scrim and hero-copy in globals.css). */}
        <section id="top" className="relative flex min-h-svh flex-col justify-end overflow-hidden bg-tint pt-48 lg:justify-center lg:pt-0 phone-p:min-h-[70svh]">
          <AmbientSky />
          <div aria-hidden="true" className="hero-scrim" />
          <div data-parallax className="hero-copy pb-14 pt-6 lg:pb-16 lg:pt-28">
            <div className={WRAP}>
              <div className="relative lg:max-w-[28rem]">
                <h1 className="resolve text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl sm:leading-[1.06] lg:text-6xl lg:leading-[1.04]">
                  Counter-drone training that grades the <span className="text-accent">decision</span>, not
                  the aim.
                </h1>
                <p className="resolve mt-6 max-w-xl text-lg text-body" style={{ "--step": 1 }}>
                  A browser exercise in detecting, classifying and responding to drone contacts. Every
                  decision is scored and kept for after-action review.
                </p>
                <div className="resolve mt-8 flex flex-wrap gap-3" style={{ "--step": 2 }}>
                  <Link href="/simulator" className={PRIMARY}>
                    Run a session
                  </Link>
                  <Link href="/dashboard" className={SECONDARY}>
                    Review performance
                  </Link>
                </div>
              </div>
            </div>
          </div>
          <ScrollCue />
        </section>

        <div className={`${WRAP} py-14`}>
          <ul className="grid gap-x-8 gap-y-5 rounded-2xl bg-tint px-6 py-6 sm:grid-cols-2 lg:grid-cols-4 lg:divide-x lg:divide-rule lg:gap-x-0">
            {AT_A_GLANCE.map(([title, text]) => (
              <li key={title} className="lg:px-6 lg:first:pl-0 lg:last:pr-0">
                <p className="font-semibold">{title}</p>
                <p className="mt-1 text-sm text-body">{text}</p>
              </li>
            ))}
          </ul>
        </div>

        <section id="skills" data-rule="bottom" className={SECTION}>
          <div className={WRAP}>
            <h2 data-reveal className={H2}>Three skills, graded separately</h2>
            <p data-reveal className={LEAD}>
              Each contact is worked in this order, and each step has its own score. A trainee who
              spots everything but responds wrongly shows up as exactly that.
            </p>
            <ol data-reveal-rows className="mt-10 grid gap-10 md:grid-cols-3">
              {SKILLS.map((skill, i) => (
                <li
                  key={skill.name}
                  className={`${CARD} relative md:after:absolute md:after:-right-10 md:after:top-9 md:after:w-10 md:after:text-center md:after:text-xl md:after:text-body md:after:content-['→'] md:last:after:hidden`}
                >
                  <h3 className="flex items-center gap-3 text-xl font-semibold">
                    <span
                      aria-hidden="true"
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-tint text-lg font-bold text-accent"
                    >
                      {i + 1}
                    </span>
                    {skill.name}
                  </h3>
                  <p data-rule="top" className="mt-4 border-t border-rule pt-4">{skill.measures}</p>
                  <p className="mt-3 text-sm text-body">{skill.scored}</p>
                  <p className="mt-3 text-sm">
                    <span className="font-semibold"><Count value={skill.weight} onView /></span> of 100 points
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="decision-table" data-rule="bottom" className={SECTION}>
          <div className={WRAP}>
            <h2 data-reveal className={H2}>The decision table is the marking scheme</h2>
            <p data-reveal className={LEAD}>
              A response is marked against this table and nothing else. It is plain data in the
              source, not a trained model, so an instructor can read, question and change it.
            </p>
            <div className="relative mt-8 overflow-x-auto rounded-xl border border-rule bg-paper px-5 py-2">
              <table className="cards w-full min-w-[40rem] text-left">
                <thead>
                  <tr>
                    <th className={TH}>Contact</th>
                    <th className={TH}>Correct response</th>
                    <th className={`${TH} pr-0`}>Reason</th>
                  </tr>
                </thead>
                <tbody data-reveal-rows>
                  {Object.entries(CORRECT_RESPONSE).map(([droneType, response]) => (
                    <tr key={droneType}>
                      <td data-card-title className={`${TD} whitespace-nowrap`}>{DRONE_LABELS[droneType]}</td>
                      <td data-label="Correct response" className={`${TD} whitespace-nowrap font-semibold`}>{RESPONSE_LABELS[response]}</td>
                      <td data-label="Reason" data-block className={`${TD} pr-0`}>{RATIONALE[droneType]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h3 data-reveal className="mt-12 text-lg font-semibold">How the composite score is built</h3>
            <p data-reveal className={LEAD}>The headline number for a session, from 0 to 100.</p>
            <table className="mt-4 w-full max-w-sm text-left">
              <tbody data-reveal-rows>
                {COMPOSITE.map(([label, points]) => (
                  <tr key={label}>
                    <th scope="row" className="border-b border-rule py-2 pr-5 font-normal">
                      {label}
                    </th>
                    <td className="border-b border-rule py-2 text-right font-semibold">
                      {points < 0 && "−"}
                      <Count value={Math.abs(points)} onView />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section id="live-figures" data-rule="bottom" className={SECTION}>
          <div className={WRAP}>
            <h2 data-reveal className={H2}>What has been recorded so far</h2>
            {!data.ok && (
              <p data-reveal className={LEAD}>
                The training database could not be reached just now, so no figures are shown.
              </p>
            )}
            {data.ok && !hasSessions && (
              <p data-reveal className={LEAD}>
                No sessions have been recorded yet. The figures appear here after the first one is
                run.
              </p>
            )}
            {hasSessions && (
              <>
                <p data-reveal className={LEAD}>
                  Live from the training database, read at {formatDateTime(data.readAt)}.
                </p>
                <dl data-reveal-rows className="mt-10 grid gap-10 sm:grid-cols-3">
                  <Figure
                    label="Sessions recorded"
                    value={<Count value={data.stats.sessions} onView />}
                    note="Every run of the simulator, including misses."
                  />
                  <Figure
                    label="Average composite"
                    value={<Count value={data.stats.avgComposite} onView />}
                    note="Out of 100, across completed sessions."
                  />
                  <Figure
                    label="False positives"
                    value={<Count value={data.stats.falsePositives} onView />}
                    note="Civilian decoys that were engaged."
                  />
                </dl>
              </>
            )}
          </div>
        </section>

        <section id="verdicts" data-rule="bottom" className={SECTION}>
          <div className={WRAP}>
            <h2 data-reveal className={H2}>Every contact ends in a verdict</h2>
            <p data-reveal className={LEAD}>
              This is the record an instructor reviews: what appeared, how fast it was seen, what
              the trainee called it and what they did about it.
              {hasSessions && " The rows below are recent contacts from real sessions, with trainee names withheld."}
            </p>
            {hasSessions ? (
              <div className="relative mt-8 overflow-x-auto rounded-xl border border-rule bg-paper px-5 py-2">
                <table className="cards w-full min-w-[52rem] text-left">
                  <EventTableHead />
                  <tbody data-reveal-rows>
                    {data.sample.map((event, i) => (
                      <EventRow key={i} event={event} />
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p data-reveal className="mt-8 border-y border-rule py-6">
                {data.ok
                  ? "No contacts have been graded yet."
                  : "The sample could not be loaded because the training database is unreachable."}
              </p>
            )}
          </div>
        </section>

        <section
          id="randomisation"
          data-rule="bottom"
          className={SECTION}
        >
          <div className={WRAP}>
            <h2 data-reveal className={H2}>No two sessions are the same</h2>
            <p data-reveal className={LEAD}>
              Each session draws a fresh random seed. Together with the difficulty level, the seed
              decides how many contacts there are, which types, where each one appears and when
              the swarm arrives. A trainee
              cannot learn a layout by heart, because the layout they practised on is not issued
              again.
            </p>
            <p data-reveal className="mt-3 max-w-prose text-body">
              The seed and level are stored with the session, so the same numbers regenerate
              exactly what the trainee saw when an instructor reviews it.
            </p>
            {data.ok && data.layouts.length > 0 && (
              <div className="relative mt-8 overflow-x-auto rounded-xl border border-rule bg-paper px-5 py-2">
                <table className="cards w-full min-w-[52rem] text-left text-sm">
                  <caption className="pb-3 text-left text-body">
                    The most recent stored seeds, one session per row, and the layout each seed
                    regenerates. Times are counted from the start of the session.
                  </caption>
                  <thead>
                    <tr>
                      {SEED_COLUMNS.map((heading) => (
                        <th
                          key={heading}
                          className={`${TH} last:pr-0`}
                        >
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody data-reveal-rows>
                    {data.layouts.map((layout) => (
                      <tr key={layout.seed}>
                        <td data-label={SEED_COLUMNS[0]} className="border-b border-rule py-3 pr-5"><SeedValue seed={layout.seed} /></td>
                        <td data-label={SEED_COLUMNS[1]} className="whitespace-nowrap border-b border-rule py-3 pr-5"><Count value={layout.level} onView /></td>
                        <td data-label={SEED_COLUMNS[2]} className="whitespace-nowrap border-b border-rule py-3 pr-5"><Count value={layout.contacts} onView /></td>
                        <td data-label={SEED_COLUMNS[3]} className="whitespace-nowrap border-b border-rule py-3 pr-5"><Count value={layout.swarmSize} onView /></td>
                        <td data-label={SEED_COLUMNS[4]} className="whitespace-nowrap border-b border-rule py-3 pr-5">
                          {(layout.swarmAtMs / 1000).toFixed(1)} s in
                        </td>
                        <td data-label={SEED_COLUMNS[5]} className="whitespace-nowrap border-b border-rule py-3">
                          {bearing(layout.firstBearingDeg)}, {(layout.firstAtMs / 1000).toFixed(1)} s in
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        <section id="architecture" data-rule="bottom" className={SECTION}>
          <div className={WRAP}>
            <h2 data-reveal className={H2}>Architecture note: identity without a login</h2>
            <p data-reveal className={LEAD}>
              A trainee is picked from a list before a session, and the browser remembers the
              choice. There are deliberately no passwords, no hashing and no login sessions.
            </p>
            <p data-reveal className="mt-3 max-w-prose text-body">
              In a real deployment a trainee&apos;s identity would come from the unit&apos;s own
              system. A second login here would duplicate something the unit already runs, adding
              surface to secure and maintain. The effort went into the scoring and after-action
              review instead. The instructor and trainee views are a
              switch for the same reason: they decide what is shown, not what is permitted.
            </p>
          </div>
        </section>
      </main>

      <footer className="bg-tint text-sm text-body">
        <div className={`${WRAP} flex flex-col gap-x-10 gap-y-1 py-8 sm:flex-row phone:pb-[calc(2rem+env(safe-area-inset-bottom))]`}>
          <span>Smart India Hackathon 2026</span>
          <span>Problem statement SIH26247</span>
          <span>Ministry of Defence, Defence Services Staff College</span>
        </div>
      </footer>
    </>
  );
}
