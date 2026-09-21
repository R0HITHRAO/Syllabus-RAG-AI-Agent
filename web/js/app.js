/**
 * SyllabusAI — Modern 2026 AI Product Application Suite
 * Split-Screen Canvas Studio, Live Code Execution Runner, Hi-Fi Audio Deep Dive, Grounded RAG
 */

class AudioPodcastController {
  constructor(app) {
    this.app = app;
    this.currentPodcast = null;
    this.currentTurnIndex = 0;
    this.isPlaying = false;
    this.playbackRate = 1.25;
    this.speechUtterance = null;
    this.animationFrameId = null;
    this.availableVoices = [];

    this.initElements();
    this.initEvents();
    this.initVoices();
  }

  initElements() {
    this.topicInput = document.getElementById('podcast-topic-input');
    this.btnGenerate = document.getElementById('btn-generate-podcast');
    this.playerCard = document.getElementById('podcast-player-card');
    this.titleDisplay = document.getElementById('podcast-title-display');
    this.summaryDisplay = document.getElementById('podcast-summary-display');
    this.speedSelect = document.getElementById('podcast-speed-select');
    this.btnPlay = document.getElementById('btn-play-podcast');
    this.playIcon = document.getElementById('play-btn-icon');
    this.btnRewind = document.getElementById('btn-rewind-podcast');
    this.btnForward = document.getElementById('btn-forward-podcast');
    this.hostCardAlex = document.getElementById('host-card-alex');
    this.hostCardTaylor = document.getElementById('host-card-taylor');
    this.transcriptContainer = document.getElementById('transcript-lines-container');
    this.canvas = document.getElementById('audio-waveform-canvas');
    this.canvasCtx = this.canvas?.getContext('2d');
  }

  initEvents() {
    this.btnGenerate?.addEventListener('click', () => this.generatePodcast());
    this.btnPlay?.addEventListener('click', () => this.togglePlay());
    this.btnRewind?.addEventListener('click', () => this.skipTurn(-1));
    this.btnForward?.addEventListener('click', () => this.skipTurn(1));
    this.speedSelect?.addEventListener('change', (e) => {
      this.playbackRate = parseFloat(e.target.value);
      if (this.isPlaying) {
        window.speechSynthesis?.cancel();
        this.playTurn(this.currentTurnIndex);
      }
    });
  }

  initVoices() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.availableVoices = window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        this.availableVoices = window.speechSynthesis.getVoices();
      };
    }
  }

  async generatePodcast() {
    const topic = this.topicInput?.value.trim() || 'Operating Systems & Memory Management';
    this.btnGenerate.disabled = true;
    this.btnGenerate.innerHTML = '<span>⏳ Synthesizing Dialogue...</span>';

    try {
      const res = await fetch('/api/podcast/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic })
      });
      const data = await res.json();
      this.loadPodcast(data);
    } catch (e) {
      console.error(e);
      alert('Failed to generate podcast.');
    } finally {
      this.btnGenerate.disabled = false;
      this.btnGenerate.innerHTML = '<span>⚡ Generate Audio Masterclass</span>';
    }
  }

  loadPodcast(podcastData) {
    this.currentPodcast = podcastData;
    this.currentTurnIndex = 0;
    this.stopAudio();

    if (this.titleDisplay) this.titleDisplay.innerText = podcastData.title || 'Deep Dive Study Session';
    if (this.summaryDisplay) this.summaryDisplay.innerText = podcastData.summary || 'A 2-host conversational masterclass.';
    if (this.playerCard) this.playerCard.style.display = 'block';

    this.renderTranscript(podcastData.dialogue);
    this.drawIdleWaveform();
    this.playTurn(0);
  }

  renderTranscript(dialogue) {
    if (!this.transcriptContainer || !dialogue) return;
    this.transcriptContainer.innerHTML = '';

    dialogue.forEach((turn, idx) => {
      const isAlex = turn.speaker === 'alex';
      const speakerName = isAlex ? 'Alex 🎙️' : 'Taylor 🎧';
      const turnEl = document.createElement('div');
      turnEl.className = `transcript-turn-card ${isAlex ? 'alex-card' : 'taylor-card'}`;
      turnEl.id = `transcript-turn-${idx}`;
      turnEl.innerHTML = `
        <div class="turn-speaker-badge ${isAlex ? 'speaker-alex' : 'speaker-taylor'}">${speakerName}</div>
        <div class="turn-spoken-text">${this.app.escapeHtml(turn.text)}</div>
      `;
      turnEl.addEventListener('click', () => {
        this.currentTurnIndex = idx;
        this.playTurn(idx);
      });
      this.transcriptContainer.appendChild(turnEl);
    });
  }

  togglePlay() {
    if (!this.currentPodcast) return;
    if (this.isPlaying) {
      this.pauseAudio();
    } else {
      this.playTurn(this.currentTurnIndex);
    }
  }

  playTurn(index) {
    if (!this.currentPodcast || !this.currentPodcast.dialogue) return;
    if (index >= this.currentPodcast.dialogue.length) {
      this.stopAudio();
      this.currentTurnIndex = 0;
      return;
    }

    this.currentTurnIndex = index;
    const turn = this.currentPodcast.dialogue[index];
    const isAlex = turn.speaker === 'alex';

    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      window.speechSynthesis.resume();
    }

    this.isPlaying = true;
    if (this.playIcon) this.playIcon.innerText = '⏸';

    // Highlight Active Speaker Aura
    this.hostCardAlex?.classList.toggle('speaking', isAlex);
    this.hostCardTaylor?.classList.toggle('speaking', !isAlex);

    // Highlight Synced Line & Scroll
    document.querySelectorAll('.transcript-turn-card').forEach((el, idx) => {
      el.classList.toggle('active-speaking', idx === index);
    });
    const activeLine = document.getElementById(`transcript-turn-${index}`);
    if (activeLine) activeLine.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    // Web Speech Synthesis
    if ('speechSynthesis' in window) {
      this.speechUtterance = new SpeechSynthesisUtterance(turn.text);
      this.speechUtterance.rate = this.playbackRate;
      this.speechUtterance.pitch = isAlex ? 1.15 : 0.88;

      if (this.availableVoices.length === 0) {
        this.availableVoices = window.speechSynthesis.getVoices();
      }

      if (this.availableVoices.length > 0) {
        if (isAlex) {
          const femaleVoice = this.availableVoices.find(v => v.name.includes('Zira') || v.name.includes('Samantha') || v.name.includes('Google US English') || v.name.includes('Female'));
          if (femaleVoice) this.speechUtterance.voice = femaleVoice;
        } else {
          const maleVoice = this.availableVoices.find(v => v.name.includes('David') || v.name.includes('Alex') || v.name.includes('Google UK English Male') || v.name.includes('Male'));
          if (maleVoice) this.speechUtterance.voice = maleVoice;
        }
      }

      this.speechUtterance.onend = () => {
        if (this.isPlaying) {
          this.playTurn(index + 1);
        }
      };

      this.speechUtterance.onerror = (err) => {
        console.warn('SpeechSynthesis error:', err);
        setTimeout(() => {
          if (this.isPlaying) this.playTurn(index + 1);
        }, (turn.text.split(' ').length / (2.5 * this.playbackRate)) * 1000);
      };

      window.speechSynthesis.speak(this.speechUtterance);
    }

    this.startWaveformAnimation();
  }

  pauseAudio() {
    this.isPlaying = false;
    if (this.playIcon) this.playIcon.innerText = '▶';
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    this.hostCardAlex?.classList.remove('speaking');
    this.hostCardTaylor?.classList.remove('speaking');
    this.stopWaveformAnimation();
  }

  stopAudio() {
    this.pauseAudio();
    this.drawIdleWaveform();
  }

  skipTurn(direction) {
    if (!this.currentPodcast) return;
    let nextIndex = this.currentTurnIndex + direction;
    if (nextIndex < 0) nextIndex = 0;
    if (nextIndex >= this.currentPodcast.dialogue.length) nextIndex = 0;
    this.playTurn(nextIndex);
  }

  /* --- DYNAMIC NEON EQUALIZER SPECTRUM --- */
  startWaveformAnimation() {
    this.stopWaveformAnimation();
    const render = (time) => {
      this.drawActiveWaveform(time);
      if (this.isPlaying) {
        this.animationFrameId = requestAnimationFrame(render);
      }
    };
    this.animationFrameId = requestAnimationFrame(render);
  }

  stopWaveformAnimation() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  drawActiveWaveform(time) {
    if (!this.canvasCtx || !this.canvas) return;
    const width = this.canvas.width;
    const height = this.canvas.height;
    const ctx = this.canvasCtx;

    ctx.clearRect(0, 0, width, height);

    const barCount = 36;
    const barWidth = 6;
    const gap = (width - barCount * barWidth) / (barCount - 1);

    const gradient = ctx.createLinearGradient(0, 0, width, 0);
    gradient.addColorStop(0, '#6366f1');
    gradient.addColorStop(0.35, '#8b5cf6');
    gradient.addColorStop(0.7, '#06b6d4');
    gradient.addColorStop(1, '#38bdf8');
    ctx.fillStyle = gradient;

    for (let i = 0; i < barCount; i++) {
      const freq1 = (i / barCount) * Math.PI * 3;
      const freq2 = (i / barCount) * Math.PI * 6;
      const wave = Math.sin(time * 0.007 + freq1) * 0.4 + Math.cos(time * 0.009 + freq2) * 0.3 + 0.5;
      const waveHeight = Math.max(8, wave * (height - 8));
      const x = i * (barWidth + gap);
      const y = (height - waveHeight) / 2;

      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, waveHeight, 3);
      ctx.fill();
    }
  }

  drawIdleWaveform() {
    if (!this.canvasCtx || !this.canvas) return;
    const width = this.canvas.width;
    const height = this.canvas.height;
    const ctx = this.canvasCtx;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = 'rgba(99, 102, 241, 0.2)';

    const barCount = 36;
    const barWidth = 6;
    const gap = (width - barCount * barWidth) / (barCount - 1);

    for (let i = 0; i < barCount; i++) {
      const x = i * (barWidth + gap);
      const y = (height - 6) / 2;
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, 6, 3);
      ctx.fill();
    }
  }
}

