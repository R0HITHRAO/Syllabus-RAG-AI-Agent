/* ==========================================================================
   SyllabusAI — Three.js 3D Universe Scene Controller
   Handles WebGL Background, Card Tilt Physics & Tab Slide Director
   ========================================================================== */

/* ── ThreeSceneController ────────────────────────────────────────────────── */
class ThreeSceneController {
  constructor() {
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.clock = null;
    this.animId = null;

    /* scene objects */
    this.nodes = [];
    this.orbitalRings = [];
    this.particles = null;
    this.particleMaterial = null;

    /* mouse parallax */
    this.mouse = { x: 0, y: 0 };
    this.targetCam = { x: 0, y: 0 };

    /* tab camera positions */
    this.tabCamTargets = {
      'tab-chat':       { x:  0.0, y:  0.0, z: 60 },
      'tab-podcast':    { x:  3.0, y: -2.0, z: 58 },
      'tab-exam':       { x: -3.0, y:  2.0, z: 56 },
      'tab-docs':       { x:  2.0, y:  3.0, z: 62 },
      'tab-flashcards': { x: -2.0, y: -1.0, z: 58 },
      'tab-graph':      { x:  1.0, y: -3.0, z: 55 },
      'tab-analytics':  { x: -1.0, y:  1.5, z: 60 }
    };
    this.currentCamTarget = { ...this.tabCamTargets['tab-chat'] };
    this.warpEffect = false;

    this._boundResize = this._onResize.bind(this);
    this._boundMouse  = this._onMouseMove.bind(this);
    this._boundVisibility = this._onVisibilityChange.bind(this);
  }

  init() {
    if (!window.THREE) return;
    const container = document.getElementById('three-canvas-container');
    if (!container) return;

    const THREE = window.THREE;
    this.THREE = THREE;

    /* Scene */
    this.scene = new THREE.Scene();
    this.clock  = new THREE.Clock();

    /* Camera */
    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.camera.position.set(0, 0, 60);

    /* Renderer
       ─────────────────────────────────────────────────────────────────────
       antialias is intentionally OFF: this canvas is a decorative backdrop
       that always sits behind a blurred aurora and frosted content, so MSAA
       cost bought nothing visible while roughly doubling per-frame GPU work.
       pixelRatio is capped at 1.5 (not 2) — a 2x stretched full-screen canvas
       plus the aurora, grain and spotlight layers saturated the compositor
       and made the browser shed raster quality on *content* layers, which is
       what read as "the whole screen keeps getting blurrier". */
    this.renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setClearColor(0x000000, 0);
    container.appendChild(this.renderer.domElement);

    this._buildScene();
    this._buildParticles();
    this._buildAmbientLight();

    window.addEventListener('resize', this._boundResize);
    window.addEventListener('mousemove', this._boundMouse);
    document.addEventListener('visibilitychange', this._boundVisibility);

    /* Pause the loop entirely whenever the backdrop is scrolled out of view
       or its container is hidden. Previously it rendered forever even when
       nothing was on screen, stealing GPU time from the rest of the page. */
    this._bindViewportPause(container);

    this._lastFrame = 0;
    this._frameBudget = 1000 / 30; /* cinematic 30fps cap — halves GPU load */
    this._animate();
  }

  /* ── Viewport-aware pause ───────────────────────────────────────────── */
  _bindViewportPause(container) {
    if (!('IntersectionObserver' in window)) return;
    try {
      this._io = new IntersectionObserver((entries) => {
        const visible = entries.some((e) => e.isIntersecting);
        if (visible && this._paused) {
          this._paused = false;
          this.clock.start();
          this._animate();
        } else if (!visible) {
          this._paused = true;
          cancelAnimationFrame(this.animId);
        }
      }, { threshold: 0 });
      this._io.observe(container);
    } catch (e) { /* non-fatal */ }
  }

