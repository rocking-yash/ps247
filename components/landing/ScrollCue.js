'use client';

// A quiet chevron at the foot of the hero: there is more below. It is
// decoration, so it is hidden from assistive technology, and it fades out as
// soon as the page has been scrolled at all.

import { useEffect, useState } from 'react';

export default function ScrollCue() {
  const [gone, setGone] = useState(false);

  useEffect(() => {
    const onScroll = () => setGone(window.scrollY > 4);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <span aria-hidden="true" data-gone={gone ? '' : undefined} className="scroll-cue">
      <svg width="20" height="12" viewBox="0 0 20 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 2l8 8 8-8" />
      </svg>
    </span>
  );
}
