'use client';

// Scroll motion for the landing page. It adds behaviour only: the elements it
// moves are marked in the page with data attributes, and the styling is in
// globals.css under .reveal-ready.
//
//   [data-reveal]            fades up once when it first enters the viewport
//   [data-reveal-rows] > *   the same, for each row or item of a list or table
//   [data-rule="top"]        its top hairline draws in from the left
//   [data-rule="bottom"]     its bottom hairline draws in, once that edge is on screen
//   .count-on-view           a figure that counts up from zero when first seen
//   [data-parallax]          the hero content, which trails the page slightly
//
// Everything is triggered by IntersectionObserver and happens once. Elements
// that arrive together are staggered in document order, so a section comes
// in heading first, then body, then rows. With reduced motion none of this
// runs: everything is simply there in its final state.

import { useEffect } from 'react';

const REVEALS = '[data-reveal], [data-reveal-rows] > *';
const MAX_STAGGER_STEPS = 8;
const STAGGER_MS = { block: 60, row: 50, rule: 80 };
// The hero content moves down by this share of the scroll, up to the limit,
// which makes it leave the screen a little slower than the page.
const PARALLAX_RATE = 0.12;
const PARALLAX_LIMIT_PX = 48;
// Fine enough steps that a tall section's bottom edge is caught as it arrives.
const EDGE_THRESHOLDS = Array.from({ length: 21 }, (_, i) => i / 20);

const inDocumentOrder = (a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1);
const delay = (i, step) => `${Math.min(i, MAX_STAGGER_STEPS) * step}ms`;

export default function ScrollMotion() {
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    let stop = () => {};

    function start() {
      stop();
      if (reduce.matches) return;

      const root = document.documentElement;
      const reveals = [...document.querySelectorAll(REVEALS)];
      const rules = [...document.querySelectorAll('[data-rule]')];
      const figures = [...document.querySelectorAll('.count-on-view')];
      const hero = document.querySelector('[data-parallax]');
      const observers = [];

      // Runs `mark` once on each element as it comes into view, staggering
      // those that arrive in the same moment. `ready` can hold one back.
      function onEnter(elements, mark, options, ready = () => true) {
        const observer = new IntersectionObserver((entries) => {
          const entering = entries.filter((e) => e.isIntersecting && ready(e)).map((e) => e.target).sort(inDocumentOrder);
          entering.forEach((el, i) => {
            mark(el, i);
            observer.unobserve(el);
          });
        }, options);
        for (const el of elements) observer.observe(el);
        observers.push(observer);
      }

      // Whatever is already on screen, or above it, is shown as it is.
      for (const el of reveals) {
        if (el.getBoundingClientRect().top < window.innerHeight) el.dataset.revealed = 'instant';
      }
      root.classList.add('reveal-ready');

      onEnter(
        reveals.filter((el) => !('revealed' in el.dataset)),
        (el, i) => {
          el.style.setProperty('--reveal-delay', delay(i, el.tagName === 'TR' ? STAGGER_MS.row : STAGGER_MS.block));
          el.dataset.revealed = '';
        },
        { rootMargin: '0px 0px -8% 0px' },
      );

      onEnter(
        rules.filter((el) => el.dataset.rule === 'top'),
        (el, i) => {
          el.style.setProperty('--rule-delay', delay(i, STAGGER_MS.rule));
          el.dataset.ruled = '';
        },
        { rootMargin: '0px 0px -8% 0px' },
      );

      // A bottom rule waits until the bottom edge itself is on screen.
      onEnter(
        rules.filter((el) => el.dataset.rule === 'bottom'),
        (el) => {
          el.dataset.ruled = '';
        },
        { threshold: EDGE_THRESHOLDS },
        (entry) => entry.boundingClientRect.bottom <= (entry.rootBounds?.bottom ?? window.innerHeight),
      );

      onEnter(figures, (el) => {
        el.dataset.counted = '';
      }, { rootMargin: '0px 0px -8% 0px' });

      let frame = 0;
      function drift() {
        frame = 0;
        const y = Math.min(PARALLAX_LIMIT_PX, window.scrollY * PARALLAX_RATE);
        hero.style.transform = `translate3d(0, ${y.toFixed(1)}px, 0)`;
      }
      function onScroll() {
        if (!frame) frame = requestAnimationFrame(drift);
      }
      if (hero) {
        drift();
        window.addEventListener('scroll', onScroll, { passive: true });
      }

      stop = () => {
        for (const observer of observers) observer.disconnect();
        window.removeEventListener('scroll', onScroll);
        cancelAnimationFrame(frame);
        root.classList.remove('reveal-ready');
        if (hero) hero.style.transform = '';
        for (const el of reveals) {
          delete el.dataset.revealed;
          el.style.removeProperty('--reveal-delay');
        }
        for (const el of rules) {
          delete el.dataset.ruled;
          el.style.removeProperty('--rule-delay');
        }
        for (const el of figures) delete el.dataset.counted;
      };
    }

    start();
    reduce.addEventListener('change', start);
    return () => {
      reduce.removeEventListener('change', start);
      stop();
    };
  }, []);

  return null;
}