  /* ── Scene Construction ─────────────────────────────────────────────── */
  _buildScene() {
    const THREE = this.THREE;
    const accentColors = [0x6366f1, 0x8b5cf6, 0x06b6d4, 0x10b981, 0xf59e0b];

    /* Floating knowledge nodes (icosahedrons + dodecahedrons) */
    const geoTypes = [
      new THREE.IcosahedronGeometry(1.2, 0),
      new THREE.OctahedronGeometry(1.0, 0),
      new THREE.TetrahedronGeometry(1.1, 0),
    ];

    for (let i = 0; i < 22; i++) {
      const geo  = geoTypes[i % geoTypes.length];
      const color = accentColors[i % accentColors.length];
      const mat  = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.18,
        metalness: 0.8,
        roughness: 0.25,
        wireframe: Math.random() > 0.5,
        transparent: true,
        opacity: 0.55 + Math.random() * 0.25,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(
        (Math.random() - 0.5) * 90,
        (Math.random() - 0.5) * 70,
        (Math.random() - 0.5) * 40 - 20
      );
      mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
      mesh.userData = {
        rotSpeed: (Math.random() - 0.5) * 0.008,
        floatSpeed: 0.3 + Math.random() * 0.5,
        floatAmp:   0.6 + Math.random() * 0.8,
        floatOffset: Math.random() * Math.PI * 2,
        originY: mesh.position.y,
      };
      this.scene.add(mesh);
      this.nodes.push(mesh);
    }

    /* Orbital glowing rings */
    for (let i = 0; i < 4; i++) {
      const color  = accentColors[i % accentColors.length];
      const radius = 10 + i * 7;
      const geo    = new THREE.TorusGeometry(radius, 0.06, 8, 80);
      const mat    = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.6,
        transparent: true,
        opacity: 0.22,
      });
      const ring = new THREE.Mesh(geo, mat);
      ring.rotation.x = Math.PI / 2 + (Math.random() - 0.5) * 0.9;
      ring.rotation.y = (Math.random() - 0.5) * 0.9;
      ring.position.set(
        (Math.random() - 0.5) * 20,
        (Math.random() - 0.5) * 15,
        -20 + i * -5
      );
      ring.userData = { rotSpeed: 0.003 + Math.random() * 0.004, axis: i % 2 === 0 ? 'y' : 'x' };
      this.scene.add(ring);
      this.orbitalRings.push(ring);
    }
  }

  _buildParticles() {
    const THREE = this.THREE;
    const count  = 1800;
    const geo    = new THREE.BufferGeometry();
    const pos    = new Float32Array(count * 3);

    for (let i = 0; i < count * 3; i++) {
      pos[i] = (Math.random() - 0.5) * 240;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));

    this.particleMaterial = new THREE.PointsMaterial({
      color: 0x8b9fd4,
      size: 0.28,
      transparent: true,
      opacity: 0.55,
      sizeAttenuation: true,
    });

    this.particles = new THREE.Points(geo, this.particleMaterial);
    this.scene.add(this.particles);
  }

  _buildAmbientLight() {
    const THREE = this.THREE;
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.55));

    const pt1 = new THREE.PointLight(0x6366f1, 2.5, 120);
    pt1.position.set(30, 20, 30);
    this.scene.add(pt1);

    const pt2 = new THREE.PointLight(0x06b6d4, 2.0, 100);
    pt2.position.set(-30, -20, 20);
    this.scene.add(pt2);
  }

  /* ── Animation Loop ─────────────────────────────────────────────────── */
  _animate(now) {
    this.animId = requestAnimationFrame((t) => this._animate(t));
    if (this._paused) return;

    /* 30fps frame budget: skip the whole update+draw on in-between frames.
       The motion is slow ambient drift, so halving the rate is invisible
       while freeing half the GPU time for text rasterization & scrolling. */
    if (now !== undefined) {
      if (now - (this._lastFrame || 0) < this._frameBudget) return;
      this._lastFrame = now;
    }

    const elapsed = this.clock.getElapsedTime();

    /* Float & rotate nodes */
    this.nodes.forEach(m => {
      m.rotation.x += m.userData.rotSpeed;
      m.rotation.y += m.userData.rotSpeed * 0.7;
      m.position.y = m.userData.originY +
        Math.sin(elapsed * m.userData.floatSpeed + m.userData.floatOffset) * m.userData.floatAmp;
    });

    /* Spin rings */
    this.orbitalRings.forEach(r => {
      if (r.userData.axis === 'y') r.rotation.y += r.userData.rotSpeed;
      else r.rotation.x += r.userData.rotSpeed;
    });

    /* Rotate particle field slowly */
    if (this.particles) {
      this.particles.rotation.y = elapsed * 0.012;
    }

    /* Warp pulse on tab switch */
    if (this.warpEffect) {
      this.particleMaterial.size = 0.28 + Math.sin(elapsed * 20) * 0.18;
    }

    /* Smooth camera lerp: mouse parallax + tab target */
    this.targetCam.x += (this.mouse.x * 5 - this.targetCam.x) * 0.04;
    this.targetCam.y += (-this.mouse.y * 3 - this.targetCam.y) * 0.04;

    const ct = this.currentCamTarget;
    this.camera.position.x += (ct.x + this.targetCam.x - this.camera.position.x) * 0.03;
    this.camera.position.y += (ct.y + this.targetCam.y - this.camera.position.y) * 0.03;
    this.camera.position.z += (ct.z - this.camera.position.z) * 0.03;
    this.camera.lookAt(0, 0, 0);

    this.renderer.render(this.scene, this.camera);
  }

  /* ── Public API ─────────────────────────────────────────────────────── */
  goToTab(tabId) {
    if (this.tabCamTargets[tabId]) {
      this.currentCamTarget = { ...this.tabCamTargets[tabId] };
    }
    /* Brief warp flash */
    this.warpEffect = true;
    setTimeout(() => { this.warpEffect = false; if (this.particleMaterial) this.particleMaterial.size = 0.28; }, 600);
  }

  /* ── Handlers ────────────────────────────────────────────────────────── */
  _onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  _onMouseMove(e) {
    this.mouse.x = (e.clientX / window.innerWidth)  - 0.5;
    this.mouse.y = (e.clientY / window.innerHeight) - 0.5;
  }

  _onVisibilityChange() {
    if (document.hidden) {
      cancelAnimationFrame(this.animId);
    } else {
      this.clock.start();
      this._animate();
    }
  }
}

