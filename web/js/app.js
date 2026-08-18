/**
 * SyllabusAI — Frontend State, Streaming Client, Multi-Session & Theme Controller
 */

class SyllabusApp {
  constructor() {
    // Application State
    this.currentMode = 'agent'; // 'agent' or 'strict'
    this.currentPersona = 'general';
    this.currentTheme = localStorage.getItem('syllabus_theme') || 'nebula';
    this.sessions = this.loadSessions();
    this.activeSessionId = this.sessions.length > 0 ? this.sessions[0].id : this.createNewSessionId();
    
    this.isStreaming = false;
    this.speechRecognition = null;
    this.isRecordingVoice = false;
    this.activeQuiz = null;

    this.initElements();
    this.initTheme();
    this.initEventListeners();
    this.initVoiceInput();
    this.renderSessionsList();
    this.renderActiveSessionMessages();
    this.fetchSystemStatus();
  }

  initElements() {
    // Theme & Navigation
    this.themeSelect = document.getElementById('theme-select');
    this.modeAgentBtn = document.getElementById('mode-agent-btn');
    this.modeStrictBtn = document.getElementById('mode-strict-btn');
    this.personaSelect = document.getElementById('persona-select');
    this.btnToggleSidebar = document.getElementById('btn-toggle-sidebar');
    this.sidebar = document.getElementById('chat-sidebar');
    this.sessionsListEl = document.getElementById('sessions-list');
    this.btnNewChat = document.getElementById('btn-new-chat');

    // Tabs
    this.tabButtons = document.querySelectorAll('.tab-btn');
    this.tabPanes = document.querySelectorAll('.tab-pane');

    // Chat
    this.chatMessages = document.getElementById('chat-messages');
    this.chatInput = document.getElementById('chat-input');
    this.btnSendChat = document.getElementById('btn-send-chat');
    this.btnClearChat = document.getElementById('btn-clear-chat');
    this.chatDocFilter = document.getElementById('chat-doc-filter');
    this.btnVoiceInput = document.getElementById('btn-voice-input');

    // Exam Arena
    this.btnGenerateQuiz = document.getElementById('btn-generate-quiz');
    this.quizContainer = document.getElementById('quiz-container');
    this.quizFooter = document.getElementById('quiz-footer');
    this.btnSubmitQuiz = document.getElementById('btn-submit-quiz');
    this.quizResults = document.getElementById('quiz-results');
    this.btnExportWorksheet = document.getElementById('btn-export-worksheet');

    // Document Hub
    this.dropZone = document.getElementById('drop-zone');
    this.fileInput = document.getElementById('file-input');
    this.btnLoadSample = document.getElementById('btn-load-sample');
    this.btnClearDocs = document.getElementById('btn-clear-docs');
    this.docsTableContainer = document.getElementById('documents-table-container');
    this.docCountBadge = document.getElementById('doc-count-badge');

    // Flashcards & Cheatsheet
    this.btnGenerateCards = document.getElementById('btn-generate-cards');
    this.flashcardsContainer = document.getElementById('flashcards-container');
    this.btnGenerateCheatsheet = document.getElementById('btn-generate-cheatsheet');
    this.cheatsheetOutput = document.getElementById('cheatsheet-output');
    this.cheatsheetContent = document.getElementById('cheatsheet-content');
    this.btnDownloadCheatsheet = document.getElementById('btn-download-cheatsheet');

    // Settings Modal
    this.btnOpenSettings = document.getElementById('btn-open-settings');
    this.settingsModal = document.getElementById('settings-modal');
    this.btnCloseSettings = document.getElementById('btn-close-settings');
    this.btnSaveSettings = document.getElementById('btn-save-settings');
    this.geminiKeyInput = document.getElementById('gemini-key-input');
    this.modelSelect = document.getElementById('model-select');
    this.statusDot = document.getElementById('status-dot');
    this.statusText = document.getElementById('status-text');
  }

  /* --- THEME SYSTEM --- */
  initTheme() {
    document.documentElement.setAttribute('data-theme', this.currentTheme);
    if (this.themeSelect) {
      this.themeSelect.value = this.currentTheme;
    }
  }

  setTheme(themeName) {
    this.currentTheme = themeName;
    document.documentElement.setAttribute('data-theme', themeName);
    localStorage.setItem('syllabus_theme', themeName);
  }

