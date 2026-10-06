'use client';

// Fixed landing-page nav. Three things follow the scroll position: the bar is
// clear over the hero's scene, with ink links, and takes a solid ground with
// a hairline once the hero has passed; the link for the section being read is marked; and a 2px
// bar along the very top fills as the page is read.
//
// On a phone the section links move into a full-screen menu behind a button,
// and the two actions stay in the bar under shorter labels.

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { PHONE_QUERY } from '@/lib/usePhone';

const NAV_HEIGHT = 56;
// A section becomes current once its heading is this far up the viewport.
const READING_LINE = 0.35;

// sections: [[href, label]], in page order
export default function SiteNav({ sections }) {
  const [{ current, onPaper }, setPosition] = useState({ current: null, onPaper: false });
  const progress = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);

  // While the menu covers the page: the page behind does not scroll, Escape
  // closes it, and so does the screen ceasing to be phone-sized.
  useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(false);
    const onKey = (e) => {
      if (e.key === 'Escape') close();
    };
    const phone = window.matchMedia(PHONE_QUERY);
    document.documentElement.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    phone.addEventListener('change', close);
    return () => {
      document.documentElement.style.overflow = '';
      document.removeEventListener('keydown', onKey);
      phone.removeEventListener('change', close);
    };
  }, [menuOpen]);

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
      className="fixed inset-x-0 top-0 z-20 border-b border-transparent text-ink phone:pl-[env(safe-area-inset-left)] phone:pr-[env(safe-area-inset-right)] phone:pt-[env(safe-area-inset-top)]"
    >
      {/* The solid ground and its hairline fade in as one layer. */}
      <div
        aria-hidden="true"
        className={`absolute inset-x-0 -bottom-px top-0 border-b border-rule bg-paper transition-opacity duration-300 motion-reduce:transition-none ${
          onPaper || menuOpen ? 'opacity-100' : 'opacity-0'
        }`}
      />
      <div
        ref={progress}
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-0.5 origin-left scale-x-0 bg-ink"
      />
      <nav aria-label="Primary" className="relative mx-auto flex h-14 w-full max-w-6xl items-center gap-6 px-6 text-sm phone:gap-3 phone:px-4">
        <a href="#top" className="text-base font-bold tracking-tight phone:min-w-0 phone:truncate phone:leading-[2.75rem]">
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
                className={active ? 'link-wipe font-medium' : onPaper ? 'link-wipe text-body' : 'link-wipe'}
              >
                {label}
              </a>
            );
          })}
        </div>
        <div className="ml-auto flex items-center gap-3 phone:shrink-0 phone:gap-2">
          <Link href="/dashboard" className="press hidden border border-rule bg-paper px-4 py-2 font-medium sm:inline phone:hidden!">
            Review performance
          </Link>
          <Link href="/simulator" className="press bg-accent px-4 py-2 font-medium text-white phone:hidden!">
            Run a session
          </Link>
          {/* Phones: the same two actions under shorter labels, then the menu button. */}
          <Link href="/dashboard" aria-label="Review performance" className="press hidden border border-rule bg-paper px-3 py-2 font-medium phone:inline-flex">
            Review
          </Link>
          <Link href="/simulator" aria-label="Run a session" className="press hidden bg-accent px-3 py-2 font-medium text-white phone:inline-flex">
            Run
          </Link>
          <button
            type="button"
            aria-expanded={menuOpen}
            aria-controls="site-menu"
            aria-label={menuOpen ? 'Close the menu' : 'Open the menu'}
            onClick={() => setMenuOpen(!menuOpen)}
            className="press hidden h-11 w-11 items-center justify-center border border-rule bg-paper phone:inline-flex"
          >
            <svg aria-hidden="true" width="18" height="14" viewBox="0 0 18 14" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
              {menuOpen ? <path d="M3 1l12 12M15 1L3 13" /> : <path d="M1 1h16M1 7h16M1 13h16" />}
            </svg>
          </button>
        </div>
      </nav>
      {menuOpen && (
        <div
          id="site-menu"
          className="relative hidden h-[calc(100dvh-3.5rem-env(safe-area-inset-top))] flex-col overflow-y-auto border-t border-rule bg-paper px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-2 phone:flex"
        >
          <ul>
            {sections.map(([href, label]) => (
              <li key={href} className="border-b border-rule">
                <a
                  href={href}
                  aria-current={href === current ? 'location' : undefined}
                  onClick={() => setMenuOpen(false)}
                  className={`flex min-h-14 items-center text-lg ${href === current ? 'font-semibold' : ''}`}
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>
          <div className="mt-6 flex flex-col gap-3">
            <Link href="/simulator" className="press bg-accent px-5 py-3 text-base font-medium text-white">
              Run a session
            </Link>
            <Link href="/dashboard" className="press border border-rule bg-paper px-5 py-3 text-base font-medium">
              Review performance
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