/* ── CardTilt3DController ────────────────────────────────────────────────── */
class CardTilt3DController {
  constructor() {
    this._bound = new Map();
    this._selectors = [
      '.welcome-hero-card',
      '.prompt-chip',
      '.glass-surface',
      '.kpi-card',
      '.flashcard-card',
      '.podcast-hero-card',
      '.config-card',
    ];
    this._observe();
  }

  _observe() {
    /* Attach to existing elements */
    this._attachAll();
    /* Watch DOM mutations for dynamically added elements */
    const mo = new MutationObserver(() => this._attachAll());
    mo.observe(document.body, { childList: true, subtree: true });
  }

  _attachAll() {
    this._selectors.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => {
        if (el.dataset.tiltAttached) return;
        el.dataset.tiltAttached = '1';
        this._attach(el);
      });
    });
  }

  _attach(el) {
    /* ── Consolidated tilt — this controller is now inert on purpose ───────
       motion.js owns the single 3D tilt engine (rAF-throttled, one writer,
       hover-only `will-change`). This class previously ran a competing tilt:
       two handler chains wrote `el.style.transform` on the same element every
       pointermove, so they overwrote each other frame-by-frame (jitter), and
       its permanent `will-change: transform` + `scale3d(1.03)` forced
       Chromium to rasterize each card's text into a scaled GPU layer — the
       root cause of text that looked soft/blurry and kept getting worse as
       more cards mounted.

       We keep the class and its MutationObserver so nothing else has to
       change, but attaching now means "handled", not "add another
       transform writer". The card-sized selectors it used to cover
       (.kpi-card, .prompt-chip, .podcast-hero-card, .config-card,
       .welcome-hero-card) are all in motion.js's TILT_SELECTOR.
       `.glass-surface` is deliberately NOT tilted: it is applied to 15
       full-width panel containers, and tilting whole panels is what made
       the page feel like it was swimming. */
    el.dataset.tiltDelegated = '1';
    this._bound.set(el, { delegated: true });
  }
}

/* ── DirectionalTabSlideManager ─────────────────────────────────────────── */
class DirectionalTabSlideManager {
  constructor(syllabusApp, threeScene) {
    this.app = syllabusApp;
    this.three = threeScene;

    this.tabOrder = ['tab-chat','tab-podcast','tab-exam','tab-docs','tab-flashcards','tab-graph','tab-analytics'];
    this.currentTabId = 'tab-chat';
    this.isAnimating = false;

    /* Sliding pill indicator */
    this.pill = document.querySelector('.tab-slider-pill');
    this._movePillToActive();
  }

