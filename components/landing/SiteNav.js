'use client';

// Fixed landing-page nav. Two things follow the scroll position: the bar
// switches from the hero's dark ground to paper once the hero has passed, and
// the link for the section being read is marked.

import { useEffect, useState } from 'react';
import Link from 'next/link';

const NAV_HEIGHT = 56;
// A section becomes current once its heading is this far up the viewport.
const READING_LINE = 0.35;

// sections: [[href, label]], in page order
export default function SiteNav({ sections }) {
  const [{ current, onPaper }, setPosition] = useState({ current: null, onPaper: false });

  useEffect(() => {
    let frame = 0;

    function measure() {
      frame = 0;
      const pastHero = document.getElementById('top').getBoundingClientRect().bottom <= NAV_HEIGHT;

      const line = Math.max(NAV_HEIGHT + 24, window.innerHeight * READING_LINE);
      let reading = null;
      for (const [href] of sections) {
        if (document.querySelector(href).getBoundingClientRect().top <= line) reading = href;
      }
      // The last section can be too short to reach the reading line.
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
      if (reading && atBottom) reading = sections[sections.length - 1][0];

      setPosition((prev) =>
        prev.current === reading && prev.onPaper === pastHero ? prev : { current: reading, onPaper: pastHero },
      );
    }

    function schedule() {
      if (!frame) frame = requestAnimationFrame(measure);
    }

    schedule();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, [sections]);

  const ground = onPaper
    ? 'border-ink bg-paper text-ink'
    : 'border-panel-rule bg-panel text-readout [--focus:var(--color-readout)]';

  return (
    <header className={`fixed inset-x-0 top-0 z-20 border-b ${ground}`}>
      <nav aria-label="Primary" className="mx-auto flex h-14 w-full max-w-5xl items-center gap-6 px-6 text-sm">
        <a href="#top" className="font-semibold">
          Counter-drone trainer
        </a>
        <div className="hidden gap-5 lg:flex">
          {sections.map(([href, label]) => {
            const active = href === current;
            return (
              <a
                key={href}
                href={href}
                aria-current={active ? 'location' : undefined}
                className={
                  active
                    ? 'underline decoration-2 underline-offset-8'
                    : 'opacity-70 underline-offset-8 hover:underline'
                }
              >
                {label}
              </a>
            );
          })}
        </div>
        <div className="ml-auto flex items-center gap-5">
          <Link href="/dashboard" className="hidden underline-offset-4 hover:underline sm:inline">
            Review performance
          </Link>
          <Link href="/simulator" className="press border border-current px-3 py-1.5 font-medium">
            Run a session
          </Link>
        </div>
      </nav>
    </header>
  );
}
