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

    /* Renderer */
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setClearColor(0x000000, 0);
    container.appendChild(this.renderer.domElement);

    this._buildScene();
    this._buildParticles();
    this._buildAmbientLight();

    window.addEventListener('resize', this._boundResize);
    window.addEventListener('mousemove', this._boundMouse);
    document.addEventListener('visibilitychange', this._boundVisibility);

    this._animate();
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
  _animate() {
    this.animId = requestAnimationFrame(() => this._animate());
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
    /* Ensure relative positioning for glare child */
    el.style.position = 'relative';
    el.style.overflow  = 'hidden';
    el.style.willChange = 'transform';

    /* Glare element */
    const glare = document.createElement('div');
    glare.className = 'card-3d-glare';
    el.appendChild(glare);

    const onMove = (e) => {
      const rect   = el.getBoundingClientRect();
      const cx = e.clientX ?? (e.touches?.[0]?.clientX ?? 0);
      const cy = e.clientY ?? (e.touches?.[0]?.clientY ?? 0);
      const ox = cx - rect.left;
      const oy = cy - rect.top;
      const nx = (ox / rect.width  - 0.5) * 2;   /* -1 to 1 */
      const ny = (oy / rect.height - 0.5) * 2;

      const maxTilt = 10;
      const tiltX   = -ny * maxTilt;
      const tiltY   =  nx * maxTilt;

      el.style.transform = `perspective(1000px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) scale3d(1.03,1.03,1.03)`;
      el.style.transition = 'transform 0.12s ease';
      el.style.boxShadow  = `0 20px 60px rgba(0,0,0,0.5), 0 0 40px rgba(99,102,241,0.25)`;

      /* Move glare */
      glare.style.opacity = '1';
      glare.style.background = `radial-gradient(circle at ${ox}px ${oy}px, rgba(255,255,255,0.18) 0%, transparent 65%)`;
    };

    const onLeave = () => {
      el.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1,1,1)';
      el.style.transition = 'transform 0.5s cubic-bezier(0.16,1,0.3,1), box-shadow 0.5s ease';
      el.style.boxShadow  = '';
      glare.style.opacity = '0';
    };

    el.addEventListener('mousemove',  onMove);
    el.addEventListener('mouseleave', onLeave);
    el.addEventListener('touchmove',  onMove, { passive: true });
    el.addEventListener('touchend',   onLeave);

    this._bound.set(el, { onMove, onLeave });
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
