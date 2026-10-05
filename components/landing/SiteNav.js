'use client';

// Fixed landing-page nav. Three things follow the scroll position: the bar is
// clear over the dark hero and takes a paper ground with a hairline once the
// hero has passed; the link for the section being read is marked; and a 2px
// bar along the very top fills as the page is read.

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

const NAV_HEIGHT = 56;
// A section becomes current once its heading is this far up the viewport.
const READING_LINE = 0.35;

// sections: [[href, label]], in page order
export default function SiteNav({ sections }) {
  const [{ current, onPaper }, setPosition] = useState({ current: null, onPaper: false });
  const progress = useRef(null);

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
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      if (reading && window.scrollY >= scrollable - 2) reading = sections[sections.length - 1][0];

      // Written straight to the element: it changes every frame while scrolling.
      const read = scrollable > 0 ? Math.min(1, window.scrollY / scrollable) : 0;
      progress.current.style.transform = `scaleX(${read.toFixed(4)})`;

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

  return (
    <header
      className={`fixed inset-x-0 top-0 z-20 border-b border-transparent transition-colors duration-300 motion-reduce:transition-none ${
        onPaper ? 'text-ink' : 'text-readout [--focus:var(--color-readout)]'
      }`}
    >
      {/* The solid ground and its hairline fade in as one layer. */}
      <div
        aria-hidden="true"
        className={`absolute inset-x-0 -bottom-px top-0 border-b border-ink bg-paper transition-opacity duration-300 motion-reduce:transition-none ${
          onPaper ? 'opacity-100' : 'opacity-0'
        }`}
      />
      <div
        ref={progress}
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-0.5 origin-left scale-x-0 bg-ink"
      />
      <nav aria-label="Primary" className="relative mx-auto flex h-14 w-full max-w-5xl items-center gap-6 px-6 text-sm">
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
                className={active ? 'link-wipe' : 'link-wipe opacity-70'}
              >
                {label}
              </a>
            );
          })}
        </div>
        <div className="ml-auto flex items-center gap-5">
          <Link href="/dashboard" className="link-wipe hidden sm:inline">
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