class CanvasStudio {
  constructor(app) {
    this.app = app;
    this.panel = document.getElementById('canvas-studio');
    this.titleEl = document.getElementById('canvas-title');
    this.tabs = document.querySelectorAll('.canvas-tab-btn, .canvas-tab');
    this.panes = document.querySelectorAll('.studio-pane');

    this.codeLangSelect = document.getElementById('code-lang-select');
    this.codeTemplateSelect = document.getElementById('code-template-select');
    this.btnRunCode = document.getElementById('btn-run-code');
    this.consoleOutput = document.getElementById('console-output');

    this.inspectorDocName = document.getElementById('inspector-doc-name');
    this.inspectorPageNum = document.getElementById('inspector-page-num');
    this.inspectorSimScore = document.getElementById('inspector-sim-score');
    this.inspectorMeterFill = document.getElementById('inspector-meter-fill');
    this.inspectorHighlightedText = document.getElementById('inspector-highlighted-text');

    this.notesContent = document.getElementById('canvas-notes-content');
    this.btnClose = document.getElementById('btn-close-canvas');
    this.btnCopy = document.getElementById('btn-copy-canvas');

    this.templates = {
      linked_list: `# Python 3: Singly Linked List Reversal Algorithm\nclass Node:\n    def __init__(self, val, next=None):\n        self.val = val\n        self.next = next\n\ndef reverse_list(head):\n    prev = None\n    curr = head\n    while curr:\n        nxt = curr.next\n        curr.next = prev\n        prev = curr\n        curr = nxt\n    return prev\n\n# Test List 1 -> 2 -> 3 -> 4 -> 5\nhead = Node(1, Node(2, Node(3, Node(4, Node(5)))))\nprint("Original: 1 -> 2 -> 3 -> 4 -> 5")\n\nreversed_head = reverse_list(head)\nres = []\nc = reversed_head\nwhile c:\n    res.append(str(c.val))\n    c = c.next\nprint("Reversed: " + " -> ".join(res))\nprint("Time Complexity: O(n) | Auxiliary Space: O(1)")\n`,
      bankers: `# Python 3: Dijkstra's Banker's Safety Algorithm\nAllocation = [\n    [0, 1, 0], [2, 0, 0], [3, 0, 2], [2, 1, 1], [0, 0, 2]\n]\nMax = [\n    [7, 5, 3], [3, 2, 2], [9, 0, 2], [2, 2, 2], [4, 3, 3]\n]\nAvailable = [3, 3, 2]\n\nn, m = len(Allocation), len(Available)\nNeed = [[Max[i][j] - Allocation[i][j] for j in range(m)] for i in range(n)]\nFinish = [False] * n\nsafe_seq, work = [], list(Available)\n\nwhile len(safe_seq) < n:\n    found = False\n    for i in range(n):\n        if not Finish[i] and all(Need[i][j] <= work[j] for j in range(m)):\n            for j in range(m): work[j] += Allocation[i][j]\n            Finish[i] = True\n            safe_seq.append(f"P{i}")\n            found = True\n            break\n    if not found: break\n\nif len(safe_seq) == n:\n    print("✅ System is in a SAFE STATE!")\n    print("Safe Execution Sequence: < " + ", ".join(safe_seq) + " >")\nelse:\n    print("⚠️ DEADLOCK DETECTED! System is unsafe.")\n`,
      lru: `# Python 3: LRU Page Replacement Algorithm\ndef lru_sim(pages, capacity):\n    memory = []\n    faults, hits = 0, 0\n    print(f"LRU Page Frames: {capacity}\\n" + "-" * 35)\n    for p in pages:\n        if p in memory:\n            hits += 1\n            memory.remove(p)\n            memory.append(p)\n            st = "HIT "\n        else:\n            faults += 1\n            if len(memory) >= capacity: memory.pop(0)\n            memory.append(p)\n            st = "FAULT"\n        print(f"Page {p} -> [{st}] Frames: {memory}")\n    print("-" * 35)\n    print(f"Total Faults: {faults} | Total Hits: {hits} | Hit Ratio: {(hits/len(pages))*100:.1f}%")\n\nlru_sim([7, 0, 1, 2, 0, 3, 0, 4, 2, 3, 0, 3, 2], capacity=3)\n`,
      binary_search: `# Python 3: Binary Search with Step Trace\ndef binary_search(arr, target):\n    low, high, step = 0, len(arr) - 1, 1\n    print(f"Searching for target {target} in array: {arr}\\n")\n    while low <= high:\n        mid = (low + high) // 2\n        print(f"Step {step}: low={low} ({arr[low]}), high={high} ({arr[high]}), mid={mid} (val={arr[mid]})")\n        if arr[mid] == target: return mid\n        elif arr[mid] < target: low = mid + 1\n        else: high = mid - 1\n        step += 1\n    return -1\n\narr = [3, 9, 14, 19, 27, 33, 42, 56, 78, 90]\nidx = binary_search(arr, 42)\nprint(f"\\nResult: Target 42 found at index {idx} in O(log n) time.")\n`,
      emat: `# Python 3: Effective Memory Access Time (EMAT)\ndef calc_emat(hit_ratio, tlb_ns, mem_ns):\n    return hit_ratio * (tlb_ns + mem_ns) + (1 - hit_ratio) * (tlb_ns + 2 * mem_ns)\n\nh, c, m = 0.95, 20, 100\nemat = calc_emat(h, c, m)\nprint("--- MMU Effective Access Calculation ---")\nprint(f"TLB Hit Ratio (h)    : {h * 100}%")\nprint(f"TLB Access Time (c)  : {c} ns")\nprint(f"Main Memory Time (m) : {m} ns")\nprint(f"EMAT                 : {emat:.2f} ns")\nprint(f"Overhead Ratio       : {emat / m:.2f}x compared to direct memory")\n`
    };

    this.initDefaultCode();
    this.initEvents();
  }

  initDefaultCode() {
    if (this.codeEditor && !this.codeEditor.value) {
      this.codeEditor.value = this.templates.linked_list;
    }
  }

  initEvents() {
    this.tabs.forEach(tab => {
      tab.addEventListener('click', () => this.switchStudioTab(tab.dataset.studio));
    });

    this.codeTemplateSelect?.addEventListener('change', (e) => {
      const tmpl = this.templates[e.target.value];
      if (tmpl && this.codeEditor) {
        this.codeEditor.value = tmpl;
        if (this.codeLangSelect) this.codeLangSelect.value = 'python';
        if (this.consoleOutput) this.consoleOutput.innerText = 'Template loaded. Click "▶ Run Code" to execute.';
      }
    });

    this.btnClose?.addEventListener('click', () => this.close());
    this.btnCopy?.addEventListener('click', () => this.copyActiveContent());
    this.btnRunCode?.addEventListener('click', () => this.runActiveCode());
  }

  open() {
    this.panel?.classList.remove('collapsed');
  }

  close() {
    this.panel?.classList.add('collapsed');
  }

  toggle() {
    this.panel?.classList.toggle('collapsed');
  }

  switchStudioTab(studioType) {
    this.tabs.forEach(t => t.classList.toggle('active', t.dataset.studio === studioType));
    this.panes.forEach(p => p.classList.toggle('active', p.id === `studio-pane-${studioType}`));
  }

  openCode(title, code, lang = 'python') {
    this.open();
    this.switchStudioTab('code');
    if (this.titleEl) this.titleEl.innerText = title || 'Interactive Studio';
    if (this.codeLangSelect) {
      this.codeLangSelect.value = (lang.toLowerCase() === 'javascript' || lang.toLowerCase() === 'js') ? 'javascript' : 'python';
    }
    if (this.codeEditor) this.codeEditor.value = code;
    if (this.consoleOutput) this.consoleOutput.innerText = 'Ready to execute. Click "▶ Run Code" above.';
  }

  openCitation(source, page, snippet, similarity = 0.95) {
    this.open();
    this.switchStudioTab('inspector');
    if (this.titleEl) this.titleEl.innerText = 'Source Document Inspector';
    if (this.inspectorDocName) this.inspectorDocName.innerText = `📄 ${source}`;
    if (this.inspectorPageNum) this.inspectorPageNum.innerText = `Page ${page}`;
    
    const pct = Math.round(similarity * 100);
    if (this.inspectorSimScore) this.inspectorSimScore.innerText = `${pct}%`;
    if (this.inspectorMeterFill) this.inspectorMeterFill.style.width = `${pct}%`;
    if (this.inspectorHighlightedText) {
      this.inspectorHighlightedText.innerHTML = this.app.renderMarkdown(snippet);
      this.app.renderMath(this.inspectorHighlightedText);
    }
  }

  openNotes(title, markdownContent) {
    this.open();
    this.switchStudioTab('notes');
    if (this.titleEl) this.titleEl.innerText = title || 'Study Notes & Proofs';
    if (this.notesContent) {
      this.notesContent.innerHTML = this.app.renderMarkdown(markdownContent);
      this.app.renderMath(this.notesContent);
    }
  }

  async runActiveCode() {
    const code = this.codeEditor?.value || '';
    const lang = (this.codeLangSelect?.value || 'python').toLowerCase();
    if (!code.trim()) {
      this.consoleOutput.innerText = 'No code to execute.';
      return;
    }

    this.consoleOutput.innerText = `[Executing ${lang.toUpperCase()} code in sandbox runtime...]\n`;
    if (this.btnRunCode) {
      this.btnRunCode.disabled = true;
      this.btnRunCode.innerText = '⏳ Running...';
    }

    try {
      // 1. Live backend execution with timeout
      const res = await fetch('/api/code/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, language: lang })
      });
      const result = await res.json();

      if (result.client_eval && lang === 'javascript') {
        let logs = [];
        const mockConsole = {
          log: (...args) => logs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ')),
          error: (...args) => logs.push('ERROR: ' + args.join(' '))
        };
        const runFn = new Function('console', code);
        runFn(mockConsole);
        this.consoleOutput.innerText = (logs.join('\n') || '[No console.log output]') + '\n\n[✅ SUCCESS | Browser JS Runtime]';
      } else {
        const statusBadge = result.success ? '✅ SUCCESS' : '⚠️ RUNTIME ERROR';
        this.consoleOutput.innerText = `${result.output}\n\n[${statusBadge} | Execution time: ${result.execution_time_ms}ms]`;
      }
    } catch (err) {
      this.consoleOutput.innerText = `Execution Error: ${err.message}`;
    } finally {
      if (this.btnRunCode) {
        this.btnRunCode.disabled = false;
        this.btnRunCode.innerText = '▶ Run Code';
      }
    }
  }

  copyActiveContent() {
    let content = '';
    const activeTab = document.querySelector('.canvas-tab-btn.active, .canvas-tab.active')?.dataset.studio;
    if (activeTab === 'code') content = this.codeEditor?.value || '';
    else if (activeTab === 'inspector') content = this.inspectorHighlightedText?.innerText || '';
    else content = this.notesContent?.innerText || '';

    navigator.clipboard.writeText(content).then(() => {
      if (this.btnCopy) {
        this.btnCopy.innerHTML = '✓';
        setTimeout(() => {
          this.btnCopy.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
        }, 1500);
      }
    });
  }
}

class ConceptGraphController {
  constructor(app) {
    this.app = app;
    this.canvas = document.getElementById('concept-graph-canvas');
    this.ctx = this.canvas?.getContext('2d');
    this.nodes = [];
    this.links = [];
    this.selectedNode = null;
    this.hoveredNode = null;
    this.draggedNode = null;
    this.searchTerm = '';
    this.zoom = 1;
    this.panX = 0;
    this.panY = 0;
    this.isPanning = false;
    this.lastMouseX = 0;
    this.lastMouseY = 0;
    this.animationId = null;
    this._tick = 0;

    this.initElements();
    this.initEvents();
  }

  initElements() {
    this.searchInput = document.getElementById('graph-search-input');
    this.btnRefresh = document.getElementById('btn-refresh-graph');
    this.btnZoomIn = document.getElementById('btn-graph-zoom-in');
    this.btnZoomOut = document.getElementById('btn-graph-zoom-out');
    this.btnZoomReset = document.getElementById('btn-graph-zoom-reset');
    this.nodeCard = document.getElementById('graph-node-card');
    this.nodeCardTitle = document.getElementById('node-card-title');
    this.nodeCardDesc = document.getElementById('node-card-desc');
    this.nodeCardGroup = document.getElementById('node-card-group-badge');
    this.nodeFormulaBox = document.getElementById('node-card-formula-box');
    this.nodeFormula = document.getElementById('node-card-formula');
    this.btnCloseNodeCard = document.getElementById('btn-close-node-card');
    this.btnAskNodeAI = document.getElementById('btn-ask-node-ai');
    this.btnQuizNodeAI = document.getElementById('btn-quiz-node-ai');
  }