  /* --- SESSIONS & MULTI-CHAT MANAGER --- */
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
        <span class="session-title">${this.escapeHtml(sess.title)}</span>
        <button class="session-delete-btn" title="Delete conversation">&times;</button>
      `;
      item.addEventListener('click', () => this.switchSession(sess.id));
      const delBtn = item.querySelector('.session-delete-btn');
      delBtn.addEventListener('click', (e) => this.deleteSession(sess.id, e));
      this.sessionsListEl.appendChild(item);
    });
  }

  /* --- EVENT LISTENERS --- */
  initEventListeners() {
    // Theme Selector Change
    this.themeSelect?.addEventListener('change', (e) => this.setTheme(e.target.value));

    // Mode Toggle
    this.modeAgentBtn?.addEventListener('click', () => this.setMode('agent'));
    this.modeStrictBtn?.addEventListener('click', () => this.setMode('strict'));

    // Persona Selector
    this.personaSelect?.addEventListener('change', (e) => {
      this.currentPersona = e.target.value;
    });

    // Sidebar Toggle
    this.btnToggleSidebar?.addEventListener('click', () => {
      this.sidebar.classList.toggle('collapsed');
    });

    // New Chat Button
    this.btnNewChat?.addEventListener('click', () => this.createNewChat());

    // Navigation Tabs
    this.tabButtons.forEach(btn => {
      btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
    });

    // Chat Send & Enter Key
    this.btnSendChat?.addEventListener('click', () => this.handleSendMessage());
    this.chatInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.handleSendMessage();
      }
    });

    // Autosize Chat Input Textarea
    this.chatInput?.addEventListener('input', () => {
      this.chatInput.style.height = 'auto';
      this.chatInput.style.height = Math.min(this.chatInput.scrollHeight, 140) + 'px';
    });

    // Clear Chat
    this.btnClearChat?.addEventListener('click', () => {
      const activeSess = this.getActiveSession();
      if (activeSess) {
        activeSess.messages = [];
        this.saveSessions();
        this.renderActiveSessionMessages();
      }
    });

    // Prompt Chips in Welcome Hero
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('prompt-chip')) {
        const query = e.target.dataset.query;
        if (query && this.chatInput) {
          this.chatInput.value = query;
          this.handleSendMessage();
        }
      }
    });

    // Exam Arena
    this.btnGenerateQuiz?.addEventListener('click', () => this.generateQuiz());
    this.btnSubmitQuiz?.addEventListener('click', () => this.submitQuiz());
    this.btnExportWorksheet?.addEventListener('click', () => this.exportWorksheet());

    // Document Hub
    this.dropZone?.addEventListener('click', () => this.fileInput?.click());
    this.fileInput?.addEventListener('change', (e) => this.uploadFiles(e.target.files));
    this.btnLoadSample?.addEventListener('click', () => this.loadSampleMaterial());
    this.btnClearDocs?.addEventListener('click', () => this.clearAllDocs());

    // Drag & Drop
    ['dragenter', 'dragover'].forEach(name => {
      this.dropZone?.addEventListener(name, (e) => {
        e.preventDefault();
        this.dropZone.classList.add('drag-over');
      });
    });
    ['dragleave', 'drop'].forEach(name => {
      this.dropZone?.addEventListener(name, (e) => {
        e.preventDefault();
        this.dropZone.classList.remove('drag-over');
      });
    });
    this.dropZone?.addEventListener('drop', (e) => {
      if (e.dataTransfer?.files?.length) {
        this.uploadFiles(e.dataTransfer.files);
      }
    });

    // Flashcards
    this.btnGenerateCards?.addEventListener('click', () => this.generateFlashcards());
    this.btnGenerateCheatsheet?.addEventListener('click', () => this.generateCheatsheet());
    this.btnDownloadCheatsheet?.addEventListener('click', () => this.downloadCheatsheet());

    // Settings Modal
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

  /* --- VOICE INPUT (SPEECH TO TEXT) --- */
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

  /* --- CHAT STREAMING & MESSAGES --- */
  renderActiveSessionMessages() {
    const activeSess = this.getActiveSession();
    if (!activeSess || activeSess.messages.length === 0) {
      this.chatMessages.innerHTML = `
        <div class="welcome-hero-card">
          <div class="hero-sparkle-badge">🤖 ChatGPT-Style Intelligence + Syllabus Grounding</div>
          <h2 class="hero-title">Welcome to <span class="gradient-text">SyllabusAI</span></h2>
          <p class="hero-subtitle">
            Ask general questions freely, write code, derive mathematical formulas, or explore your uploaded course materials with exact textbook citations.
          </p>
          <div class="hero-prompts">
            <button class="prompt-chip" data-query="How are you doing today?">👋 Say Hello</button>
            <button class="prompt-chip" data-query="Write python code to reverse a singly linked list and analyze its complexity.">💻 Linked List in Python</button>
            <button class="prompt-chip" data-query="What is the Effective Memory Access Time (EMAT) formula from my notes?">📚 EMAT Formula</button>
            <button class="prompt-chip" data-query="What are the 4 Coffman conditions for deadlocks?">🔒 Deadlock Conditions</button>
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

