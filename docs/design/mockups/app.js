// This file powers a visual design prototype, not the production application.
// It deliberately does not compile user code, execute tests or persist submissions.
(() => {
  const root = document.querySelector('#app');
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];

  if (!root) return;

  const codeEditor = $('#editableCode');
  const initialCode = codeEditor.textContent;
  let hintIndex = 0;
  let visualIndex = 0;
  let selectedAttempt = 2;
  const hints = [
    'Consider a contiguous range that grows one element at a time. When does that range become invalid?',
    'A frequency map can count how many times each identifier appears in your current window.',
    'Advance the right pointer, then move the left pointer until the number of distinct identifiers is at most k.',
  ];
  const attempts = {
    1: {
      title: 'My first approach',
      date: 'ATTEMPT #1 · OCTOBER 14, 2026',
      status: 'Untested (demo)',
      tested: false,
      code: [
        'for (let start = 0; start < events.length; start++) {',
        '  const distinct = new Set<string>()',
        '  for (let end = start; end < events.length; end++) {',
        '    distinct.add(events[end])',
        '    if (distinct.size > k) break',
        '    // Remember the best valid range',
        '  }',
        '}',
      ].join('\n'),
      why: 'I scanned possible starting indices and extended each candidate window until it became invalid. It was easy to reason about but repeated work.',
      learned:
        'A brute-force reference was useful to verify examples, but I wanted a solution that avoids revisiting the same elements.',
      complexity: ['Time O(n²)', 'Space O(k)'],
    },
    2: {
      title: 'My saved solution',
      date: 'ATTEMPT #2 · OCTOBER 16, 2026',
      status: 'Passed (demo)',
      tested: true,
      code: [
        'const counts = new Map<string, number>()',
        'let left = 0',
        '',
        'for (let right = 0; right < events.length; right++) {',
        '  counts.set(events[right], ...)',
        '  while (counts.size > k) {',
        '    // Shrink the invalid window',
        '    ...',
        '  }',
        '}',
      ].join('\n'),
      why: 'A frequency map tracks the distinct identifiers in the active window. Each pointer only moves forward, so the scan is linear.',
      learned:
        'Handle k = 0 explicitly. Ties need the earliest window, so update the best result only on strict improvement.',
      complexity: ['Time O(n)', 'Space O(k)'],
    },
  };

  function announce(message) {
    const toast = $('#toast');
    toast.textContent = message;
    toast.hidden = false;
    clearTimeout(announce.timer);
    announce.timer = setTimeout(() => {
      toast.hidden = true;
    }, 4400);
  }

  function navigate(screen) {
    if (!['explore', 'solve', 'notebook'].includes(screen)) return;
    root.dataset.screen = screen;
    $$('.screen').forEach((element) => {
      element.hidden = element.id !== 'screen-' + screen;
    });
    $$('.side-link[data-navigate]').forEach((button) => {
      const active = button.dataset.navigate === screen;
      button.classList.toggle('is-active', active);
      if (active) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
    window.scrollTo({ top: 0, behavior: 'instant' });
    // Do not replace focus when switching a mockup from a scripted user action.
  }

  function changeTheme() {
    const dark = root.dataset.theme !== 'dark';
    root.dataset.theme = dark ? 'dark' : 'light';
    $('#themeToggle').setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
  }

  function showProblemTab(tab) {
    if (root.dataset.mode === 'interview' && tab === 'visualizer') tab = 'description';
    ['description', 'examples', 'visualizer'].forEach((name) => {
      $('#problem-' + name).hidden = name !== tab;
    });
    $$('[data-problem-tab]').forEach((button) => {
      const selected = button.dataset.problemTab === tab;
      button.classList.toggle('is-selected', selected);
      button.setAttribute('aria-selected', selected ? 'true' : 'false');
    });
    if (tab === 'visualizer') drawVisualizer();
  }

  function setMode(mode) {
    if (!['learning', 'interview'].includes(mode)) return;
    root.dataset.mode = mode;
    $$('[data-mode-button]').forEach((button) => {
      button.classList.toggle('is-selected', button.dataset.modeButton === mode);
    });
    if (mode === 'interview') {
      showProblemTab('description');
      hintIndex = 0;
      $('#openHints').textContent = 'Show hint';
      announce('Interview Mode: hints, pattern labels and visualizations are hidden. Your draft remains intact.');
    } else {
      announce('Learning Mode: hints and algorithm visualizations are available.');
    }
  }

  function setMobilePane(pane) {
    root.dataset.mobilePane = pane;
    $$('[data-mobile-button]').forEach((button) => {
      const selected = button.dataset.mobileButton === pane;
      button.classList.toggle('is-active', selected);
      button.setAttribute('aria-selected', selected ? 'true' : 'false');
    });
  }

  function filterCatalog() {
    const query = $('#challengeSearch').value.trim().toLowerCase();
    const difficulty = $('#difficultyFilter').value;
    let visible = 0;
    $$('.challenge-row').forEach((row) => {
      const matches =
        row.dataset.title.toLowerCase().includes(query) &&
        (difficulty === 'all' || row.dataset.difficulty === difficulty);
      row.hidden = !matches;
      if (matches) visible++;
    });
    $('#challengeCount').textContent = String(visible).padStart(2, '0');
    $('#noChallenges').hidden = visible !== 0;
  }

  function parseEvents() {
    return $('#exampleEvents')
      .value.split(',')
      .map((event) => event.trim())
      .filter(Boolean);
  }

  // Simple deterministic reference demonstrator for the example inputs only.
  // It never reads, executes or validates the user's editable code.
  function computeExpected(events, k) {
    let bestStart = 0;
    let bestEnd = 0;
    if (k <= 0 || events.length === 0) return { start: bestStart, endExclusive: bestEnd };
    for (let start = 0; start < events.length; start++) {
      const distinct = new Set();
      for (let end = start; end < events.length; end++) {
        distinct.add(events[end]);
        if (distinct.size > k) break;
        if (end + 1 - start > bestEnd - bestStart) {
          bestStart = start;
          bestEnd = end + 1;
        }
      }
    }
    return { start: bestStart, endExclusive: bestEnd };
  }

  function updateExpected() {
    const events = parseEvents();
    const k = Number($('#exampleK').value);
    const safeK = Number.isFinite(k) ? Math.trunc(k) : 0;
    const result = computeExpected(events, safeK);
    $('#expectedOutput').textContent = '{ start: ' + result.start + ', endExclusive: ' + result.endExclusive + ' }';
    const length = result.endExclusive - result.start;
    $('#exampleExplanation').textContent =
      length === 0
        ? 'No nonempty valid window exists for these inputs.'
        : 'The earliest longest valid window contains ' + length + ' element' + (length === 1 ? '' : 's') + '.';
  }

  function applyPreset(preset) {
    const presets = {
      standard: { events: 'A, B, A, C, B, B', k: 2 },
      empty: { events: '', k: 2 },
      ties: { events: 'A, B, C, D', k: 2 },
    };
    const value = presets[preset];
    if (!value) return;
    $('#exampleEvents').value = value.events;
    $('#exampleK').value = value.k;
    $$('[data-preset]').forEach((button) => {
      button.classList.toggle('is-active', button.dataset.preset === preset);
    });
    updateExpected();
  }

  function createVisualizationSteps(events, k) {
    let left = 0;
    let best = 0;
    const counts = new Map();
    const steps = [];
    for (let right = 0; right < events.length; right++) {
      counts.set(events[right], (counts.get(events[right]) ?? 0) + 1);
      while (counts.size > k && left <= right) {
        const count = counts.get(events[left]) - 1;
        if (count === 0) counts.delete(events[left]);
        else counts.set(events[left], count);
        left++;
      }
      best = Math.max(best, right - left + 1);
      steps.push({
        left,
        right,
        best,
        counts: Object.fromEntries(counts),
        explanation:
          'Included ' +
          events[right] +
          ' at index ' +
          right +
          '. Valid range: [' +
          left +
          ', ' +
          (right + 1) +
          '); best length: ' +
          best +
          '.',
      });
    }
    return steps;
  }

  const sampleEvents = ['A', 'B', 'A', 'C', 'B', 'B'];
  const sampleSteps = createVisualizationSteps(sampleEvents, 2);

  function drawVisualizer() {
    const step = sampleSteps[visualIndex];
    const container = $('#visualCells');
    container.replaceChildren();
    sampleEvents.forEach((event, index) => {
      const cell = document.createElement('div');
      cell.className = 'visual-cell';
      if (index >= step.left && index <= step.right) cell.classList.add('active');
      if (index === step.right) cell.classList.add('pointer');
      const value = document.createElement('span');
      value.className = 'visual-value';
      value.textContent = event;
      const caption = document.createElement('small');
      caption.textContent = String(index);
      cell.append(value, caption);
      container.append(cell);
    });
    $('#visualStepLabel').textContent = 'Step ' + (visualIndex + 1) + ' of ' + sampleSteps.length;
    $('#visualExplanation').textContent = step.explanation;
    $('#visualCounts').textContent = 'counts = ' + JSON.stringify(step.counts);
    $('#visualPrevious').disabled = visualIndex === 0;
    $('#visualNext').disabled = visualIndex === sampleSteps.length - 1;
  }

  function updateLineNumbers(markEdited = true) {
    const lines = codeEditor.textContent.split('\n').length;
    $('#codeLines').textContent = Array.from({ length: lines }, (_, index) => index + 1).join('\n');
    if (markEdited) $('#draftStatus').textContent = 'Edited locally · not synced';
  }

  function showAttempt(index) {
    const attempt = attempts[index];
    if (!attempt) return;
    selectedAttempt = index;
    $$('[data-attempt]').forEach((button) => {
      button.classList.toggle('is-selected', Number(button.dataset.attempt) === index);
      button.setAttribute('aria-pressed', String(Number(button.dataset.attempt) === index));
    });
    $('#attemptDate').textContent = attempt.date;
    $('#attemptTitle').textContent = attempt.title;
    $('#attemptStatus').textContent = attempt.status;
    $('#attemptStatus').className = 'badge ' + (attempt.tested ? 'badge-success' : 'badge-neutral');
    $('#attemptCode').textContent = attempt.code;
    $('#attemptWhy').textContent = attempt.why;
    $('#attemptLearned').textContent = attempt.learned;
    $('#attemptComplexity').replaceChildren();
    attempt.complexity.forEach((complexity, index) => {
      const chip = document.createElement('span');
      chip.className = 'badge' + (index === 0 ? ' badge-lavender' : '');
      chip.textContent = complexity;
      $('#attemptComplexity').append(chip);
    });
  }

  function resizeOnPointer(event) {
    if (window.innerWidth <= 900) return;
    const grid = $('#solveGrid');
    const bounds = grid.getBoundingClientRect();
    function drag(moveEvent) {
      const position = ((moveEvent.clientX - bounds.left) / bounds.width) * 100;
      grid.style.setProperty('--pane-left', Math.max(30, Math.min(65, position)) + '%');
    }
    function stop() {
      window.removeEventListener('pointermove', drag);
      window.removeEventListener('pointerup', stop);
    }
    window.addEventListener('pointermove', drag);
    window.addEventListener('pointerup', stop, { once: true });
    event.preventDefault();
  }

  $$('[data-navigate]').forEach((button) => button.addEventListener('click', () => navigate(button.dataset.navigate)));
  $$('[data-problem-tab]').forEach((button) =>
    button.addEventListener('click', () => showProblemTab(button.dataset.problemTab)),
  );
  $$('[data-mode-button]').forEach((button) =>
    button.addEventListener('click', () => setMode(button.dataset.modeButton)),
  );
  $$('[data-mobile-button]').forEach((button) =>
    button.addEventListener('click', () => setMobilePane(button.dataset.mobileButton)),
  );
  $$('[data-attempt]').forEach((button) =>
    button.addEventListener('click', () => showAttempt(Number(button.dataset.attempt))),
  );
  $$('[data-preset]').forEach((button) => button.addEventListener('click', () => applyPreset(button.dataset.preset)));

  $('#themeToggle').addEventListener('click', changeTheme);
  $('#challengeSearch').addEventListener('input', filterCatalog);
  $('#difficultyFilter').addEventListener('change', filterCatalog);
  $('#globalSearch').addEventListener('click', () => {
    navigate('explore');
    $('#challengeSearch').focus();
  });
  $('#exampleEvents').addEventListener('input', updateExpected);
  $('#exampleK').addEventListener('input', updateExpected);
  $('#visualPrevious').addEventListener('click', () => {
    visualIndex = Math.max(0, visualIndex - 1);
    drawVisualizer();
  });
  $('#visualNext').addEventListener('click', () => {
    visualIndex = Math.min(sampleSteps.length - 1, visualIndex + 1);
    drawVisualizer();
  });
  $('#openHints').addEventListener('click', () => {
    if (root.dataset.mode !== 'learning') return;
    if (hintIndex < hints.length) {
      announce('Hint ' + (hintIndex + 1) + '/3: ' + hints[hintIndex]);
      hintIndex++;
      $('#openHints').textContent = hintIndex < hints.length ? 'Next hint' : 'All hints viewed';
    } else {
      announce(hints[hints.length - 1]);
    }
  });
  codeEditor.addEventListener('input', updateLineNumbers);
  codeEditor.addEventListener('keydown', (event) => {
    if (event.key === 'Tab') {
      event.preventDefault();
      document.execCommand('insertText', false, '  ');
    }
  });
  $('#resetCode').addEventListener('click', () => {
    if (!window.confirm('Reset the local editor demo to its starter code?')) return;
    codeEditor.textContent = initialCode;
    updateLineNumbers();
    announce('Starter restored locally. No server-side draft was changed.');
  });
  $('#runTests').addEventListener('click', () => {
    $('#testBadge').textContent = 'Not connected';
    $('#testBadge').className = 'badge badge-neutral';
    $('#testBody').querySelector('strong').textContent = 'No test runner in this prototype.';
    $('#testBody').querySelector('span').textContent =
      'The production app will compile and test your current editor code in an isolated execution environment.';
    announce('Mockup only — no code was executed and no tests were passed.');
    if (window.innerWidth <= 700) setMobilePane('tests');
  });
  $('#saveSubmission').addEventListener('click', () =>
    announce('Mockup only — signing in and saving immutable submissions will be implemented later.'),
  );
  $('#exportNotebook').addEventListener('click', () =>
    announce('Mockup only — user-owned export is specified but not implemented.'),
  );
  $('#compareAttempts').addEventListener('click', () => {
    $('#comparisonPanel').hidden = !$('#comparisonPanel').hidden;
  });
  $('#retryAttempt').addEventListener('click', () => {
    codeEditor.textContent = initialCode;
    updateLineNumbers();
    setMode('interview');
    setMobilePane('code');
    navigate('solve');
    announce('Fresh local starter. The illustrative historical attempts are unchanged.');
  });
  $('#resizeGutter').addEventListener('pointerdown', resizeOnPointer);
  $('#resizeGutter').addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    const grid = $('#solveGrid');
    const current = parseFloat(grid.style.getPropertyValue('--pane-left')) || 44;
    grid.style.setProperty(
      '--pane-left',
      Math.min(65, Math.max(30, current + (event.key === 'ArrowRight' ? 3 : -3))) + '%',
    );
  });
  window.addEventListener('keydown', (event) => {
    if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) return;
    const focused = document.activeElement;
    if (focused.matches('input, textarea, select, [contenteditable]')) return;
    event.preventDefault();
    navigate('explore');
    $('#challengeSearch').focus();
  });

  updateExpected();
  drawVisualizer();
  updateLineNumbers(false);
  showAttempt(selectedAttempt);
  navigate('explore');
})();