  switchTo(tabId) {
    if (tabId === this.currentTabId || this.isAnimating) return;
    this.isAnimating = true;

    const prevIdx = this.tabOrder.indexOf(this.currentTabId);
    const nextIdx = this.tabOrder.indexOf(tabId);
    const direction = nextIdx > prevIdx ? 'right' : 'left';

    const allPanes = document.querySelectorAll('.tab-pane');
    const prevPane = document.getElementById(this.currentTabId);
    const nextPane = document.getElementById(tabId);

    /* Exit previous */
    if (prevPane) {
      prevPane.classList.add(direction === 'right' ? 'slide-exit-left' : 'slide-exit-right');
      prevPane.addEventListener('animationend', () => {
        prevPane.classList.remove('active', 'slide-exit-left', 'slide-exit-right');
      }, { once: true });
    }

    /* Enter next */
    if (nextPane) {
      nextPane.classList.add('active', direction === 'right' ? 'slide-enter-right' : 'slide-enter-left');
      nextPane.addEventListener('animationend', () => {
        nextPane.classList.remove('slide-enter-right', 'slide-enter-left');
        this.isAnimating = false;
      }, { once: true });
    }

    /* Update tab buttons */
    document.querySelectorAll('.tab-nav-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.tab === tabId);
    });

    this.currentTabId = tabId;
    this._movePillToActive();

    /* Trigger Three.js camera move */
    if (this.three) this.three.goToTab(tabId);

    /* Graph + analytics side effects */
    if (tabId === 'tab-graph') {
      this.app?.graph?.resizeCanvas?.();
      this.app?.graph?.fetchGraphData?.();
    }
    if (tabId === 'tab-analytics') {
      this.app?.analytics?.fetchAnalytics?.();
    }
  }

  _movePillToActive() {
    if (!this.pill) return;
    const activeBtn = document.querySelector(`.tab-nav-btn[data-tab="${this.currentTabId}"]`);
    if (!activeBtn) return;
    const navBar = document.querySelector('.tabs-nav-bar');
    if (!navBar) return;
    const btnRect = activeBtn.getBoundingClientRect();
    const barRect = navBar.getBoundingClientRect();
    this.pill.style.width  = `${btnRect.width}px`;
    this.pill.style.left   = `${btnRect.left - barRect.left}px`;
  }
}

/* ── Init after DOM is ready ─────────────────────────────────────────────── */
window.__SyllabusAI_3D = {};

document.addEventListener('DOMContentLoaded', () => {
  /* Card tilt attaches immediately — no Three.js dependency */
  window.__SyllabusAI_3D.tilt = new CardTilt3DController();
});

/* Called from app.js after SyllabusApp is instantiated */
window.init3DScene = function(syllabusAppInstance) {
  if (!syllabusAppInstance) return;
  const scene = new ThreeSceneController();
  scene.init();
  window.__SyllabusAI_3D.scene = scene;

  const slideManager = new DirectionalTabSlideManager(syllabusAppInstance, scene);
  window.__SyllabusAI_3D.slideManager = slideManager;

  /* Patch SyllabusApp.switchTab to route through slide manager */
  if (syllabusAppInstance) {
    const originalSwitchTab = syllabusAppInstance.switchTab.bind(syllabusAppInstance);
    syllabusAppInstance.switchTab = function(tabId) {
      /* Use slide manager for animated switch */
      slideManager.switchTo(tabId);
    };

    /* Re-bind tab nav buttons to use new switchTab */
    document.querySelectorAll('.tab-nav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        syllabusAppInstance.switchTab(btn.dataset.tab);
      });
    });
  }

  /* Re-position pill on window resize */
  window.addEventListener('resize', () => slideManager._movePillToActive());
};

/* ── Self-boot if app.js already ran DOMContentLoaded ───────────────────── */
if (window.__pendingInit3D) {
  window.init3DScene(window.__pendingInit3D);
  delete window.__pendingInit3D;
}