  async handleSendMessage() {
    const text = this.chatInput.value.trim();
    if (!text || this.isStreaming) return;

    this.chatInput.value = '';
    this.chatInput.style.height = 'auto';

    const activeSess = this.getActiveSession();
    if (!activeSess) return;

    // Update Session Title if first message
    if (activeSess.messages.length === 0) {
      activeSess.title = text.length > 28 ? text.substring(0, 28) + '...' : text;
      this.saveSessions();
      this.renderSessionsList();
    }

    // Add User Message
    activeSess.messages.push({ role: 'user', content: text, citations: [] });
    this.saveSessions();
    this.appendMessageElement('user', text, [], false);
    this.scrollToBottom();

    // Prepare Agent Placeholder Message
    const agentMsgEl = this.appendMessageElement('agent', '', [], true);
    const contentEl = agentMsgEl.querySelector('.message-body');
    const citationsContainer = agentMsgEl.querySelector('.citations-box');
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

      // Complete Streaming
      contentEl.innerHTML = this.renderMarkdown(fullAgentText);
      if (collectedCitations.length > 0) {
        citationsContainer.style.display = 'block';
        citationsContainer.innerHTML = `
          <div class="citations-title">📌 Verified Syllabus Citations:</div>
          ${collectedCitations.map(c => `
            <span class="citation-badge" title="${this.escapeHtml(c.snippet)}">
              📄 ${this.escapeHtml(c.source)} (Page ${c.page})
            </span>
          `).join('')}
        `;
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
    // Remove welcome card if present
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
              <span class="citation-badge" title="${this.escapeHtml(c.snippet)}">
                📄 ${this.escapeHtml(c.source)} (Page ${c.page})
              </span>
            `).join('')}
          ` : ''}
        </div>
      </div>
    `;

    this.chatMessages.appendChild(bubble);
    return bubble;
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

    // Code blocks with syntax badge
    parsed = parsed.replace(/```([a-zA-Z]*)\n([\s\S]*?)```/g, (match, lang, code) => {
      return `<pre><code class="language-${lang}">${code.trim()}</code></pre>`;
    });

    // Inline code
    parsed = parsed.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // Headers
    parsed = parsed.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    parsed = parsed.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    parsed = parsed.replace(/^# (.*$)/gim, '<h1>$1</h1>');
    
    // Bold & Italics
    parsed = parsed.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    parsed = parsed.replace(/\*(.*?)\*/g, '<em>$1</em>');

    // Bullet points
    parsed = parsed.replace(/^\s*-\s+(.*$)/gim, '<li>$1</li>');
    parsed = parsed.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');

    // Line breaks
    parsed = parsed.replace(/\n\n/g, '<br><br>');

    return parsed;
  }

  renderMath() {
    if (window.renderMathInElement) {
      window.renderMathInElement(this.chatMessages, {
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

  /* --- EXAM ARENA & WORKSHEET EXPORTER --- */
  async generateQuiz() {
    const topic = document.getElementById('quiz-topic')?.value || 'General Operating Systems';
    const num = parseInt(document.getElementById('quiz-count')?.value || '5');
    const diff = document.getElementById('quiz-difficulty')?.value || 'Medium';
    const qType = document.getElementById('quiz-type')?.value || 'MCQ';

    this.quizContainer.innerHTML = '<div class="empty-state"><div class="empty-icon">⏳</div><h3>Generating Assessment Questions...</h3></div>';
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
    } catch (e) {
      this.quizContainer.innerHTML = '<div class="empty-state"><p style="color:#ef4444;">Failed to generate quiz.</p></div>';
    }
  }

  renderQuiz(questions, qType) {
    if (!questions || questions.length === 0) {
      this.quizContainer.innerHTML = '<div class="empty-state"><p>No questions generated.</p></div>';
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
            <textarea class="styled-input" rows="3" placeholder="Write your derivation or answer here..." style="width:100%;"></textarea>
          </div>
        `;
      }

      card.innerHTML = `
        <div class="question-text"><strong>Q${idx + 1}:</strong> ${this.escapeHtml(q.question)}</div>
        ${optionsHtml}
      `;
      this.quizContainer.appendChild(card);
    });

    // Add option select listeners for MCQs
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
      
      // Trigger download
      const blob = new Blob([data.markdown], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = data.filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('Failed to export worksheet.');
    }
  }

  /* --- FLASHCARDS & REVISION --- */
  async generateFlashcards() {
    const topic = document.getElementById('flashcard-topic')?.value || 'Core Concepts';
    this.flashcardsContainer.innerHTML = '<div class="empty-state"><div class="empty-icon">⏳</div><h3>Building 3D Flashcard Deck...</h3></div>';

    try {
      const res = await fetch('/api/flashcards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, num_cards: 6 })
      });
      const data = await res.json();
      this.renderFlashcards(data.flashcards);
    } catch {
      this.flashcardsContainer.innerHTML = '<div class="empty-state"><p>Failed to generate cards.</p></div>';
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

      // Populate filter dropdowns
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
      this.docsTableContainer.innerHTML = '<div class="empty-state"><p>No documents uploaded yet.</p></div>';
      return;
    }

    let html = '<div class="doc-items-list">';
    docs.forEach(d => {
      html += `
        <div class="doc-row" style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid var(--border-color);">
          <div>
            <strong>📄 ${this.escapeHtml(d.source)}</strong>
            <div style="font-size:12px; color:var(--text-muted);">${d.total_pages} Pages | ${d.chunk_count} Chunks</div>
          </div>
          <button class="danger-btn text-btn" onclick="app.deleteDoc('${d.source}')">Delete</button>
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

// Instantiate on load
let app;
window.addEventListener('DOMContentLoaded', () => {
  app = new SyllabusApp();
});