  initEvents() {
    this.searchInput?.addEventListener('input', (e) => {
      this.searchTerm = e.target.value.toLowerCase().trim();
    });
    this.btnRefresh?.addEventListener('click', () => this.fetchGraphData());
    this.btnZoomIn?.addEventListener('click', () => this.zoomBy(1.2));
    this.btnZoomOut?.addEventListener('click', () => this.zoomBy(0.8));
    this.btnZoomReset?.addEventListener('click', () => this.resetView());
    this.btnCloseNodeCard?.addEventListener('click', () => this.hideNodeCard());

    this.btnAskNodeAI?.addEventListener('click', () => {
      if (!this.selectedNode) return;
      this.app.switchTab('tab-chat');
      const query = `Explain the syllabus concept "${this.selectedNode.label}" in depth, including its mechanism, practical examples, and exam significance.`;
      if (this.app.chatInput) this.app.chatInput.value = query;
      this.app.handleSendMessage();
    });

    this.btnQuizNodeAI?.addEventListener('click', () => {
      if (!this.selectedNode) return;
      this.app.switchTab('tab-exam');
      const topicInput = document.getElementById('quiz-topic');
      if (topicInput) topicInput.value = this.selectedNode.label;
      this.app.generateQuiz();
    });

    if (this.canvas) {
      this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
      this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
      this.canvas.addEventListener('mouseup', () => this.onMouseUp());
      this.canvas.addEventListener('wheel', (e) => this.onWheel(e));
    }
  }

  resizeCanvas() {
    if (!this.canvas || !this.canvas.parentElement) return;
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.canvas.width = rect.width || 800;
    this.canvas.height = rect.height || 500;
  }

  async fetchGraphData() {
    try {
      this.resizeCanvas();
      const res = await fetch('/api/graph/data');
      const data = await res.json();
      this.loadGraph(data);
    } catch (e) {
      console.error('Failed to load graph data:', e);
    }
  }

  loadGraph(data) {
    const width = this.canvas?.width || 800;
    const height = this.canvas?.height || 500;

    this.nodes = (data.nodes || []).map((n, i) => {
      const angle = (i / Math.max(1, data.nodes.length)) * Math.PI * 2;
      const radius = n.group === 'root' ? 0 : (n.group === 'chapter' ? 140 : 230 + (i % 3) * 40);
      return {
        ...n,
        x: width / 2 + Math.cos(angle) * radius,
        y: height / 2 + Math.sin(angle) * radius,
        vx: 0,
        vy: 0,
        birthTick: this._tick,
        pulseOffset: Math.random() * Math.PI * 2,
      };
    });

    const nodeMap = new Map(this.nodes.map(n => [n.id, n]));
    this.links = (data.links || []).map(l => ({
      ...l,
      sourceNode: nodeMap.get(l.source),
      targetNode: nodeMap.get(l.target),
      particles: Array.from({ length: 3 }, (_, i) => ({ t: i / 3, speed: 0.003 + Math.random() * 0.004 })),
    })).filter(l => l.sourceNode && l.targetNode);

    this.startPhysicsSimulation();
  }

  startPhysicsSimulation() {
    if (this.animationId) cancelAnimationFrame(this.animationId);

    const tick = () => {
      this._tick++;
      this.updatePhysics();
      this.render();
      this.animationId = requestAnimationFrame(tick);
    };

    this.animationId = requestAnimationFrame(tick);
  }

  updatePhysics() {
    const k = 0.04;
    const rep = 900;
    const centerAttraction = 0.0018;
    const width = this.canvas.width;
    const height = this.canvas.height;

    for (let i = 0; i < this.nodes.length; i++) {
      for (let j = i + 1; j < this.nodes.length; j++) {
        const n1 = this.nodes[i];
        const n2 = this.nodes[j];
        const dx = n2.x - n1.x;
        const dy = n2.y - n1.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        if (dist < 320) {
          const force = rep / (dist * dist);
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          n1.vx -= fx;
          n1.vy -= fy;
          n2.vx += fx;
          n2.vy += fy;
        }
      }
    }

    for (let link of this.links) {
      const s = link.sourceNode;
      const t = link.targetNode;
      const dx = t.x - s.x;
      const dy = t.y - s.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const targetDist = link.relationship === 'contains' ? 130 : 95;
      const force = (dist - targetDist) * k;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      s.vx += fx;
      s.vy += fy;
      t.vx -= fx;
      t.vy -= fy;
    }

    for (let n of this.nodes) {
      if (n === this.draggedNode) continue;
      n.vx += (width / 2 - n.x) * centerAttraction;
      n.vy += (height / 2 - n.y) * centerAttraction;
      n.vx *= 0.88;
      n.vy *= 0.88;
      n.x += n.vx;
      n.y += n.vy;
    }

    for (let link of this.links) {
      if (!link.particles) continue;
      for (let p of link.particles) {
        p.t = (p.t + p.speed) % 1;
      }
    }
  }

  render() {
    if (!this.ctx || !this.canvas) return;
    const ctx = this.ctx;
    const width = this.canvas.width;
    const height = this.canvas.height;
    const now = Date.now();

    ctx.save();
    ctx.clearRect(0, 0, width, height);

    /* Deep space background */
    const bgGrad = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, Math.max(width, height) * 0.7);
    bgGrad.addColorStop(0, 'rgba(15,18,40,0.97)');
    bgGrad.addColorStop(0.6, 'rgba(8,10,22,0.98)');
    bgGrad.addColorStop(1, 'rgba(3,4,10,1)');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    /* Subtle grid */
    this._drawGrid(ctx, width, height);

    ctx.translate(this.panX, this.panY);
    ctx.scale(this.zoom, this.zoom);

    const palette = {
      root:      { core: '#6366f1', glow: 'rgba(99,102,241,'  },
      chapter:   { core: '#8b5cf6', glow: 'rgba(139,92,246,'  },
      concept:   { core: '#06b6d4', glow: 'rgba(6,182,212,'   },
      algorithm: { core: '#10b981', glow: 'rgba(16,185,129,'  },
      formula:   { core: '#f59e0b', glow: 'rgba(245,158,11,'  },
      dynamic:   { core: '#ec4899', glow: 'rgba(236,72,153,'  },
    };
    const getP = (group) => palette[group] || palette.concept;

    /* Pass 1: glowing beams */
    for (let link of this.links) {
      this._drawNeonEdge(ctx, link, now, getP);
    }
    /* Pass 2: data-stream particles */
    for (let link of this.links) {
      this._drawEdgeParticles(ctx, link, getP);
    }
    /* Pass 3: nodes (selected/hovered on top) */
    const sorted = [...this.nodes].sort((a, b) => {
      const sa = (a === this.selectedNode ? 2 : a === this.hoveredNode ? 1 : 0);
      const sb = (b === this.selectedNode ? 2 : b === this.hoveredNode ? 1 : 0);
      return sa - sb;
    });
    for (let n of sorted) {
      this._drawNeonNode(ctx, n, now, getP);
    }

