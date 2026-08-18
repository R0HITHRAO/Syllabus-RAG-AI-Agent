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

    this.btnOpenSettings = document.getElementById('btn-open-settings');
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

    this.btnOpenSettings?.addEventListener('click', () => this.settingsModal.style.display = 'flex');
    this.btnCloseSettings?.addEventListener('click', () => this.settingsModal.style.display = 'none');
    this.settingsModal?.addEventListener('click', (e) => {
      if (e.target === this.settingsModal) this.settingsModal.style.display = 'none';
    });
    this.btnSaveSettings?.addEventListener('click', () => this.saveSettings());
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

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullAgentText = '';
      let collectedCitations = [];

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunkStr = decoder.decode(value, { stream: true });
        const lines = chunkStr.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.substring(6));
              if (data.token) {
                fullAgentText += data.token;
                contentEl.innerHTML = this.renderMarkdown(fullAgentText) + '<span class="typing-cursor"></span>';
                this.scrollToBottom();
              }
              if (data.citations && data.citations.length > 0) {
                collectedCitations = data.citations;
              }
            } catch {}
          }
        }
      }

      contentEl.innerHTML = this.renderMarkdown(fullAgentText);
      
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
      console.error(err);
      contentEl.innerHTML = '<span style="color:#ef4444;">⚠️ Network error communicating with agent.</span>';
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
        optionsHtml = `
          <div class="options-list" data-qid="${q.id}">
            ${Object.entries(q.options).map(([k, v]) => `
              <div class="option-item" data-opt="${k}">
                <strong>(${k})</strong> ${this.escapeHtml(v)}
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
    this.quizContainer.querySelectorAll('.options-list').forEach(list => {
      const qid = parseInt(list.dataset.qid);
      const selected = list.querySelector('.option-item.selected');
      if (selected) userAnswers[qid] = selected.dataset.opt;
    });

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
    this.quizResults.innerHTML = `
      <div class="scorecard">
        <h3>Exam Performance Scorecard</h3>
        <div class="score-badge">${res.score_percentage}%</div>
        <p><strong>Grade:</strong> ${res.grade} | Correct: ${res.correct_count} / ${res.total_questions}</p>
      </div>
    `;
    this.quizResults.scrollIntoView({ behavior: 'smooth' });
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
        body: JSON.stringify({ topic, num_cards: 6 })
      });
      const data = await res.json();
      this.renderFlashcards(data.flashcards);
    } catch {
      this.flashcardsContainer.innerHTML = '<div class="empty-state-card"><p>Failed to generate cards.</p></div>';
    }
  }

  renderFlashcards(cards) {
    if (!cards || cards.length === 0) return;
    this.flashcardsContainer.innerHTML = '';

    cards.forEach((c, idx) => {
      const wrap = document.createElement('div');
      wrap.className = 'flashcard-wrapper';
      wrap.innerHTML = `
        <div class="flashcard-inner">
          <div class="flashcard-front">
            <span class="card-badge">Card ${idx + 1}</span>
            <h4>${this.escapeHtml(c.front)}</h4>
            <span class="flip-hint">👆 Click to Flip</span>
          </div>
          <div class="flashcard-back">
            <p>${this.escapeHtml(c.back)}</p>
            <div class="card-rating-bar">
              <button class="rating-btn" title="Mastered">🟢 Easy</button>
              <button class="rating-btn" title="Reviewing">🟡 Med</button>
              <button class="rating-btn" title="Need Practice">🔴 Hard</button>
            </div>
          </div>
        </div>
      `;

      wrap.querySelector('.flashcard-inner').addEventListener('click', (e) => {
        if (!e.target.classList.contains('rating-btn')) {
          wrap.classList.toggle('flipped');
        }
      });

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

    try {
      await fetch('/api/upload', { method: 'POST', body: formData });
      this.fetchSystemStatus();
    } catch {}
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
      await fetch('/api/config/key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: key, model_name: model })
      });
    }
    this.settingsModal.style.display = 'none';
    this.fetchSystemStatus();
  }

  escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}

let app;
window.addEventListener('DOMContentLoaded', () => {
  app = new SyllabusApp();
});
