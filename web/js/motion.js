/* ==========================================================================
   SyllabusAI — Cinematic Motion Director v2.0
   Boot Sequence · 3D Tilt Physics · Scroll Choreography · Cursor Volumetrics
   ========================================================================== */
(function () {
  'use strict';

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── Build the cinematic stage (aurora, grain, spotlight, boot) ── */
  function buildStage() {
    if (reducedMotion) return;

    const aurora = document.createElement('div');
    aurora.className = 'aurora-field';
    aurora.innerHTML = '<div class="aurora-blob b1"></div><div class="aurora-blob b2"></div><div class="aurora-blob b3"></div>';
    document.body.prepend(aurora);

    const grain = document.createElement('div');
    grain.className = 'film-grain';
    document.body.appendChild(grain);

    const spot = document.createElement('div');
    spot.className = 'cursor-spotlight';
    document.body.appendChild(spot);

    /* The boot title-card is a full-viewport overlay running filtered
       animations for ~4s. It must play ONCE per browser session: replaying it
       on every reload delays first paint behind a heavy composited layer and
       is the single most expensive thing on the page. */
    let bootSeen = false;
    try { bootSeen = sessionStorage.getItem('syllabusai_boot') === '1'; } catch (e) { bootSeen = false; }

    if (!bootSeen) {
      const boot = document.createElement('div');
      boot.className = 'cinema-boot';
      boot.innerHTML =
        '<div class="boot-logo-stage">' +
        '  <div class="boot-emblem">🎓</div>' +
        '  <div class="boot-title">SYLLABUS<span style="opacity:.65">AI</span></div>' +
        '  <div class="boot-sub">Autonomous Academic Agent</div>' +
        '</div>';
      document.body.appendChild(boot);

      try { sessionStorage.setItem('syllabusai_boot', '1'); } catch (e) { /* private mode */ }

      const totalMs = 4100;
      setTimeout(() => {
        boot.classList.add('finished');
        setTimeout(() => boot.remove(), 1100);
      }, totalMs);
    }
  }

    /* ── Cursor volumetrics — spotlight follows the pointer ── */
  /* NOTE: the CSS `.cursor-spotlight` uses `radial-gradient(... at var(--spot-x) var(--spot-y))`.
     The previous JS translated the entire fixed/inset:0 viewport layer on every
     mousemove — shoving a full-screen surface around = massive repaint jitter and
     the gradient origin never actually moved (it was pinned to the CSS var, not the
     transform). Set the variables instead so the compositor only updates one
     radial-gradient position. */
  function initSpotlight() {
    if (reducedMotion) return;
    let raf = null;
    let sx = 50, sy = 40; // default percentages
    const apply = () => {
      raf = null;
      const spot = document.querySelector('.cursor-spotlight');
      if (spot) {
        spot.style.setProperty('--spot-x', sx + '%');
        spot.style.setProperty('--spot-y', sy + '%');
      }
    };
    window.addEventListener('pointermove', (e) => {
      const vw = window.innerWidth || 1;
      const vh = window.innerHeight || 1;
      sx = (e.clientX / vw) * 100;
      sy = (e.clientY / vh) * 100;
      if (!raf) raf = requestAnimationFrame(apply);
    }, { passive: true });
  }

  /* ── 3D tilt physics — cards behave like physical objects ── */
  /* Single source of truth for tilt. three-scene.js's CardTilt3DController
     used to run a SECOND tilt engine over an overlapping selector set
     (`.welcome-hero-card` existed in both), so two handler chains wrote
     `el.style.transform` on the same node every pointermove — each frame the
     loser overwrote the winner (visible jitter) and the extra `scale3d(1.03)`
     forced Chromium to resample the card's text layer permanently (blurry
     labels). All card-sized surfaces are listed here now and nothing else
     touches their transforms. */
  const TILT_SELECTOR = [
    '.question-card', '.flashcard-item', '.stat-card', '.doc-card',
    '.scorecard', '.empty-state-card', '.welcome-hero-card',
    '.transcript-turn-card',
    /* Migrated from three-scene.js CardTilt3DController */
    '.kpi-card', '.prompt-chip', '.podcast-hero-card', '.config-card'
  ].join(', ');

  function initTilt() {
    if (reducedMotion) return;

    const attach = (el) => {
      if (el.dataset.tiltBound) return;
      el.dataset.tiltBound = '1';
      el.setAttribute('data-tilt', '');
      const glare = document.createElement('div');
      glare.className = 'tilt-glare';
      el.appendChild(glare);

      let raf = null;
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        el.classList.add('tilt-engaged');
        /* `will-change` is only useful while the element is actually
           animating. Leaving it on permanently promoted every card to its
           own GPU layer for the life of the page — enough layers and the
           compositor starts rasterizing text at reduced quality, which is
           the classic "everything looks progressively blurrier" symptom. */
        el.style.willChange = 'transform';
        if (raf) return;
        raf = requestAnimationFrame(() => {
          raf = null;
          const maxTilt = 7;
          /* NOTE: no `scale()` here on purpose. A fractional scale forced
             Chromium to resample the card's text layer every frame, so
             labels stayed visibly soft the whole time the tilt was engaged.
             Pure rotation keeps glyphs pixel-aligned and razor sharp while
             still reading as a genuine 3D object. */
          el.style.transform =
            'perspective(900px) rotateX(' + ((0.5 - py) * maxTilt).toFixed(2) + 'deg)' +
            ' rotateY(' + ((px - 0.5) * maxTilt).toFixed(2) + 'deg)';
          el.style.setProperty('--gx', (px * 100).toFixed(1) + '%');
          el.style.setProperty('--gy', (py * 100).toFixed(1) + '%');
        });
      }, { passive: true });

      el.addEventListener('pointerleave', () => {
        el.classList.remove('tilt-engaged');
        el.style.transform = '';
        el.style.willChange = '';
      });
    };

    document.querySelectorAll(TILT_SELECTOR).forEach(attach);

    /* Future dynamic content (quiz renders, flashcard decks, chat bubbles) */
    const mo = new MutationObserver(() => {
      document.querySelectorAll(TILT_SELECTOR).forEach(attach);
    });
    mo.observe(document.body, { childList: true, subtree: true });
  }

  /* ── Scroll choreography — staggered reveals on entry ── */
  function initReveals() {
    if (reducedMotion || !('IntersectionObserver' in window)) return;

    const finish = (el) => {
      /* Once the entrance has played, strip every choreography class so the
         element returns to a plain 2D box. This is what guarantees text can
         never stay soft/blurry from a lingering filter or transform layer. */
      el.classList.add('reveal-done');
      el.classList.remove('reveal', 'revealed', 'from-left', 'from-right');
    };

    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) {
          const el = en.target;
          el.classList.add('revealed');
          io.unobserve(el);
          const delay = 800 + (parseInt(el.style.getPropertyValue('--reveal-order'), 10) || 0) * 80;
          setTimeout(() => finish(el), delay);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });

    const stamp = (el) => {
      if (el.dataset.revealBound) return;
      el.dataset.revealBound = '1';
      el.classList.add('reveal');
      io.observe(el);
      /* FAILSAFE: content inside a tab that never becomes visible, or an
         observer that never fires, must still resolve to fully visible. */
      setTimeout(() => {
        if (el.classList.contains('reveal') && !el.classList.contains('revealed')) {
          finish(el);
        }
      }, 3500);
    };

    const scan = () => {
      ['.question-card', '.flashcard-item', '.stat-card', '.doc-card',
       '.transcript-turn-card', '.welcome-hero-card'].forEach((sel) => {
        document.querySelectorAll(sel).forEach((el, i) => {
          stamp(el);
          el.style.setProperty('--reveal-order', String(i % 8));
        });
      });
    };
    scan();
    new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
  }

  /* ── Parallax aurora — background responds to scroll depth ── */
  function initParallax() {
    if (reducedMotion) return;
    let ticking = false;
    window.addEventListener('scroll', () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        const f = document.querySelector('.aurora-field');
        if (f) f.style.transform = 'translateY(' + (window.scrollY * -0.04) + 'px)';
      });
    }, { passive: true });
  }

  /* ── Boot everything after DOM is ready ── */
  function start() {
    buildStage();
    initSpotlight();
    initTilt();
    initReveals();
    initParallax();
    document.documentElement.classList.add('cinema-ready');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