    ctx.restore();
  }

  _drawGrid(ctx, width, height) {
    const step = 48;
    ctx.save();
    ctx.strokeStyle = 'rgba(99,102,241,0.055)';
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += step) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
    }
    for (let y = 0; y < height; y += step) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
    }
    ctx.restore();
  }

  _drawNeonEdge(ctx, link, now, getP) {
    const s = link.sourceNode;
    const t = link.targetNode;
    if (!s || !t) return;
    const srcP = getP(s.group);
    const dstP = getP(t.group);
    const isMatch = !this.searchTerm ||
      s.label.toLowerCase().includes(this.searchTerm) ||
      t.label.toLowerCase().includes(this.searchTerm);

    ctx.save();
    ctx.globalAlpha = isMatch ? 1 : 0.08;

    /* Glow bloom */
    const grad = ctx.createLinearGradient(s.x, s.y, t.x, t.y);
    grad.addColorStop(0, srcP.glow + '0.55)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.12)');
    grad.addColorStop(1, dstP.glow + '0.55)');
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(t.x, t.y);
    ctx.strokeStyle = grad;
    ctx.lineWidth = 4;
    ctx.filter = 'blur(3px)';
    ctx.stroke();

    /* Sharp core */
    ctx.filter = 'none';
    const grad2 = ctx.createLinearGradient(s.x, s.y, t.x, t.y);
    grad2.addColorStop(0, srcP.glow + '0.85)');
    grad2.addColorStop(1, dstP.glow + '0.85)');
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(t.x, t.y);
    ctx.strokeStyle = grad2;
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.restore();
  }

  _drawEdgeParticles(ctx, link, getP) {
    const s = link.sourceNode;
    const t = link.targetNode;
    if (!s || !t || !link.particles) return;
    const isMatch = !this.searchTerm ||
      s.label.toLowerCase().includes(this.searchTerm) ||
      t.label.toLowerCase().includes(this.searchTerm);

    ctx.save();
    ctx.globalAlpha = isMatch ? 1 : 0.05;
    for (let p of link.particles) {
      const px = s.x + (t.x - s.x) * p.t;
      const py = s.y + (t.y - s.y) * p.t;
      const color = getP(s.group).core;
      const halo = ctx.createRadialGradient(px, py, 0, px, py, 7);
      halo.addColorStop(0, color);
      halo.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.beginPath();
      ctx.arc(px, py, 7, 0, Math.PI * 2);
      ctx.fillStyle = halo;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(px, py, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    }
    ctx.restore();
  }

  _drawNeonNode(ctx, n, now, getP) {
    const isMatch    = !this.searchTerm || n.label.toLowerCase().includes(this.searchTerm);
    const isSelected = this.selectedNode === n;
    const isHovered  = this.hoveredNode  === n;
    const p = getP(n.group);

    const baseR  = n.size || 14;
    const pulse  = Math.sin(now * 0.002 + n.pulseOffset) * 0.12 + 1;
    const radius = baseR * (isSelected ? 1.35 : isHovered ? 1.18 : 1) * (isSelected || isHovered ? pulse : 1);
    const age    = this._tick - (n.birthTick || 0);
    const spawnScale = age < 30 ? age / 30 : 1;

    ctx.save();
    ctx.globalAlpha = isMatch ? 1 : 0.1;
    ctx.translate(n.x, n.y);
    ctx.scale(spawnScale, spawnScale);

    /* Corona */
    if (isSelected || isHovered || n.group === 'root') {
      const coronaR = radius + (isSelected ? 28 : 16);
      const corona = ctx.createRadialGradient(0, 0, radius, 0, 0, coronaR);
      corona.addColorStop(0, p.glow + '0.4)');
      corona.addColorStop(1, p.glow + '0)');
      ctx.beginPath();
      ctx.arc(0, 0, coronaR, 0, Math.PI * 2);
      ctx.fillStyle = corona;
      ctx.fill();
    }

    /* Animated outer ring */
    if (isSelected || n.group === 'root' || n.group === 'chapter') {
      const ringT = (now * 0.001 + n.pulseOffset) % (Math.PI * 2);
      const ringOpacity = (Math.sin(ringT) * 0.3 + 0.5);
      ctx.beginPath();
      ctx.arc(0, 0, radius + 5, 0, Math.PI * 2);
      ctx.strokeStyle = p.glow + ringOpacity + ')';
      ctx.lineWidth = isSelected ? 3 : 1.5;
      ctx.filter = 'blur(2px)';
      ctx.stroke();
      ctx.filter = 'none';
    }

    /* Body sphere */
    const bodyGrad = ctx.createRadialGradient(-radius * 0.3, -radius * 0.3, 0, 0, 0, radius);
    bodyGrad.addColorStop(0, p.core + 'cc');
    bodyGrad.addColorStop(0.45, p.core + '66');
    bodyGrad.addColorStop(1, 'rgba(4,5,15,0.95)');
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fillStyle = bodyGrad;
    ctx.fill();

    /* Glowing border */
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.strokeStyle = p.core;
    ctx.lineWidth = isSelected ? 2.5 : (isHovered ? 2 : 1.2);
    ctx.shadowColor = p.core;
    ctx.shadowBlur = isSelected ? 24 : (isHovered ? 16 : 8);
    ctx.stroke();
    ctx.shadowBlur = 0;

    /* Specular highlight */
    const spec = ctx.createRadialGradient(-radius * 0.28, -radius * 0.28, 0, 0, 0, radius * 0.6);
    spec.addColorStop(0, 'rgba(255,255,255,0.38)');
    spec.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.6, 0, Math.PI * 2);
    ctx.fillStyle = spec;
    ctx.fill();

    /* Center dot */
    const dotR = radius * 0.28;
    const dotGlow = ctx.createRadialGradient(0, 0, 0, 0, 0, dotR);
    dotGlow.addColorStop(0, '#ffffff');
    dotGlow.addColorStop(0.6, p.core);
    dotGlow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.beginPath();
    ctx.arc(0, 0, dotR, 0, Math.PI * 2);
    ctx.fillStyle = dotGlow;
    ctx.fill();

    ctx.restore();

    /* Label pill (drawn in world-space, no node transform) */
    ctx.save();
    ctx.globalAlpha = isMatch ? 1 : 0.1;
    const labelY   = n.y + radius * spawnScale + 18;
    const fontSize = n.group === 'root' ? 13 : (n.group === 'chapter' ? 12 : 11);
    const fontW    = n.group === 'root' ? '700' : (isSelected ? '700' : '500');
    ctx.font = `${fontW} ${fontSize}px 'Plus Jakarta Sans', sans-serif`;
    const labelW = ctx.measureText(n.label).width;
    const padX = 8, padY = 5;

    ctx.fillStyle = isSelected ? p.glow + '0.75)' : isHovered ? p.glow + '0.5)' : 'rgba(6,7,15,0.78)';
    ctx.beginPath();
    ctx.roundRect(n.x - labelW / 2 - padX, labelY - fontSize - padY, labelW + padX * 2, fontSize + padY * 2, 6);
    ctx.fill();

    ctx.strokeStyle = isSelected ? p.core : isHovered ? p.glow + '0.6)' : 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = isSelected ? '#ffffff' : (isHovered ? p.core : '#cbd5e1');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    if (isSelected) { ctx.shadowColor = p.core; ctx.shadowBlur = 12; }
    ctx.fillText(n.label, n.x, labelY);
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  onMouseDown(e) {
    const rect = this.canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left - this.panX) / this.zoom;
    const my = (e.clientY - rect.top - this.panY) / this.zoom;

    for (let n of this.nodes) {
      const dx = mx - n.x;
      const dy = my - n.y;
      if (Math.sqrt(dx * dx + dy * dy) <= (n.size || 14) + 4) {
        this.draggedNode = n;
        this.selectNode(n);
        return;
      }
    }

    this.isPanning = true;
    this.lastMouseX = e.clientX;
    this.lastMouseY = e.clientY;
  }

  onMouseMove(e) {
    const rect = this.canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left - this.panX) / this.zoom;
    const my = (e.clientY - rect.top - this.panY) / this.zoom;

    if (this.draggedNode) {
      this.draggedNode.x = mx;
      this.draggedNode.y = my;
      this.draggedNode.vx = 0;
      this.draggedNode.vy = 0;
      return;
    }

    if (this.isPanning) {
      this.panX += e.clientX - this.lastMouseX;
      this.panY += e.clientY - this.lastMouseY;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
      return;
    }

    let found = null;
    for (let n of this.nodes) {
      const dx = mx - n.x;
      const dy = my - n.y;
      if (Math.sqrt(dx * dx + dy * dy) <= (n.size || 14) + 4) {
        found = n;
        break;
      }
    }
    this.hoveredNode = found;
    this.canvas.style.cursor = found ? 'pointer' : (this.isPanning ? 'grabbing' : 'grab');
  }

  onMouseUp() {
    this.draggedNode = null;
    this.isPanning = false;
  }

  onWheel(e) {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    this.zoomBy(factor);
  }

  zoomBy(factor) {
    this.zoom = Math.max(0.4, Math.min(2.5, this.zoom * factor));
  }

  resetView() {
    this.zoom = 1;
    this.panX = 0;
    this.panY = 0;
  }

  selectNode(node) {
    this.selectedNode = node;
    if (!this.nodeCard) return;

    this.nodeCard.style.display = 'block';
    if (this.nodeCardTitle) this.nodeCardTitle.innerText = node.label;
    if (this.nodeCardDesc)  this.nodeCardDesc.innerText  = node.description || 'Core concept extracted from course curriculum.';
    if (this.nodeCardGroup) this.nodeCardGroup.innerText = (node.group || 'CONCEPT').toUpperCase();

    if (node.formula && this.nodeFormulaBox && this.nodeFormula) {
      this.nodeFormulaBox.style.display = 'block';
      this.nodeFormula.innerText = node.formula;
    } else if (this.nodeFormulaBox) {
      this.nodeFormulaBox.style.display = 'none';
    }
  }

  hideNodeCard() {
    if (this.nodeCard) this.nodeCard.style.display = 'none';
    this.selectedNode = null;
  }
}


class AnalyticsController {
  constructor(app) {
    this.app = app;
    this.readinessPctDisplay = document.getElementById('readiness-pct-display');
    this.readinessTierBadge = document.getElementById('readiness-tier-badge');
    this.gaugeCircleFill = document.getElementById('gauge-circle-fill');
    this.kpiStreak = document.getElementById('kpi-streak');
    this.kpiQuizzes = document.getElementById('kpi-quizzes');
    this.kpiAccuracy = document.getElementById('kpi-accuracy');
    this.kpiCoverage = document.getElementById('kpi-coverage');
    this.topicMasteryContainer = document.getElementById('topic-mastery-container');
    this.weakTopicsList = document.getElementById('weak-topics-list');
    this.btnPracticeWeakSpots = document.getElementById('btn-practice-weak-spots');

    this.initEvents();
  }

  initEvents() {
    this.btnPracticeWeakSpots?.addEventListener('click', () => {
      this.app.switchTab('tab-exam');
      const topicInput = document.getElementById('quiz-topic');
      if (topicInput) topicInput.value = 'CPU Scheduling & Memory Paging';
      this.app.generateQuiz();
    });
  }

  async fetchAnalytics() {
    try {
      const res = await fetch('/api/analytics/overview');
      const data = await res.json();
      if (!data.total_quizzes_taken || data.total_quizzes_taken === 0) {
        this._renderEmptyState();
      } else {
        this.renderAnalytics(data);
      }
    } catch (e) {
      console.error('Failed to load analytics overview:', e);
    }
  }

  _renderEmptyState() {
    const container = document.getElementById('analytics-content') ||
                      document.querySelector('#tab-analytics');
    if (!container) return;
    const emptyEl = container.querySelector('.analytics-empty-placeholder') ||
                    document.createElement('div');
    emptyEl.className = 'analytics-empty analytics-empty-placeholder';
    emptyEl.innerHTML = `
      <span class="empty-icon-glow">📊</span>
      <strong>No quiz data yet!</strong><br>
      <small>Head to <em>Exam Arena</em> and take your first quiz to see your readiness score, topic mastery, and weak spots populate here.</small>
    `;
    const existingReadiness = container.querySelector('.readiness-gauge-section');
    if (existingReadiness) existingReadiness.style.opacity = '0.4';
    container.prepend(emptyEl);
  }

  renderAnalytics(data) {
    const score = data.readiness_score || 85;
    if (this.readinessPctDisplay) this.readinessPctDisplay.innerText = `${score}%`;
    if (this.readinessTierBadge) this.readinessTierBadge.innerText = data.readiness_tier || 'Exam Ready';

    const offset = Math.round(427 * (1 - score / 100));
    if (this.gaugeCircleFill) {
      this.gaugeCircleFill.style.strokeDashoffset = offset;
    }

    if (this.kpiStreak) this.kpiStreak.innerText = `${data.study_streak_days || 4} Days`;
    if (this.kpiQuizzes) this.kpiQuizzes.innerText = `${data.total_quizzes_taken || 0} Tests`;
    if (this.kpiAccuracy) this.kpiAccuracy.innerText = `${data.overall_accuracy || 90}%`;

    if (this.topicMasteryContainer && data.topic_mastery) {
      this.topicMasteryContainer.innerHTML = '';
      data.topic_mastery.forEach(tm => {
        const item = document.createElement('div');
        item.className = 'mastery-bar-item';
        item.innerHTML = `
          <div class="mastery-item-meta">
            <span>${this.app.escapeHtml(tm.topic)}</span>
            <strong style="color:${tm.status === 'mastered' ? 'var(--accent-emerald)' : (tm.status === 'moderate' ? 'var(--accent-cyan)' : 'var(--accent-amber)')};">
              ${tm.mastery_percentage}%
            </strong>
          </div>
          <div class="mastery-progress-track">
            <div class="mastery-progress-fill ${tm.status}" style="width: ${tm.mastery_percentage}%;"></div>
          </div>
        `;
        this.topicMasteryContainer.appendChild(item);
      });
    }

    if (this.weakTopicsList && data.weak_topics) {
      this.weakTopicsList.innerHTML = '';
      if (data.weak_topics.length === 0) {
        this.weakTopicsList.innerHTML = '<p style="color:var(--accent-emerald); font-size:13px;">✅ All topics are currently mastered above 75% accuracy!</p>';
      } else {
        data.weak_topics.forEach(wt => {
          const row = document.createElement('div');
          row.className = 'weak-topic-row';
          row.innerHTML = `
            <div class="weak-topic-info">
              <strong>${this.app.escapeHtml(wt.topic)} (${wt.score}%)</strong>
              <small>${this.app.escapeHtml(wt.recommended_action)}</small>
            </div>
            <button class="primary-gradient-btn" style="padding: 4px 10px; font-size: 11px;">
              ⚡ Practice
            </button>
          `;
          row.querySelector('button')?.addEventListener('click', () => {
            this.app.launchTopicQuiz(wt.topic);
          });
          this.weakTopicsList.appendChild(row);
        });
      }
    }
  }
}

