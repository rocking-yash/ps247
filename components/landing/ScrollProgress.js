'use client';

// A section whose scroll position is exposed to CSS as --p, running 0 → 1
// while its [data-sticky] child is pinned under the nav. Everything inside is
// styled from --p (the scrub-* utilities in globals.css), so it reverses
// exactly when scrolled back and nothing runs unless the page is scrolling.
//
// With `horizontal`, the [data-track] child is measured too: --max is how far
// it overflows, and the section is made exactly that much taller so the track
// travels sideways at the speed the page scrolls down.
//
// With reduced motion nothing is set at all; the CSS then lays the content
// out statically.

import { useEffect, useRef } from 'react';

const NAV_HEIGHT = 56;

export default function ScrollProgress({ horizontal = false, children, ...rest }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    const sticky = el.querySelector('[data-sticky]');
    const track = horizontal ? el.querySelector('[data-track]') : null;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;

    function update() {
      frame = 0;
      if (reduce.matches) return;
      const travel = el.offsetHeight - sticky.offsetHeight;
      const done = travel > 0 ? (NAV_HEIGHT - el.getBoundingClientRect().top) / travel : 0;
      el.style.setProperty('--p', Math.min(1, Math.max(0, done)).toFixed(4));
    }

    function measure() {
      if (reduce.matches) {
        for (const property of ['height', '--p', '--max']) el.style.removeProperty(property);
        return;
      }
      if (track) {
        const max = Math.max(0, track.scrollWidth - track.parentElement.clientWidth);
        el.style.setProperty('--max', String(max));
        el.style.height = `${sticky.offsetHeight + max}px`;
      }
      update();
    }

    function schedule() {
      if (!frame) frame = requestAnimationFrame(update);
    }

    measure();
    document.fonts?.ready.then(measure);  // text reflows once the face arrives
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', measure);
    reduce.addEventListener('change', measure);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', measure);
      reduce.removeEventListener('change', measure);
    };
  }, [horizontal]);

  return (
    <section ref={ref} {...rest}>
      {children}
    </section>
  );
}
