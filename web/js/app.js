/**
 * SyllabusRAG & ChatGPT AI Agent — Frontend Logic
 * Full Autonomous AI Agent, Multi-Persona, KaTeX Math & Exam Suite
 */

document.addEventListener('DOMContentLoaded', () => {
  // ---------------------------------------------------------
  // Application State
  // ---------------------------------------------------------
  const state = {
    mode: 'agent', // 'agent' (ChatGPT-Style) or 'strict' (Syllabus-Only)
    persona: 'general', // 'general', 'professor', 'socratic', 'coding_mentor'
    documents: [],
    totalChunks: 0,
    activeQuiz: null,
    chatHistory: [],
    flashcards: [],
    currentFlashcardIndex: 0,
    isCardFlipped: false,
    cheatSheetMarkdown: ''
  };

  // ---------------------------------------------------------
  // DOM Elements
  // ---------------------------------------------------------
  const elements = {
    // Mode & Persona
    modeAgentBtn: document.getElementById('mode-agent-btn'),
    modeStrictBtn: document.getElementById('mode-strict-btn'),
    personaSelect: document.getElementById('persona-select'),
    activeModeTag: document.getElementById('active-mode-tag'),
    activePersonaTag: document.getElementById('active-persona-tag'),

    // Status & Navbar
    statusPill: document.getElementById('status-pill'),
    statusText: document.getElementById('status-text'),
    statDocsCount: document.getElementById('stat-docs-count'),
    statChunksCount: document.getElementById('stat-chunks-count'),
    docFilterSelect: document.getElementById('doc-filter-select'),
    btnLoadSample: document.getElementById('btn-load-sample'),
    btnOpenSettings: document.getElementById('btn-open-settings'),
    
    // Tabs
    tabBtns: document.querySelectorAll('.tab-btn'),
    tabViews: document.querySelectorAll('.tab-view'),

    // Chat / Tutor
    chatViewport: document.getElementById('chat-viewport'),
    chatForm: document.getElementById('chat-form'),
    chatInput: document.getElementById('chat-input'),
    promptChips: document.querySelectorAll('.chip-btn'),

    // Quiz
    quizForm: document.getElementById('quiz-config-form'),
    quizTopicInput: document.getElementById('quiz-topic-input'),
    quizCountSelect: document.getElementById('quiz-count-select'),
    quizDiffSelect: document.getElementById('quiz-diff-select'),
    quizTypeSelect: document.getElementById('quiz-type-select'),
    activeQuizArea: document.getElementById('active-quiz-area'),
    quizResultsArea: document.getElementById('quiz-results-area'),

    // Documents Hub
    dropzone: document.getElementById('dropzone'),
    fileInput: document.getElementById('file-input'),
    docTableBody: document.getElementById('doc-table-body'),
    btnClearIndex: document.getElementById('btn-clear-index'),
    uploadProgressBar: document.getElementById('upload-progress-bar'),
    progressFill: document.getElementById('progress-fill'),

    // Flashcards & Revision
    fcTopicInput: document.getElementById('fc-topic-input'),
    btnGenerateFc: document.getElementById('btn-generate-fc'),
    flashcardElement: document.getElementById('flashcard-element'),
    fcBadge: document.getElementById('fc-badge'),
    fcQuestion: document.getElementById('fc-question'),
    fcAnswer: document.getElementById('fc-answer'),
    fcCounter: document.getElementById('fc-counter'),
    btnPrevFc: document.getElementById('btn-prev-fc'),
    btnNextFc: document.getElementById('btn-next-fc'),

    // Cheat-sheet
    btnGenerateCheatsheet: document.getElementById('btn-generate-cheatsheet'),
    cheatsheetContent: document.getElementById('cheatsheet-content'),
    cheatsheetActions: document.getElementById('cheatsheet-actions'),
    btnDownloadCheatsheet: document.getElementById('btn-download-cheatsheet'),

    // Settings Modal
    settingsModal: document.getElementById('settings-modal'),
    btnCloseModal: document.getElementById('btn-close-modal'),
    modalApiKey: document.getElementById('modal-api-key'),
    modalModelSelect: document.getElementById('modal-model-select'),
    btnSaveSettings: document.getElementById('btn-save-settings'),

    // Toasts
    toastContainer: document.getElementById('toast-container')
  };

  // ---------------------------------------------------------
  // Helper Utilities
  // ---------------------------------------------------------
  function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    elements.toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  function renderMath(container) {
    if (window.renderMathInElement && container) {
      window.renderMathInElement(container, {
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

  // ---------------------------------------------------------
  // API Calls & Data Sync
  // ---------------------------------------------------------
  async function fetchStatus() {
    try {
      const res = await fetch('/api/status');
      if (!res.ok) throw new Error('Status fetch failed');
      const data = await res.json();

      state.documents = data.documents || [];
      state.totalChunks = data.total_chunks || 0;

      elements.statDocsCount.textContent = state.documents.length;
      elements.statChunksCount.textContent = state.totalChunks;
      elements.statusText.textContent = `${state.documents.length} Docs (${state.totalChunks} Chunks)`;

      updateFilterDropdown();
      renderDocumentTable();

    } catch (err) {
      elements.statusText.textContent = 'Server Offline';
      console.error(err);
    }
  }

  function updateFilterDropdown() {
    const currentVal = elements.docFilterSelect.value;
    elements.docFilterSelect.innerHTML = '<option value="All Documents">📚 All Documents</option>';
    
    state.documents.forEach(doc => {
      const opt = document.createElement('option');
      opt.value = doc.source;
      opt.textContent = `📄 ${doc.source}`;
      elements.docFilterSelect.appendChild(opt);
    });

    if (state.documents.some(d => d.source === currentVal)) {
      elements.docFilterSelect.value = currentVal;
    }
  }

  function renderDocumentTable() {
    if (state.documents.length === 0) {
      elements.docTableBody.innerHTML = `
        <tr>
          <td colspan="5" class="text-center text-muted" style="padding: 2rem;">
            No documents loaded yet. Drag and drop files above or click 'Load Sample Syllabus'.
          </td>
        </tr>`;
      return;
    }

    elements.docTableBody.innerHTML = state.documents.map(doc => `
      <tr>
        <td><strong>📄 ${doc.source}</strong></td>
        <td><span class="badge badge-grounded">${doc.doc_type}</span></td>
        <td>${doc.total_pages} Pages</td>
        <td>${doc.chunk_count} Chunks</td>
        <td>
          <button class="btn btn-danger btn-sm btn-delete-doc" data-doc="${doc.source}">
            🗑️ Delete
          </button>
        </td>
      </tr>
    `).join('');

    document.querySelectorAll('.btn-delete-doc').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const docName = e.currentTarget.getAttribute('data-doc');
        if (confirm(`Remove '${docName}' from the syllabus index?`)) {
          await deleteDocument(docName);
        }
      });
    });
  }

  async function deleteDocument(docName) {
    try {
      const res = await fetch(`/api/documents/${encodeURIComponent(docName)}`, { method: 'DELETE' });
      if (res.ok) {
        showToast(`Deleted ${docName}`);
        await fetchStatus();
      }
    } catch (err) {
      showToast('Error deleting document');
    }
  }

  async function loadSampleMaterial() {
    elements.btnLoadSample.disabled = true;
    elements.btnLoadSample.textContent = 'Loading...';
    try {
      const res = await fetch('/api/sample/load', { method: 'POST' });
      const data = await res.json();
      showToast(data.message || 'Sample Syllabus Loaded!');
      await fetchStatus();
    } catch (err) {
      showToast('Failed to load sample data');
    } finally {
      elements.btnLoadSample.disabled = false;
      elements.btnLoadSample.textContent = '📥 Load Sample Syllabus';
    }
  }

  async function clearAllData() {
    if (!confirm('Are you sure you want to clear all documents and indices?')) return;
    try {
      await fetch('/api/clear', { method: 'POST' });
      showToast('Vector store and history cleared');
      await fetchStatus();
    } catch (err) {
      showToast('Error clearing data');
    }
  }

  // ---------------------------------------------------------
  // File Upload Handler
  // ---------------------------------------------------------
  async function handleFileUpload(files) {
    if (!files || files.length === 0) return;

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }

    elements.uploadProgressBar.style.display = 'block';
    elements.progressFill.style.width = '60%';

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });

      elements.progressFill.style.width = '100%';
      const data = await res.json();
      showToast(data.message || 'Files uploaded and indexed!');
      await fetchStatus();
    } catch (err) {
      showToast('File upload failed');
    } finally {
      setTimeout(() => {
        elements.uploadProgressBar.style.display = 'none';
        elements.progressFill.style.width = '0%';
      }, 1000);
    }
  }

  // ---------------------------------------------------------
  // TAB 1: ChatGPT AI Agent Chat
  // ---------------------------------------------------------
  async function submitChatMessage(query) {
    if (!query || !query.trim()) return;
    const cleanQuery = query.trim();

    // 1. Append User Message
    appendMessage('user', cleanQuery);
    state.chatHistory.push({ role: 'user', content: cleanQuery });
    elements.chatInput.value = '';

    // 2. Append Assistant Loading Bubble
    const assistantBubble = appendLoadingMessage();

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: cleanQuery,
          mode: state.mode,
          persona: state.persona,
          filter_source: elements.docFilterSelect.value,
          chat_history: state.chatHistory.slice(-6)
        })
      });

      const data = await res.json();
      assistantBubble.remove();

      appendAssistantAnswer(data.answer, data.citations, data.is_grounded);
      state.chatHistory.push({ role: 'assistant', content: data.answer });

    } catch (err) {
      assistantBubble.remove();
      appendAssistantAnswer("⚠️ An error occurred while communicating with the AI agent service.", [], false);
    }
  }

  function appendMessage(role, text) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `chat-message ${role}-msg`;
    msgDiv.innerHTML = `
      <div class="msg-avatar">${role === 'user' ? '👤' : '🤖'}</div>
      <div class="msg-body">
        <div class="msg-text">${escapeHtml(text)}</div>
      </div>
    `;
    elements.chatViewport.appendChild(msgDiv);
    elements.chatViewport.scrollTop = elements.chatViewport.scrollHeight;
    return msgDiv;
  }

  function appendLoadingMessage() {
    const msgDiv = document.createElement('div');
    msgDiv.className = 'chat-message assistant-msg';
    msgDiv.innerHTML = `
      <div class="msg-avatar">🤖</div>
      <div class="msg-body">
        <div class="msg-text"><em>AI Agent is thinking and synthesizing response...</em></div>
      </div>
    `;
    elements.chatViewport.appendChild(msgDiv);
    elements.chatViewport.scrollTop = elements.chatViewport.scrollHeight;
    return msgDiv;
  }

  function appendAssistantAnswer(markdownText, citations = [], isGrounded = true) {
    const msgDiv = document.createElement('div');
    msgDiv.className = 'chat-message assistant-msg';

    const htmlContent = window.marked ? window.marked.parse(markdownText) : markdownText;

    let citationsHtml = '';
    if (citations && citations.length > 0) {
      const cardsHtml = citations.map(c => `
        <div class="citation-card">
          <div class="citation-card-header">
            <span>📄 ${escapeHtml(c.source)} — Page ${c.page}</span>
            <span>Relevance: ${Math.round((c.similarity || 0) * 100)}%</span>
          </div>
          <div class="citation-card-snippet">"${escapeHtml(c.snippet || '')}"</div>
        </div>
      `).join('');

      citationsHtml = `
        <div class="citations-wrapper">
          <details open>
            <summary class="citations-toggle">📖 Verified Course References (${citations.length})</summary>
            <div class="citations-list">${cardsHtml}</div>
          </details>
        </div>
      `;
    }

    const badgeLabel = citations.length > 0 ? 'Course Grounded' : (state.mode === 'agent' ? 'ChatGPT Agent' : 'Out of Syllabus');
    const badgeClass = isGrounded ? 'badge-grounded' : 'badge-danger';

    msgDiv.innerHTML = `
      <div class="msg-avatar">🤖</div>
      <div class="msg-body">
        <div class="msg-header">
          <strong>AI Agent (${elements.personaSelect.options[elements.personaSelect.selectedIndex].text})</strong>
          <span class="badge ${badgeClass}">${badgeLabel}</span>
        </div>
        <div class="msg-text">${htmlContent}</div>
        ${citationsHtml}
      </div>
    `;

    elements.chatViewport.appendChild(msgDiv);
    renderMath(msgDiv);
    elements.chatViewport.scrollTop = elements.chatViewport.scrollHeight;
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ---------------------------------------------------------
  // TAB 2: Exam & Quiz Arena
  // ---------------------------------------------------------
  async function generateExam() {
    const topic = elements.quizTopicInput.value.trim() || 'General Syllabus';
    const numQuestions = parseInt(elements.quizCountSelect.value, 10);
    const difficulty = elements.quizDiffSelect.value;
    const quizType = elements.quizTypeSelect.value;

    elements.activeQuizArea.style.display = 'block';
    elements.activeQuizArea.innerHTML = `
      <div class="panel-card text-center" style="padding: 3rem;">
        <p>Analyzing course materials and generating ${numQuestions} ${quizType} exam questions for <strong>${topic}</strong>...</p>
      </div>`;
    elements.quizResultsArea.style.display = 'none';

    try {
      const res = await fetch('/api/quiz/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: topic,
          num_questions: numQuestions,
          difficulty: difficulty,
          quiz_type: quizType,
          filter_source: elements.docFilterSelect.value
        })
      });

      const data = await res.json();
      state.activeQuiz = data;
      renderActiveQuiz(data);
    } catch (err) {
      elements.activeQuizArea.innerHTML = `
        <div class="panel-card text-center text-muted">
          <p>Failed to generate exam questions. Please ensure documents are uploaded.</p>
        </div>`;
    }
  }

  function renderActiveQuiz(quizData) {
    const questions = quizData.quiz || [];
    if (questions.length === 0) {
      elements.activeQuizArea.innerHTML = `
        <div class="panel-card text-center text-muted">
          <p>No questions could be generated for this topic. Upload materials in the Document Hub.</p>
        </div>`;
      return;
    }

    if (quizData.type === 'DESCRIPTIVE') {
      elements.activeQuizArea.innerHTML = `
        <div class="panel-card">
          <div class="panel-header">
            <h2>📖 Descriptive Conceptual Problems (${questions.length} Questions)</h2>
          </div>
          ${questions.map((q, idx) => `
            <div class="quiz-question-card">
              <div class="qq-number">Problem ${q.id || idx + 1} [${q.max_marks || 5} Marks]</div>
              <div class="qq-title">${escapeHtml(q.question)}</div>
              <details style="margin-top: 1rem;">
                <summary style="color: var(--color-primary); cursor: pointer; font-weight: 600;">
                  👁️ Reveal Model Answer & Grading Rubric
                </summary>
                <div style="background: var(--color-bg); padding: 1rem; border-radius: 6px; margin-top: 0.5rem;">
                  <p><strong>Model Answer:</strong></p>
                  <p>${escapeHtml(q.model_answer || '')}</p>
                  <p style="margin-top: 0.5rem;"><strong>Required Key Points:</strong></p>
                  <ul>${(q.key_points || []).map(p => `<li>${escapeHtml(p)}</li>`).join('')}</ul>
                  <p style="margin-top: 0.5rem; font-size: 0.8rem; color: var(--color-text-muted);">
                    <em>Citation: [Doc: ${q.source_doc}, Page: ${q.source_page}]</em>
                  </p>
                </div>
              </details>
            </div>
          `).join('')}
        </div>
      `;
      renderMath(elements.activeQuizArea);
      return;
    }

    // MCQ Format
    elements.activeQuizArea.innerHTML = `
      <div class="panel-card">
        <div class="panel-header">
          <h2>✍️ Active Exam Arena (${questions.length} MCQs)</h2>
          <p>Select your answer for each question and submit for instant auto-grading and rationale review.</p>
        </div>
        <form id="exam-submission-form">
          ${questions.map((q, idx) => `
            <div class="quiz-question-card">
              <div class="qq-number">Question ${q.id || idx + 1}</div>
              <div class="qq-title">${escapeHtml(q.question)}</div>
              <div class="qq-options-list">
                ${(q.options || []).map(opt => `
                  <label class="option-label">
                    <input type="radio" name="q_${q.id || idx + 1}" value="${escapeHtml(opt)}" required>
                    <span>${escapeHtml(opt)}</span>
                  </label>
                `).join('')}
              </div>
            </div>
          `).join('')}
          <button type="submit" class="btn btn-primary btn-block" style="padding: 0.85rem; font-size: 1rem; margin-top: 1rem;">
            📊 Submit Exam for Instant Auto-Grading
          </button>
        </form>
      </div>
    `;

    renderMath(elements.activeQuizArea);

    const examForm = document.getElementById('exam-submission-form');
    if (examForm) {
      examForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(examForm);
        const userAnswers = {};
        questions.forEach(q => {
          const key = `q_${q.id}`;
          userAnswers[q.id] = formData.get(key) || '';
        });
        await submitExamForGrading(questions, userAnswers);
      });
    }
  }

  async function submitExamForGrading(questions, userAnswers) {
    try {
      const res = await fetch('/api/quiz/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quiz: questions, user_answers: userAnswers })
      });

      const result = await res.json();
      renderScorecard(result);
    } catch (err) {
      showToast('Error grading exam');
    }
  }

  function renderScorecard(result) {
    elements.quizResultsArea.style.display = 'block';
    elements.quizResultsArea.innerHTML = `
      <div class="panel-card">
        <div class="panel-header">
          <h2>🏆 Exam Performance & Scorecard</h2>
        </div>
        <div class="scorecard-banner">
          <div>
            <div class="sc-metric-val">${result.score_percentage}%</div>
            <div class="sc-metric-lbl">Score Percentage</div>
          </div>
          <div>
            <div class="sc-metric-val">${result.correct_count} / ${result.total_questions}</div>
            <div class="sc-metric-lbl">Correct Answers</div>
          </div>
          <div>
            <div class="sc-metric-val">Grade ${result.grade}</div>
            <div class="sc-metric-lbl">Assessment Level</div>
          </div>
        </div>

        <h3 style="margin-bottom: 1rem; font-size: 1.1rem;">🔍 Detailed Answer Rationales & Source References</h3>
        <div class="review-list">
          ${(result.feedback || []).map(fb => `
            <div class="review-item ${fb.is_correct ? 'review-correct' : 'review-incorrect'}">
              <div class="review-header">
                <span>${fb.is_correct ? '✅' : '❌'} Q${fb.id}: ${escapeHtml(fb.question)}</span>
                <span>${fb.is_correct ? 'Correct (+1)' : 'Incorrect (0)'}</span>
              </div>
              <div class="review-body">
                <p><strong>Your Selected Answer:</strong> ${escapeHtml(fb.user_answer)}</p>
                <p><strong>Correct Option:</strong> Option ${escapeHtml(fb.correct_answer)}</p>
                <p style="margin-top: 0.5rem;"><strong>Step-by-Step Rationale:</strong> ${escapeHtml(fb.explanation)}</p>
                <div class="citation-card" style="margin-top: 0.75rem;">
                  <strong>Verified Textbook Reference:</strong> ${escapeHtml(fb.source_doc)} — Page ${fb.source_page}
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    renderMath(elements.quizResultsArea);
    elements.quizResultsArea.scrollIntoView({ behavior: 'smooth' });
  }

  // ---------------------------------------------------------
  // TAB 4: Revision & Flashcards
  // ---------------------------------------------------------
  async function generateFlashcardsDeck() {
    const topic = elements.fcTopicInput.value.trim() || 'Key Concepts';
    elements.fcQuestion.textContent = `Extracting key definitions & formulas for ${topic}...`;
    elements.fcAnswer.textContent = '';
    elements.flashcardElement.classList.remove('is-flipped');

    try {
      const res = await fetch('/api/flashcards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: topic,
          num_cards: 6,
          filter_source: elements.docFilterSelect.value
        })
      });

      const data = await res.json();
      state.flashcards = data.flashcards || [];
      state.currentFlashcardIndex = 0;
      updateFlashcardUI();
    } catch (err) {
      showToast('Error generating flashcards');
    }
  }

  function updateFlashcardUI() {
    const cards = state.flashcards;
    const idx = state.currentFlashcardIndex;

    if (!cards || cards.length === 0) {
      elements.fcBadge.textContent = 'Concept #0';
      elements.fcQuestion.textContent = 'No flashcards available. Click Generate Deck!';
      elements.fcAnswer.textContent = '';
      elements.fcCounter.textContent = 'Card 0 of 0';
      elements.btnPrevFc.disabled = true;
      elements.btnNextFc.disabled = true;
      return;
    }

    const currentCard = cards[idx];
    elements.flashcardElement.classList.remove('is-flipped');
    state.isCardFlipped = false;

    elements.fcBadge.textContent = `📌 ${currentCard.topic || 'Concept'} — #${idx + 1}`;
    elements.fcQuestion.textContent = currentCard.front || '';
    elements.fcAnswer.innerHTML = `
      <strong>💡 Key Principle / Formula:</strong><br/>
      ${escapeHtml(currentCard.back || '')}<br/><br/>
      <em>Source: ${escapeHtml(currentCard.source_doc || 'Syllabus')} (Page ${currentCard.source_page || 1})</em>
    `;
    elements.fcCounter.textContent = `Card ${idx + 1} of ${cards.length}`;

    elements.btnPrevFc.disabled = (idx === 0);
    elements.btnNextFc.disabled = (idx === cards.length - 1);

    renderMath(elements.flashcardElement);
  }

  async function generateCheatSheet() {
    elements.cheatsheetContent.innerHTML = '<p class="text-muted">Compiling comprehensive syllabus notes and equations...</p>';
    elements.cheatsheetActions.style.display = 'none';

    try {
      const res = await fetch('/api/cheatsheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filter_source: elements.docFilterSelect.value })
      });

      const data = await res.json();
      state.cheatSheetMarkdown = data.cheatsheet || '';

      const html = window.marked ? window.marked.parse(state.cheatSheetMarkdown) : state.cheatSheetMarkdown;
      elements.cheatsheetContent.innerHTML = html;
      elements.cheatsheetActions.style.display = 'block';
      renderMath(elements.cheatsheetContent);
    } catch (err) {
      elements.cheatsheetContent.innerHTML = '<p class="text-danger">Failed to generate revision cheat-sheet.</p>';
    }
  }

  function downloadCheatSheet() {
    if (!state.cheatSheetMarkdown) return;
    const blob = new Blob([state.cheatSheetMarkdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'syllabus_revision_notes.md';
    a.click();
    URL.revokeObjectURL(url);
  }

  // ---------------------------------------------------------
  // Event Listeners
  // ---------------------------------------------------------
  function setupEventListeners() {
    // Mode Switching
    elements.modeAgentBtn.addEventListener('click', () => {
      state.mode = 'agent';
      elements.modeAgentBtn.classList.add('active');
      elements.modeStrictBtn.classList.remove('active');
      elements.activeModeTag.textContent = '🤖 Mode: ChatGPT AI Agent';
      showToast('Switched to ChatGPT AI Agent Mode (Answers any question)');
    });

    elements.modeStrictBtn.addEventListener('click', () => {
      state.mode = 'strict';
      elements.modeStrictBtn.classList.add('active');
      elements.modeAgentBtn.classList.remove('active');
      elements.activeModeTag.textContent = '🎓 Mode: Strict Syllabus-Only';
      showToast('Switched to Strict Syllabus Mode (Locked to course materials)');
    });

    // Persona Selector
    elements.personaSelect.addEventListener('change', (e) => {
      state.persona = e.target.value;
      const personaText = elements.personaSelect.options[elements.personaSelect.selectedIndex].text;
      elements.activePersonaTag.textContent = `Persona: ${personaText.split(' ')[1] || personaText}`;
      showToast(`AI Persona updated to: ${personaText}`);
    });

    // Tab Switching
    elements.tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const tabId = btn.getAttribute('data-tab');
        elements.tabBtns.forEach(b => {
          b.classList.remove('active');
          b.setAttribute('aria-selected', 'false');
        });
        elements.tabViews.forEach(v => v.classList.remove('active'));

        btn.classList.add('active');
        btn.setAttribute('aria-selected', 'true');
        const activeView = document.getElementById(`view-${tabId}`);
        if (activeView) activeView.classList.add('active');
      });
    });

    // Quick Prompts
    elements.promptChips.forEach(chip => {
      chip.addEventListener('click', () => {
        const promptText = chip.getAttribute('data-prompt');
        submitChatMessage(promptText);
      });
    });

    // Chat Form Submit
    elements.chatForm.addEventListener('submit', (e) => {
      e.preventDefault();
      submitChatMessage(elements.chatInput.value);
    });

    // Chat Input Enter Key
    elements.chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        elements.chatForm.dispatchEvent(new Event('submit'));
      }
    });

    // Load Sample Syllabus
    elements.btnLoadSample.addEventListener('click', loadSampleMaterial);

    // Clear Vector Store
    elements.btnClearIndex.addEventListener('click', clearAllData);

    // Dropzone & File Input
    elements.dropzone.addEventListener('click', () => elements.fileInput.click());
    elements.fileInput.addEventListener('change', (e) => handleFileUpload(e.target.files));

    elements.dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      elements.dropzone.classList.add('dragover');
    });

    elements.dropzone.addEventListener('dragleave', () => elements.dropzone.classList.remove('dragover'));
    elements.dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      elements.dropzone.classList.remove('dragover');
      handleFileUpload(e.dataTransfer.files);
    });

    // Quiz Generator Submit
    elements.quizForm.addEventListener('submit', (e) => {
      e.preventDefault();
      generateExam();
    });

    // Flashcard Flip & Navigation
    elements.flashcardElement.addEventListener('click', () => {
      elements.flashcardElement.classList.toggle('is-flipped');
      state.isCardFlipped = !state.isCardFlipped;
    });

    elements.btnGenerateFc.addEventListener('click', generateFlashcardsDeck);

    elements.btnPrevFc.addEventListener('click', () => {
      if (state.currentFlashcardIndex > 0) {
        state.currentFlashcardIndex--;
        updateFlashcardUI();
      }
    });

    elements.btnNextFc.addEventListener('click', () => {
      if (state.currentFlashcardIndex < state.flashcards.length - 1) {
        state.currentFlashcardIndex++;
        updateFlashcardUI();
      }
    });

    // Cheat Sheet
    elements.btnGenerateCheatsheet.addEventListener('click', generateCheatSheet);
    elements.btnDownloadCheatsheet.addEventListener('click', downloadCheatSheet);

    // Settings Modal
    elements.btnOpenSettings.addEventListener('click', () => elements.settingsModal.style.display = 'flex');
    elements.btnCloseModal.addEventListener('click', () => elements.settingsModal.style.display = 'none');
    elements.settingsModal.addEventListener('click', (e) => {
      if (e.target === elements.settingsModal) elements.settingsModal.style.display = 'none';
    });

    elements.btnSaveSettings.addEventListener('click', async () => {
      const apiKey = elements.modalApiKey.value.trim();
      const model = elements.modalModelSelect.value;
      try {
        await fetch('/api/config/key', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ api_key: apiKey, model_name: model })
        });
        showToast('Settings saved successfully!');
        elements.settingsModal.style.display = 'none';
        await fetchStatus();
      } catch (err) {
        showToast('Error saving settings');
      }
    });
  }

  // ---------------------------------------------------------
  // Initialization
  // ---------------------------------------------------------
  setupEventListeners();
  fetchStatus();
});