class SyllabusApp {
  constructor() {
    this.currentMode = 'agent';
    this.currentPersona = 'general';
    this.currentTheme = localStorage.getItem('syllabus_theme') || 'nebula';
    this.sessions = this.loadSessions();
    this.activeSessionId = this.sessions.length > 0 ? this.sessions[0].id : this.createNewSessionId();
    
    this.isStreaming = false;
    this.speechRecognition = null;
    this.isRecordingVoice = false;
    this.activeQuiz = null;

    this.initElements();
    this.canvas = new CanvasStudio(this);
    this.podcast = new AudioPodcastController(this);
    this.graph = new ConceptGraphController(this);
    this.analytics = new AnalyticsController(this);
    this.initTheme();
    this.initEventListeners();
    this.initVoiceInput();
    this.renderSessionsList();
    this.renderActiveSessionMessages();
    this.fetchSystemStatus();
  }

  initElements() {
    this.themeSelect = document.getElementById('theme-select');
    this.modeAgentBtn = document.getElementById('mode-agent-btn');
    this.modeStrictBtn = document.getElementById('mode-strict-btn');
    this.personaSelect = document.getElementById('persona-select');
    this.btnToggleCanvas = document.getElementById('btn-toggle-canvas');
    this.sidebar = document.getElementById('chat-sidebar');
    this.btnToggleSidebar = document.getElementById('btn-toggle-sidebar');
    this.sessionsListEl = document.getElementById('sessions-list');
    this.btnNewChat = document.getElementById('btn-new-chat');

    this.tabButtons = document.querySelectorAll('.tab-nav-btn, .tab-btn');
    this.tabPanes = document.querySelectorAll('.tab-pane');

    this.chatMessages = document.getElementById('chat-messages');
    this.chatInput = document.getElementById('chat-input');
    this.btnSendChat = document.getElementById('btn-send-chat');
    this.btnClearChat = document.getElementById('btn-clear-chat');
    this.chatDocFilter = document.getElementById('chat-doc-filter');
    this.btnVoiceInput = document.getElementById('btn-voice-input');

    this.btnGenerateQuiz = document.getElementById('btn-generate-quiz');
    this.quizContainer = document.getElementById('quiz-container');
    this.quizFooter = document.getElementById('quiz-footer');
    this.btnSubmitQuiz = document.getElementById('btn-submit-quiz');
    this.quizResults = document.getElementById('quiz-results');
    this.btnExportWorksheet = document.getElementById('btn-export-worksheet');

    this.dropZone = document.getElementById('drop-zone');
    this.fileInput = document.getElementById('file-input');
    this.btnLoadSample = document.getElementById('btn-load-sample');
    this.btnClearDocs = document.getElementById('btn-clear-docs');
    this.docsTableContainer = document.getElementById('documents-table-container');
    this.docCountBadge = document.getElementById('doc-count-badge');

    this.btnGenerateCards = document.getElementById('btn-generate-cards');
    this.flashcardsContainer = document.getElementById('flashcards-container');
    this.btnGenerateCheatsheet = document.getElementById('btn-generate-cheatsheet');
    this.cheatsheetOutput = document.getElementById('cheatsheet-output');
    this.cheatsheetContent = document.getElementById('cheatsheet-content');
    this.btnDownloadCheatsheet = document.getElementById('btn-download-cheatsheet');

    // Flashcard detail modal elements
    this.btnFlipFlashcard = document.getElementById('btn-flip-flashcard');
    this.btnCloseFlashcardDetail = document.getElementById('btn-close-flashcard-detail');
    this.fcDetailTopic = document.getElementById('fc-detail-topic');
    this.fcDetailSource = document.getElementById('fc-detail-source');
    this.fcDetailFront = document.getElementById('fc-detail-front');
    this.fcDetailBack = document.getElementById('fc-detail-back');
    this.flashcardDetail = document.getElementById('flashcard-detail');

    this.btnSettings = document.getElementById('btn-settings');
    this.settingsModal = document.getElementById('settings-modal');
    this.btnCloseSettings = document.getElementById('btn-close-settings');
    this.btnSaveSettings = document.getElementById('btn-save-settings');
    this.geminiKeyInput = document.getElementById('gemini-key-input');
    this.modelSelect = document.getElementById('model-select');
    this.statusDot = document.getElementById('status-dot');
    this.statusText = document.getElementById('status-text');
  }

  initTheme() {
    document.documentElement.setAttribute('data-theme', this.currentTheme);
    if (this.themeSelect) this.themeSelect.value = this.currentTheme;
  }

  setTheme(themeName) {
    this.currentTheme = themeName;
    document.documentElement.setAttribute('data-theme', themeName);
    localStorage.setItem('syllabus_theme', themeName);
  }

  createNewSessionId() {
    return 'session_' + Date.now();
  }

  loadSessions() {
    try {
      const stored = localStorage.getItem('syllabus_sessions');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  saveSessions() {
    localStorage.setItem('syllabus_sessions', JSON.stringify(this.sessions));
  }

  getActiveSession() {
    return this.sessions.find(s => s.id === this.activeSessionId);
  }

  createNewChat() {
    const newSession = {
      id: this.createNewSessionId(),
      title: 'New Conversation',
      messages: [],
      timestamp: Date.now()
    };
    this.sessions.unshift(newSession);
    this.activeSessionId = newSession.id;
    this.saveSessions();
    this.renderSessionsList();
    this.renderActiveSessionMessages();
    this.chatInput.focus();
  }

  switchSession(sessionId) {
    this.activeSessionId = sessionId;
    this.renderSessionsList();
    this.renderActiveSessionMessages();
  }

  deleteSession(sessionId, event) {
    if (event) event.stopPropagation();
    this.sessions = this.sessions.filter(s => s.id !== sessionId);
    if (this.activeSessionId === sessionId) {
      this.activeSessionId = this.sessions.length > 0 ? this.sessions[0].id : this.createNewSessionId();
      if (this.sessions.length === 0) {
        this.createNewChat();
        return;
      }
    }
    this.saveSessions();
    this.renderSessionsList();
    this.renderActiveSessionMessages();
  }

  renderSessionsList() {
    if (!this.sessionsListEl) return;
    this.sessionsListEl.innerHTML = '';
    
    if (this.sessions.length === 0) {
      this.createNewChat();
      return;
    }

    this.sessions.forEach(sess => {
      const item = document.createElement('div');
      item.className = `session-item ${sess.id === this.activeSessionId ? 'active' : ''}`;
      item.innerHTML = `
        <span class="session-title">💬 ${this.escapeHtml(sess.title)}</span>
        <button class="session-delete-btn" title="Delete conversation">&times;</button>
      `;
      item.addEventListener('click', () => this.switchSession(sess.id));
      const delBtn = item.querySelector('.session-delete-btn');
      delBtn.addEventListener('click', (e) => this.deleteSession(sess.id, e));
      this.sessionsListEl.appendChild(item);
    });
  }

  initEventListeners() {
    this.themeSelect?.addEventListener('change', (e) => this.setTheme(e.target.value));
    this.modeAgentBtn?.addEventListener('click', () => this.setMode('agent'));
    this.modeStrictBtn?.addEventListener('click', () => this.setMode('strict'));
    this.personaSelect?.addEventListener('change', (e) => this.currentPersona = e.target.value);

    this.btnToggleCanvas?.addEventListener('click', () => this.canvas.toggle());
    this.btnToggleSidebar?.addEventListener('click', () => this.sidebar?.classList.toggle('collapsed'));
    this.btnNewChat?.addEventListener('click', () => this.createNewChat());

    this.tabButtons.forEach(btn => {
      btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
    });

    this.btnSendChat?.addEventListener('click', () => this.handleSendMessage());
    this.chatInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.handleSendMessage();
      }
    });

    this.chatInput?.addEventListener('input', () => {
      this.chatInput.style.height = 'auto';
      this.chatInput.style.height = Math.min(this.chatInput.scrollHeight, 140) + 'px';
    });

    this.btnClearChat?.addEventListener('click', () => {
      const activeSess = this.getActiveSession();
      if (activeSess) {
        activeSess.messages = [];
        this.saveSessions();
        this.renderActiveSessionMessages();
      }
    });

    document.addEventListener('click', (e) => {
      const chip = e.target.closest('.prompt-chip');
      if (chip) {
        const query = chip.dataset.query;
        if (query && this.chatInput) {
          this.chatInput.value = query;
          this.handleSendMessage();
        }
      }
    });

    this.btnGenerateQuiz?.addEventListener('click', () => this.generateQuiz());
    this.btnSubmitQuiz?.addEventListener('click', () => this.submitQuiz());
    this.btnExportWorksheet?.addEventListener('click', () => this.exportWorksheet());

    this.dropZone?.addEventListener('click', () => this.fileInput?.click());
    this.fileInput?.addEventListener('change', (e) => this.uploadFiles(e.target.files));
    this.btnLoadSample?.addEventListener('click', () => this.loadSampleMaterial());
    this.btnClearDocs?.addEventListener('click', () => this.clearAllDocs());

    this.btnGenerateCards?.addEventListener('click', () => this.generateFlashcards());
    this.btnGenerateCheatsheet?.addEventListener('click', () => this.generateCheatsheet());
    this.btnDownloadCheatsheet?.addEventListener('click', () => this.downloadCheatsheet());

