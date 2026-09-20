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

    const boot = document.createElement('div');
    boot.className = 'cinema-boot';
    boot.innerHTML =
      '<div class="boot-logo-stage">' +
      '  <div class="boot-emblem">🎓</div>' +
      '  <div class="boot-title">SYLLABUS<span style="opacity:.65">AI</span></div>' +
      '  <div class="boot-sub">Autonomous Academic Agent</div>' +
      '</div>';
    document.body.appendChild(boot);

    const totalMs = 4100;
    setTimeout(() => {
      boot.classList.add('finished');
      setTimeout(() => boot.remove(), 1100);
    }, totalMs);
  }

  /* ── Cursor volumetrics — spotlight follows the pointer ── */
  function initSpotlight() {
    if (reducedMotion) return;
    let raf = null;
    let mx = window.innerWidth / 2, my = window.innerHeight * 0.4;
    const apply = () => {
      raf = null;
      const spot = document.querySelector('.cursor-spotlight');
      if (spot) spot.style.transform = 'translate(' + mx + 'px, ' + my + 'px) translate(-50%, -50%)';
    };
    window.addEventListener('pointermove', (e) => {
      mx = e.clientX; my = e.clientY;
      if (!raf) raf = requestAnimationFrame(apply);
    }, { passive: true });
  }

  /* ── 3D tilt physics — cards behave like physical objects ── */
  const TILT_SELECTOR = [
    '.question-card', '.flashcard-item', '.stat-card', '.doc-card',
    '.scorecard', '.empty-state-card', '.welcome-hero-card',
    '.transcript-turn-card'
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
        if (raf) return;
        raf = requestAnimationFrame(() => {
          raf = null;
          const maxTilt = 7;
          el.style.transform =
            'perspective(900px) rotateX(' + ((0.5 - py) * maxTilt).toFixed(2) + 'deg)' +
            ' rotateY(' + ((px - 0.5) * maxTilt).toFixed(2) + 'deg)' +
            ' translateZ(10px) scale(1.012)';
          el.style.setProperty('--gx', (px * 100).toFixed(1) + '%');
          el.style.setProperty('--gy', (py * 100).toFixed(1) + '%');
        });
      }, { passive: true });

      el.addEventListener('pointerleave', () => {
        el.classList.remove('tilt-engaged');
        el.style.transform = '';
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
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) {
          en.target.classList.add('revealed');
          io.unobserve(en.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });

    const stamp = (el) => {
      if (el.dataset.revealBound) return;
      el.dataset.revealBound = '1';
      el.classList.add('reveal');
      io.observe(el);
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