    // Flashcard interaction event listeners
    this.btnFlipFlashcard?.addEventListener('click', () => this.flipFlashcard());
    this.btnCloseFlashcardDetail?.addEventListener('click', () => this.closeFlashcardDetail());
    // Star rating inside the flashcard detail modal
    document.querySelectorAll('#flashcard-detail .star-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.rateFlashcard(parseInt(btn.dataset.rating) || 1);
      });
    });
    document.addEventListener('click', (e) => {
      const detail = document.getElementById('flashcard-detail');
      if (detail && detail.classList.contains('active')) {
        // Close only when clicking outside both the detail card AND any flashcard item
        if (!detail.contains(e.target) && !e.target.closest('.flashcard-item')) {
          this.closeFlashcardDetail();
        }
      }
    });

    this.btnSettings?.addEventListener('click', () => this.settingsModal.style.display = 'flex');
    this.btnCloseSettings?.addEventListener('click', () => this.settingsModal.style.display = 'none');
    this.settingsModal?.addEventListener('click', (e) => {
      if (e.target === this.settingsModal) this.settingsModal.style.display = 'none';
    });
    this.btnSaveSettings?.addEventListener('click', () => this.saveSettings());

    // Drag-and-drop visual feedback on the drop zone
    this.dropZone?.addEventListener('dragover', (e) => {
      e.preventDefault();
      this.dropZone.classList.add('drag-over');
    });
    this.dropZone?.addEventListener('dragleave', () => {
      this.dropZone.classList.remove('drag-over');
    });
    this.dropZone?.addEventListener('drop', (e) => {
      e.preventDefault();
      this.dropZone.classList.remove('drag-over');
      const files = e.dataTransfer?.files;
      if (files && files.length > 0) this.uploadFiles(files);
    });
  }

  setMode(mode) {
    this.currentMode = mode;
    if (mode === 'agent') {
      this.modeAgentBtn.classList.add('active');
      this.modeStrictBtn.classList.remove('active');
    } else {
      this.modeStrictBtn.classList.add('active');
      this.modeAgentBtn.classList.remove('active');
    }
  }

  switchTab(tabId) {
    this.tabButtons.forEach(b => b.classList.toggle('active', b.dataset.tab === tabId));
    this.tabPanes.forEach(p => p.classList.toggle('active', p.id === tabId));
    if (tabId === 'tab-graph') {
      this.graph?.resizeCanvas();
      this.graph?.fetchGraphData();
    }
    if (tabId === 'tab-analytics') {
      this.analytics?.fetchAnalytics();
    }
    /* Trigger 3D camera glide if scene is loaded */
    if (window.__SyllabusAI_3D?.scene) {
      window.__SyllabusAI_3D.scene.goToTab(tabId);
    }
  }

  launchTopicQuiz(topic) {
    this.switchTab('tab-exam');
    const topicInput = document.getElementById('quiz-topic');
    if (topicInput) topicInput.value = topic;
    this.generateQuiz();
  }

  initVoiceInput() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      if (this.btnVoiceInput) this.btnVoiceInput.style.display = 'none';
      return;
    }

    this.speechRecognition = new SpeechRecognition();
    this.speechRecognition.continuous = false;
    this.speechRecognition.interimResults = false;
    this.speechRecognition.lang = 'en-US';

    this.speechRecognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      if (transcript && this.chatInput) {
        this.chatInput.value += (this.chatInput.value ? ' ' : '') + transcript;
        this.chatInput.focus();
      }
    };

    this.speechRecognition.onend = () => {
      this.isRecordingVoice = false;
      this.btnVoiceInput?.classList.remove('recording');
    };

    this.btnVoiceInput?.addEventListener('click', () => {
      if (!this.speechRecognition) return;
      if (!this.isRecordingVoice) {
        try {
          this.speechRecognition.start();
          this.isRecordingVoice = true;
          this.btnVoiceInput.classList.add('recording');
        } catch {}
      } else {
        this.speechRecognition.stop();
        this.isRecordingVoice = false;
        this.btnVoiceInput.classList.remove('recording');
      }
    });
  }

  renderActiveSessionMessages() {
    const activeSess = this.getActiveSession();
    if (!activeSess || activeSess.messages.length === 0) {
      this.chatMessages.innerHTML = `
        <div class="welcome-hero-card">
          <div class="welcome-badge">
            <span class="pulse-sparkle">✨</span> 2026 Grounded Intelligence
          </div>
          <h1 class="welcome-title">
            Ask anything about your <span class="gradient-title-text">Course Syllabus</span>
          </h1>
          <p class="welcome-desc">
            SyllabusAI blends multi-modal conversational intelligence with lexical BM25 and dense vector ranking over your actual uploaded textbooks, lectures, and exams.
          </p>
          <div class="prompt-discovery-grid">
            <button class="prompt-chip" data-query="Explain Dijkstra's Banker's Algorithm with safe sequence logic and deadlock prevention.">
              <span class="chip-glow-icon">🔒</span>
              <div class="chip-content">
                <strong>Banker's Algorithm</strong>
                <small>Deadlock prevention & safe states</small>
              </div>
            </button>
            <button class="prompt-chip" data-query="Write python code to reverse a singly linked list and analyze its time & space complexity.">
              <span class="chip-glow-icon">💻</span>
              <div class="chip-content">
                <strong>Reverse Linked List</strong>
                <small>Python 3-pointer implementation</small>
              </div>
            </button>
            <button class="prompt-chip" data-query="What is the Effective Memory Access Time (EMAT) formula from my notes?">
              <span class="chip-glow-icon">📐</span>
              <div class="chip-content">
                <strong>EMAT Formula</strong>
                <small>TLB hit ratio & access times</small>
              </div>
            </button>
            <button class="prompt-chip" data-query="What is Belady's Anomaly in FIFO page replacement and how does LRU fix it?">
              <span class="chip-glow-icon">⚡</span>
              <div class="chip-content">
                <strong>Belady's Anomaly</strong>
                <small>FIFO vs LRU page replacement</small>
              </div>
            </button>
          </div>
        </div>
      `;
      return;
    }

    this.chatMessages.innerHTML = '';
    activeSess.messages.forEach(msg => {
      this.appendMessageElement(msg.role, msg.content, msg.citations, false);
    });
    this.scrollToBottom();
    this.renderMath();
  }

  async handleSendMessage(customPrompt = null) {
    const text = customPrompt || this.chatInput.value.trim();
    if (!text || this.isStreaming) return;

    if (!customPrompt) {
      this.chatInput.value = '';
      this.chatInput.style.height = 'auto';
    }

    const activeSess = this.getActiveSession();
    if (!activeSess) return;

    if (activeSess.messages.length === 0) {
      activeSess.title = text.length > 28 ? text.substring(0, 28) + '...' : text;
      this.saveSessions();
      this.renderSessionsList();
    }

    activeSess.messages.push({ role: 'user', content: text, citations: [] });
    this.saveSessions();
    this.appendMessageElement('user', text, [], false);
    this.scrollToBottom();

    const agentMsgEl = this.appendMessageElement('agent', '', [], true);
    const contentEl = agentMsgEl.querySelector('.message-body');
    const citationsContainer = agentMsgEl.querySelector('.citations-box');
    const quickActionsContainer = agentMsgEl.querySelector('.quick-actions-bar');
    this.isStreaming = true;

    try {
      // Fail fast with an actionable message when the page isn't served by the
      // backend (e.g. index.html opened directly from disk) — fetch('/api/...')
      // can never succeed under file:// protocol.
      if (window.location.protocol === 'file:') {
        throw Object.assign(new Error('You opened index.html directly from disk. Start the backend with "python server.py" and open http://localhost:8000 so the AI API is reachable.'), { friendly: true });
      }

      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: text,
          mode: this.currentMode,
          persona: this.currentPersona,
          filter_source: this.chatDocFilter?.value || 'All Documents',
          chat_history: activeSess.messages.map(m => ({ role: m.role, content: m.content }))
        })
      });

      // Surface server-side errors (invalid API key, quota exceeded, 500s)
      // instead of silently parsing an HTML/JSON error body as an SSE stream.
      if (!response.ok || !response.body) {
        let detail = `Server responded with status ${response.status}`;
        try {
          const errData = await response.json();
          if (errData?.detail) {
            detail = typeof errData.detail === 'string' ? errData.detail : JSON.stringify(errData.detail);
          }
        } catch { /* non-JSON error body — keep the status-code message */ }
        throw Object.assign(new Error(detail), { friendly: true });
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullAgentText = '';
      let collectedCitations = [];
      let sseBuffer = '';
      let lastRenderTime = 0;
      let pendingRender = null;

      const renderStreamingContent = (force = false) => {
        // Throttle markdown re-parsing to ~20fps to prevent layout jitter,
        // but always render immediately on the final token.
        const now = performance.now();
        if (!force && now - lastRenderTime < 50) {
          if (!pendingRender) {
            pendingRender = setTimeout(() => {
              pendingRender = null;
              renderStreamingContent(true);
            }, 50);
          }
          return;
        }
        lastRenderTime = now;
        contentEl.innerHTML = this.renderMarkdown(fullAgentText) + '<span class="typing-cursor"></span>';
        // Only auto-scroll if the user is already near the bottom (prevents scroll-fighting)
        const nearBottom = this.chatMessages.scrollHeight - this.chatMessages.scrollTop - this.chatMessages.clientHeight < 120;
        if (nearBottom) this.scrollToBottom();
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        sseBuffer += decoder.decode(value, { stream: true });

        // Buffer incomplete SSE lines — splitting raw network chunks mid-line
        // used to corrupt JSON payloads and drop tokens (visible rendering glitch).
        const lines = sseBuffer.split('\n');
        sseBuffer = lines.pop(); // keep the trailing partial line in the buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.substring(6));
              if (data.token) {
                fullAgentText += data.token;
                renderStreamingContent();
              }
              if (data.citations && data.citations.length > 0) {
                collectedCitations = data.citations;
              }
            } catch {}
          }
        }
      }

      if (pendingRender) { clearTimeout(pendingRender); pendingRender = null; }

      if (!fullAgentText.trim()) {
        // Stream ended cleanly but produced no tokens — almost always an API
        // key / quota / upstream-model problem rather than a network failure.
        contentEl.innerHTML = `
          <div style="color:#f59e0b; line-height:1.6;">
            ⚠️ <strong>The agent returned an empty response.</strong><br>
            <small>Please verify your Gemini API key in ⚙️ <strong>Settings</strong>, check your API quota, and try again. The backend may also have rejected the model request — see the server console for details.</small>
          </div>`;
      } else {
        contentEl.innerHTML = this.renderMarkdown(fullAgentText);
      }
      
      if (collectedCitations.length > 0) {
        citationsContainer.style.display = 'block';
        citationsContainer.innerHTML = `
          <div class="citations-title">📌 Verified Syllabus Citations (Click to Inspect):</div>
          ${collectedCitations.map(c => `
            <span class="citation-badge" data-source="${this.escapeHtml(c.source)}" data-page="${c.page}" data-sim="${c.similarity || 0.95}">
              📄 ${this.escapeHtml(c.source)} (Page ${c.page})
            </span>
          `).join('')}
        `;

        citationsContainer.querySelectorAll('.citation-badge').forEach((badge, idx) => {
          badge.addEventListener('click', () => {
            const cit = collectedCitations[idx];
            this.canvas.openCitation(cit.source, cit.page, cit.snippet, cit.similarity || 0.95);
          });
        });
      }

      if (quickActionsContainer) {
        quickActionsContainer.style.display = 'flex';
        this.attachQuickActionListeners(quickActionsContainer, fullAgentText, collectedCitations);
      }

      activeSess.messages.push({
        role: 'agent',
        content: fullAgentText,
        citations: collectedCitations
      });
      this.saveSessions();
      this.renderMath();

    } catch (err) {
      console.error('Chat error:', err);
      const reason = err?.message || 'Unknown network error';
      const hint = err?.friendly ? '' : '<br><small>If the backend is not running, start it with <code style="background:rgba(255,255,255,0.1);padding:1px 5px;border-radius:4px;">python server.py</code> and open <strong>http://localhost:8000</strong>.</small>';
      contentEl.innerHTML = `
        <div style="color:#ef4444; line-height:1.6;">
          ⚠️ <strong>Could not reach the AI agent.</strong><br>
          <small>${this.escapeHtml(reason)}</small>${hint}
        </div>`;
    } finally {
      this.isStreaming = false;
      this.scrollToBottom();
    }
  }

  appendMessageElement(role, content, citations = [], isStreaming = false) {
    const welcomeCard = this.chatMessages.querySelector('.welcome-hero-card');
    if (welcomeCard) welcomeCard.remove();

    const bubble = document.createElement('div');
    bubble.className = `message-bubble ${role}-message`;
    const avatar = role === 'user' ? '👤' : (this.currentMode === 'agent' ? '🤖' : '🎓');
    const headerTitle = role === 'user' ? 'You' : `SyllabusAI (${this.getPersonaName()})`;

    bubble.innerHTML = `
      <div class="message-avatar">${avatar}</div>
      <div class="message-content">
        <div class="message-header">${headerTitle}</div>
        <div class="message-body">${this.renderMarkdown(content)}${isStreaming ? '<span class="typing-cursor"></span>' : ''}</div>
        <div class="citations-box" style="${citations.length > 0 ? 'display:block;' : 'display:none;'}">
          ${citations.length > 0 ? `
            <div class="citations-title">📌 Verified Syllabus Citations:</div>
            ${citations.map(c => `
              <span class="citation-badge" data-source="${this.escapeHtml(c.source)}" data-page="${c.page}">
                📄 ${this.escapeHtml(c.source)} (Page ${c.page})
              </span>
            `).join('')}
          ` : ''}
        </div>
        ${role === 'agent' ? `
          <div class="quick-actions-bar" style="${isStreaming ? 'display:none;' : 'display:flex;'}">
            <button class="quick-action-pill" data-action="eli5">⚡ Explain Simpler</button>
            <button class="quick-action-pill" data-action="quiz">📝 3 Practice Questions</button>
            <button class="quick-action-pill" data-action="flashcard">🃏 Create Flashcard</button>
            <button class="quick-action-pill" data-action="analogy">💡 Real-World Analogy</button>
            <button class="quick-action-pill" data-action="canvas">🎨 Open in Studio</button>
          </div>
        ` : ''}
      </div>
    `;

    if (role === 'agent' && citations.length > 0) {
      bubble.querySelectorAll('.citation-badge').forEach((badge, idx) => {
        badge.addEventListener('click', () => {
          const cit = citations[idx];
          if (cit) this.canvas.openCitation(cit.source, cit.page, cit.snippet, cit.similarity || 0.95);
        });
      });
    }

    if (role === 'agent' && !isStreaming) {
      const bar = bubble.querySelector('.quick-actions-bar');
      if (bar) this.attachQuickActionListeners(bar, content, citations);
    }

    this.chatMessages.appendChild(bubble);
    return bubble;
  }

  attachQuickActionListeners(bar, agentText, citations) {
    bar.querySelectorAll('.quick-action-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        const action = pill.dataset.action;
        if (action === 'eli5') {
          this.handleSendMessage('Explain the above concept in very simple, intuitive terms (ELI5) for a beginner.');
        } else if (action === 'quiz') {
          this.handleSendMessage('Generate 3 challenging multiple-choice practice exam questions based on the above topic with answer rationales.');
        } else if (action === 'analogy') {
          this.handleSendMessage('Provide a vivid, real-world engineering analogy that explains the above concept effortlessly.');
        } else if (action === 'flashcard') {
          this.switchTab('tab-flashcards');
          this.generateFlashcards();
        } else if (action === 'canvas') {
          const codeMatch = agentText.match(/```([a-zA-Z]*)\n([\s\S]*?)```/);
          if (codeMatch) {
            this.canvas.openCode('Algorithm & Code Studio', codeMatch[2], codeMatch[1] || 'python');
          } else if (citations && citations.length > 0) {
            this.canvas.openCitation(citations[0].source, citations[0].page, citations[0].snippet);
          } else {
            this.canvas.openNotes('Derivations & Notes', agentText);
          }
        }
      });
    });
  }

  getPersonaName() {
    const names = {
      general: 'ChatGPT All-Rounder',
      professor: 'Academic Professor',
      socratic: 'Socratic Tutor',
      coding_mentor: 'Code Mentor'
    };
    return names[this.currentPersona] || 'AI Agent';
  }

  /* --- Sidebar Toggle --- */
  toggleChatSidebar() {
    const sidebar = document.getElementById('chat-sidebar');
    const main = document.querySelector('.workspace-layout');
    if (sidebar) {
      sidebar.classList.toggle('collapsed');
      if (main) {
        main.classList.toggle('sidebar-collapsed');
      }
    }
  }

  renderMarkdown(text) {
    if (!text) return '';
    let parsed = this.escapeHtml(text);

    parsed = parsed.replace(/```([a-zA-Z]*)\n([\s\S]*?)```/g, (match, lang, code) => {
      return `<pre><code class="language-${lang}">${code.trim()}</code></pre>`;
    });

    parsed = parsed.replace(/`([^`]+)`/g, '<code>$1</code>');
    parsed = parsed.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    parsed = parsed.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    parsed = parsed.replace(/^# (.*$)/gim, '<h1>$1</h1>');
    parsed = parsed.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    parsed = parsed.replace(/\*(.*?)\*/g, '<em>$1</em>');
    parsed = parsed.replace(/^\s*-\s+(.*$)/gim, '<li>$1</li>');
    parsed = parsed.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
    parsed = parsed.replace(/\n\n/g, '<br><br>');

    return parsed;
  }

  renderMath(targetEl = null) {
    const el = targetEl || this.chatMessages;
    if (window.renderMathInElement && el) {
      window.renderMathInElement(el, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '$', right: '$', display: false },
          { left: '\\[', right: '\\]', display: true },
          { left: '\\(', right: '\\)', display: false }
        ],
        throwOnError: false
      });
    }
  }

  scrollToBottom() {
    this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
  }

  /* --- EXAM ARENA --- */
  async generateQuiz() {
    const topic = document.getElementById('quiz-topic')?.value || 'General Operating Systems';
    const num = parseInt(document.getElementById('quiz-count')?.value || '5');
    const diff = document.getElementById('quiz-difficulty')?.value || 'Medium';
    const qType = document.getElementById('quiz-type')?.value || 'MCQ';

    this.quizContainer.innerHTML = '<div class="empty-state-card"><div class="empty-icon-glow">⏳</div><h3>Generating Assessment Questions...</h3></div>';
    this.quizResults.style.display = 'none';
    this.quizFooter.style.display = 'none';
    this.btnExportWorksheet.style.display = 'none';

    try {
      const res = await fetch('/api/quiz/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, num_questions: num, difficulty: diff, quiz_type: qType })
      });
      const data = await res.json();
      this.activeQuiz = data.quiz;
      this.renderQuiz(data.quiz, qType);
    } catch {
      this.quizContainer.innerHTML = '<div class="empty-state-card"><p style="color:#ef4444;">Failed to generate quiz.</p></div>';
    }
  }

  renderQuiz(questions, qType) {
    if (!questions || questions.length === 0) {
      this.quizContainer.innerHTML = '<div class="empty-state-card"><p>No questions generated.</p></div>';
      return;
    }

    this.btnExportWorksheet.style.display = 'inline-block';
    this.quizContainer.innerHTML = '';

    questions.forEach((q, idx) => {
      const card = document.createElement('div');
      card.className = 'question-card';
      let optionsHtml = '';

      if (qType === 'MCQ' && q.options) {
        // Normalize options: the backend sends an ARRAY like ["A. text", "B. text"].
        // Object.entries() on an array yields numeric indices (0,1,2...) which
        // broke answer selection and grading. Extract the real letter labels.
        let entries = [];
        if (Array.isArray(q.options)) {
          entries = q.options.map((v, i) => {
            const s = String(v);
            const m = s.match(/^\(?([A-Da-d])[\.\)\:]\s*(.+)$/);
            return m ? [m[1].toUpperCase(), m[2]] : [String.fromCharCode(65 + i), s];
          });
        } else if (q.options && typeof q.options === 'object') {
          entries = Object.entries(q.options);
        }

        optionsHtml = `
          <div class="options-list" data-qid="${q.id}">
            ${entries.map(([k, v]) => `
              <div class="option-item" data-opt="${k}">
                <strong>(${k})</strong> ${this.escapeHtml(String(v))}
              </div>
            `).join('')}
          </div>
        `;
      } else {
        optionsHtml = `
          <div class="descriptive-field">
            <textarea class="modern-input" rows="3" placeholder="Write your derivation or answer here..." style="width:100%;"></textarea>
          </div>
        `;
      }

      card.innerHTML = `
        <div class="question-text"><strong>Q${idx + 1}:</strong> ${this.escapeHtml(q.question)}</div>
        ${optionsHtml}
      `;
      this.quizContainer.appendChild(card);
    });

    if (qType === 'MCQ') {
      this.quizContainer.querySelectorAll('.option-item').forEach(opt => {
        opt.addEventListener('click', () => {
          const parent = opt.closest('.options-list');
          parent.querySelectorAll('.option-item').forEach(o => o.classList.remove('selected'));
          opt.classList.add('selected');
        });
      });
      this.quizFooter.style.display = 'block';
    } else {
      this.quizFooter.style.display = 'none';
    }
  }

  async submitQuiz() {
    if (!this.activeQuiz) return;
    const userAnswers = {};
    let answeredCount = 0;
    this.quizContainer.querySelectorAll('.options-list').forEach(list => {
      const qid = parseInt(list.dataset.qid);
      const selected = list.querySelector('.option-item.selected');
      if (selected) {
        userAnswers[qid] = selected.dataset.opt;
        answeredCount++;
      }
    });

    if (answeredCount < this.activeQuiz.length) {
      const unanswered = this.activeQuiz.length - answeredCount;
      if (!confirm(`${unanswered} question(s) are still unanswered. Submit anyway?`)) return;
    }

    try {
      const res = await fetch('/api/quiz/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quiz: this.activeQuiz, user_answers: userAnswers })
      });
      const result = await res.json();
      this.renderScorecard(result);
    } catch (e) {
      console.error(e);
    }
  }

  renderScorecard(res) {
    this.quizResults.style.display = 'block';
    const gradeColor = res.score_percentage >= 85 ? 'var(--accent-emerald)' : (res.score_percentage >= 60 ? 'var(--accent-amber)' : '#ef4444');
    const gradeEmoji = res.score_percentage >= 85 ? '🏆' : (res.score_percentage >= 60 ? '📈' : '📖');

    let feedbackHtml = '';
    if (res.feedback && res.feedback.length > 0) {
      feedbackHtml = `
        <div style="margin-top:18px;">
          <h4 style="margin-bottom:10px;font-size:14px;color:var(--text-muted);">📋 Question Breakdown:</h4>
          ${res.feedback.map((f, i) => `
            <div style="background:var(--bg-secondary);border-radius:12px;padding:12px 15px;margin-bottom:8px;border-left:3px solid ${f.is_correct ? 'var(--accent-emerald)' : '#ef4444'};">
              <div style="font-size:12.5px;font-weight:600;color:var(--text-main);margin-bottom:4px;">
                ${f.is_correct ? '✅' : '❌'} Q${i + 1}: ${this.escapeHtml(f.question)}
              </div>
              ${!f.is_correct ? `<div style="font-size:12px;color:var(--text-muted);">Your answer: <em>${this.escapeHtml(f.user_answer || 'Not answered')}</em> | Correct: <strong style="color:var(--accent-emerald)">${this.escapeHtml(f.correct_answer)}</strong></div>` : ''}
              ${f.explanation ? `<div style="font-size:11.5px;color:var(--text-muted);margin-top:3px;">${this.escapeHtml(f.explanation)}</div>` : ''}
            </div>
          `).join('')}
        </div>
      `;
    }

    this.quizResults.innerHTML = `
      <div class="scorecard">
        <h3>${gradeEmoji} Exam Performance Scorecard</h3>
        <div class="score-badge" style="color:${gradeColor}">${res.score_percentage}%</div>
        <p><strong>Grade:</strong> <span style="color:${gradeColor}">${res.grade}</span> &nbsp;|&nbsp; Correct: ${res.correct_count} / ${res.total_questions}</p>
        ${feedbackHtml}
      </div>
    `;
    this.quizResults.scrollIntoView({ behavior: 'smooth' });
    this._toast(`${gradeEmoji} Quiz submitted! Score: ${res.score_percentage}%`, res.score_percentage >= 70 ? 'success' : 'info');
  }

  async exportWorksheet() {
    if (!this.activeQuiz) return;
    const topic = document.getElementById('quiz-topic')?.value || 'Academic Practice Exam';
    const qType = document.getElementById('quiz-type')?.value || 'MCQ';

    try {
      const res = await fetch('/api/quiz/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quiz: this.activeQuiz, topic, quiz_type: qType, include_answers: true })
      });
      const data = await res.json();
      
      const blob = new Blob([data.markdown], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = data.filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Failed to export worksheet.');
    }
  }

  /* --- FLASHCARDS --- */
  async generateFlashcards() {
    const topic = document.getElementById('flashcard-topic')?.value || 'Core Concepts';
    this.flashcardsContainer.innerHTML = '<div class="empty-state-card"><div class="empty-icon-glow">⏳</div><h3>Building 3D Flashcard Deck...</h3></div>';

    try {
      const res = await fetch('/api/flashcards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, num_cards: 6, filter_source: this.chatDocFilter?.value || 'All Documents' })
      });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data = await res.json();
      if (!data.flashcards || data.flashcards.length === 0) {
        this.flashcardsContainer.innerHTML = `
          <div class="empty-state-card">
            <div class="empty-icon-glow">📭</div>
            <h3>No Flashcards Generated</h3>
            <p>Upload course documents in the Document Hub first, or try a different topic.</p>
          </div>`;
        return;
      }
      this.renderFlashcards(data.flashcards);
    } catch (err) {
      console.error('Flashcard generation failed:', err);
      this.flashcardsContainer.innerHTML = '<div class="empty-state-card"><p style="color:#ef4444;">⚠️ Failed to generate flashcards. Check that the server is running.</p></div>';
    }
  }

  renderFlashcards(cards) {
    if (!cards || cards.length === 0) return;
    this.flashcardsContainer.innerHTML = '';

    cards.forEach((c, idx) => {
      const wrap = document.createElement('div');
      wrap.className = 'flashcard-item';
      wrap.dataset.cardIndex = idx;
      wrap.innerHTML = `
        <div class="flashcard-item-header">
          <span class="flashcard-number">Card ${idx + 1}</span>
          <span class="flashcard-source-tag">${this.escapeHtml(c.source_doc || 'Course Material')}, Page ${c.source_page || '-'}</span>
        </div>
        <div class="flashcard-front">
          <div class="flashcard-label">QUESTION</div>
          <p>${this.escapeHtml(c.front || '')}</p>
          <div class="flashcard-label" style="margin-top:10px;">Click to Review →</div>
        </div>
      `;

      wrap.addEventListener('click', () => this.showFlashcardDetail(c));

      this.flashcardsContainer.appendChild(wrap);
    });
  }

  async generateCheatsheet() {
    try {
      const res = await fetch('/api/cheatsheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const data = await res.json();
      this.cheatsheetOutput.style.display = 'block';
      this.cheatsheetContent.innerHTML = this.renderMarkdown(data.cheatsheet);
      this.cheatsheetContent.scrollIntoView({ behavior: 'smooth' });
    } catch {}
  }

  downloadCheatsheet() {
    const text = this.cheatsheetContent.innerText;
    const blob = new Blob([text], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'High_Yield_Revision_Cheatsheet.md';
    a.click();
    URL.revokeObjectURL(url);
  }

  /* --- FLASHCARD INTERACTION --- */
  showFlashcardDetail(card) {
    const detail = document.getElementById('flashcard-detail');
    if (!detail) return;

    document.getElementById('fc-detail-topic').textContent = card.topic || 'Key Concept';
    document.getElementById('fc-detail-source').textContent = card.source_doc ? `${card.source_doc}, Page ${card.source_page}` : '';
    document.getElementById('fc-detail-front').textContent = card.front || 'No content';
    document.getElementById('fc-detail-back').textContent = card.back || 'No content';

    detail.style.display = 'block';
    detail.classList.add('active');

    this.currentFlashcard = card;
    this.flashcardFlipped = false;

    // Reset flip state
    const back = detail.querySelector('.flashcard-back');
    const front = detail.querySelector('.flashcard-front');
    const flipBtn = document.getElementById('btn-flip-flashcard');
    if (back) back.style.display = 'none';
    if (front) front.style.display = 'block';
    if (flipBtn) flipBtn.textContent = '🔄 Flip to See Answer';

    // Reset rating
    const stars = detail.querySelectorAll('.star-btn');
    stars.forEach(s => s.classList.remove('active'));
  }

  closeFlashcardDetail() {
    const detail = document.getElementById('flashcard-detail');
    if (detail) {
      detail.style.display = 'none';
      detail.classList.remove('active');
    }
    this.currentFlashcard = null;
  }

  flipFlashcard() {
    const detail = document.getElementById('flashcard-detail');
    if (!detail) return;

    this.flashcardFlipped = !this.flashcardFlipped;

    const back = detail.querySelector('.flashcard-back');
    const front = detail.querySelector('.flashcard-front');
    const flipBtn = document.getElementById('btn-flip-flashcard');

    if (this.flashcardFlipped) {
      if (back) back.style.display = 'block';
      if (front) front.style.display = 'none';
      if (flipBtn) flipBtn.textContent = '🔄 Show Question';
    } else {
      if (back) back.style.display = 'none';
      if (front) front.style.display = 'block';
      if (flipBtn) flipBtn.textContent = '🔄 Flip to See Answer';
    }
  }

  rateFlashcard(rating) {
    const detail = document.getElementById('flashcard-detail');
    if (!detail) return;

    const stars = detail.querySelectorAll('.star-btn');
    stars.forEach((star, index) => {
      if (index < rating) {
        star.classList.add('active');
        star.textContent = '⭐';
      } else {
        star.classList.remove('active');
        star.textContent = '⬜';
      }
    });

    // Save rating to card if tracking
    if (this.currentFlashcard) {
      this.currentFlashcard.userRating = rating;
    }

    // Auto-close after rating (optional - could also keep open)
    setTimeout(() => {
      this.closeFlashcardDetail();
    }, 800);
  }

  /* --- SYSTEM STATUS & DOCS --- */
  async fetchSystemStatus() {
    try {
      const res = await fetch('/api/status');
      const data = await res.json();
      if (this.docCountBadge) this.docCountBadge.innerText = data.total_documents;
      if (this.statusDot) this.statusDot.className = 'status-dot online';
      if (this.statusText) this.statusText.innerText = `${data.total_documents} Docs (${data.total_chunks} Chunks)`;

      if (this.chatDocFilter) {
        this.chatDocFilter.innerHTML = '<option value="All Documents">All Syllabus Documents</option>';
        data.documents.forEach(d => {
          this.chatDocFilter.innerHTML += `<option value="${d.source}">${d.source}</option>`;
        });
      }

      this.renderDocsTable(data.documents);
    } catch {
      if (this.statusDot) this.statusDot.className = 'status-dot';
      if (this.statusText) this.statusText.innerText = 'Engine Offline';
    }
  }

  renderDocsTable(docs) {
    if (!this.docsTableContainer) return;
    if (!docs || docs.length === 0) {
      this.docsTableContainer.innerHTML = '<div class="empty-state-card"><p>No documents uploaded yet.</p></div>';
      return;
    }

    let html = '<div class="doc-items-list" style="display:flex; flex-direction:column; gap:10px;">';
    docs.forEach(d => {
      html += `
        <div class="doc-row" style="display:flex; justify-content:space-between; align-items:center; padding:12px 14px; background:var(--bg-secondary); border-radius:12px; border:1px solid var(--border-subtle);">
          <div>
            <strong style="color:var(--text-main); font-size:13px;">📄 ${this.escapeHtml(d.source)}</strong>
            <div style="font-size:11px; color:var(--text-muted); margin-top:2px;">${d.total_pages} Pages | ${d.chunk_count} Chunks | ${d.total_chars} chars</div>
          </div>
          <button class="danger-glass-btn" onclick="app.deleteDoc('${d.source}')">Delete</button>
        </div>
      `;
    });
    html += '</div>';
    this.docsTableContainer.innerHTML = html;
  }

  async deleteDoc(sourceName) {
    if (!confirm(`Remove "${sourceName}" from syllabus index?`)) return;
    await fetch(`/api/documents/${encodeURIComponent(sourceName)}`, { method: 'DELETE' });
    this.fetchSystemStatus();
  }

  async uploadFiles(files) {
    if (!files || files.length === 0) return;
    const formData = new FormData();
    for (let f of files) formData.append('files', f);

    this._toast('📤 Uploading and indexing documents...', 'info');
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      this._toast(`✅ ${data.files?.length || 1} file(s) indexed (${data.chunks_indexed || 0} chunks)`, 'success');
      this.fetchSystemStatus();
    } catch {
      this._toast('⚠️ Upload failed. Please try again.', 'error');
    }
  }

  async loadSampleMaterial() {
    try {
      await fetch('/api/sample/load', { method: 'POST' });
      this.fetchSystemStatus();
    } catch {}
  }

  async clearAllDocs() {
    if (!confirm('Clear all indexed documents?')) return;
    await fetch('/api/clear', { method: 'POST' });
    this.fetchSystemStatus();
  }

  async saveSettings() {
    const key = this.geminiKeyInput?.value?.trim();
    const model = this.modelSelect?.value;
    if (key) {
      try {
        await fetch('/api/config/key', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ api_key: key, model_name: model })
        });
        this._toast('✅ API Key saved! Live AI mode activated.', 'success');
      } catch {
        this._toast('⚠️ Failed to save API key. Check connection.', 'error');
      }
    } else {
      this._toast('ℹ️ Settings saved (no API key provided).', 'info');
    }
    this.settingsModal.style.display = 'none';
    this.fetchSystemStatus();
  }

  _toast(message, type = 'info') {
    const existing = document.getElementById('syllabus-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'syllabus-toast';
    const colors = { success: '#10b981', error: '#ef4444', info: '#6366f1' };
    toast.style.cssText = `
      position: fixed; bottom: 28px; right: 28px; z-index: 9999;
      background: rgba(10,12,26,0.97); border: 1px solid ${colors[type] || colors.info};
      color: #f1f5f9; padding: 14px 22px; border-radius: 14px;
      font-size: 13.5px; font-weight: 500; box-shadow: 0 8px 30px rgba(0,0,0,0.5);
      animation: toast-in 0.3s cubic-bezier(0.34,1.56,0.64,1);
      max-width: 380px; line-height: 1.5;
    `;
    toast.innerText = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3800);
  }

  escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}

let app;
window.addEventListener('DOMContentLoaded', () => {
  app = new SyllabusApp();
  /* Boot 3D scene after app is ready (three-scene.js loaded after this script) */
  requestAnimationFrame(() => {
    if (typeof window.init3DScene === 'function') {
      window.init3DScene(app);
    } else {
      /* three-scene.js may load slightly later — wait for it */
      window.__pendingInit3D = app;
    }
  });
});