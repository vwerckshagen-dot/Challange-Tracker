const STORAGE_KEY = 'meplanes.challenge-tracker';
const ACTIVE_USER_KEY = 'meplanes.challenge-tracker.active-user';
const STORAGE_VERSION = 2;

const USERS = [
  { id: 'friend-a', label: 'Vinc' },
  { id: 'friend-b', label: 'Vale' },
];

const ENTRY_PREFIX = {
  'friend-a': 'friendA',
  'friend-b': 'friendB',
};

const DISCIPLINES = [
  { key: 'pushUps', label: 'Push-ups', unit: 'Wdh.' },
  { key: 'pullUps', label: 'Pull-ups', unit: 'Wdh.' },
  { key: 'runKm', label: 'Laufkilometer', unit: 'km', fractionDigits: 1 },
];

const activeUserId = loadActiveUserId();
let els = null;
let state = defaultState();

if (!activeUserId) {
  window.location.replace('index.html');
} else {
  els = {
  summaryWeeks: document.querySelector('[data-summary="weeks-count"]'),
  summaryCurrentWeek: document.querySelector('[data-summary="current-week"]'),
  summaryLastSaved: document.querySelector('[data-summary="last-saved"]'),
  weeklyCard: document.querySelector('[data-result-card="weekly"]'),
  monthlyCard: document.querySelector('[data-result-card="monthly"]'),
  weeklyLabel: document.querySelector('[data-week-label]'),
  weeklyState: document.querySelector('[data-week-state]'),
  monthlyLabel: document.querySelector('[data-month-label]'),
  monthlyState: document.querySelector('[data-month-state]'),
  weeklyComparison: document.querySelector('[data-comparison="weekly"]'),
  monthlyComparison: document.querySelector('[data-comparison="monthly"]'),
  weeklyEmpty: document.querySelector('[data-empty-note="weekly"]'),
  monthlyEmpty: document.querySelector('[data-empty-note="monthly"]'),
  historyList: document.querySelector('[data-history-list]'),
  emptyHistory: document.querySelector('[data-empty-history]'),
  form: document.getElementById('result-form'),
  entryForm: document.querySelector('.entry-form'),
  formStatus: document.getElementById('form-status'),
  weekDate: document.getElementById('weekDate'),
  editingWeekKey: document.querySelector('input[name="editingWeekKey"]'),
  cancelEdit: document.querySelector('[data-cancel-edit]'),
  submitLabel: document.querySelector('[data-submit-label]'),
  logoutButton: document.querySelector('[data-logout]'),
  resetButtons: document.querySelectorAll('[data-reset-trigger]'),
  yearSlot: document.getElementById('year-slot'),
  skipLink: document.querySelector('.skip-link'),
  main: document.getElementById('content'),
  userFieldsets: document.querySelectorAll('[data-user-fieldset]'),
  };

  state = loadState();
  const revealTargets = document.querySelectorAll('[data-reveal]');

  document.documentElement.dataset.js = 'true';
  setCurrentYear();
  setupRevealObserver(revealTargets);
  setupSkipLinkFocus();
  setupForm();
  setupLogoutButton();
  setupResetButtons();
  seedWeekDate();
  render();
}

function defaultState() {
  return {
    version: STORAGE_VERSION,
    weeks: [],
  };
}

function loadActiveUserId() {
  try {
    const stored = sessionStorage.getItem(ACTIVE_USER_KEY);
    return USERS.some((user) => user.id === stored) ? stored : '';
  } catch {
    return '';
  }
}

function setActiveUserId(userId) {
  activeUserId = USERS.some((user) => user.id === userId) ? userId : '';
  try {
    if (activeUserId) {
      sessionStorage.setItem(ACTIVE_USER_KEY, activeUserId);
    } else {
      sessionStorage.removeItem(ACTIVE_USER_KEY);
    }
  } catch {
    /* sessionStorage unavailable */
  }
}

function getActiveUser() {
  return USERS.find((user) => user.id === activeUserId) || null;
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return defaultState();
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return defaultState();
    }

    if (parsed.version !== STORAGE_VERSION) {
      return migrateState(parsed);
    }

    return normalizeState(parsed);
  } catch {
    return defaultState();
  }
}

function migrateState(previous) {
  if (!previous || typeof previous !== 'object') {
    return defaultState();
  }

  if (Array.isArray(previous.weeks)) {
    return normalizeState({
      version: STORAGE_VERSION,
      weeks: previous.weeks,
    });
  }

  return defaultState();
}

function normalizeState(input) {
  const normalizedWeeks = Array.isArray(input.weeks)
    ? input.weeks
        .map(normalizeWeekRecord)
        .filter(Boolean)
        .sort((left, right) => right.weekStart.localeCompare(left.weekStart))
    : [];

  return {
    version: STORAGE_VERSION,
    weeks: normalizedWeeks,
  };
}

function normalizeWeekRecord(record) {
  if (!record || typeof record !== 'object') {
    return null;
  }

  const entryDate = isValidDateString(record.entryDate) ? record.entryDate : record.weekStart;
  const weekDate = parseDateInput(entryDate || toDateInputValue(new Date()));
  if (!weekDate) {
    return null;
  }

  const weekStart = startOfIsoWeek(weekDate);
  const weekEnd = endOfIsoWeek(weekDate);
  const entries = normalizeEntries(record.entries || record.results || {});

  return {
    id: record.id || toDateKey(weekStart),
    entryDate: toDateInputValue(weekDate),
    weekStart: toDateKey(weekStart),
    weekEnd: toDateKey(weekEnd),
    label: formatWeekRange(weekStart, weekEnd),
    createdAt: record.createdAt || new Date().toISOString(),
    updatedAt: record.updatedAt || record.createdAt || new Date().toISOString(),
    entries,
  };
}

function normalizeEntries(entries) {
  return USERS.reduce((accumulator, user) => {
    const source = entries[user.id] || {};
    if (hasAnyEntryValue(source)) {
      accumulator[user.id] = normalizeEntry(source);
    }
    return accumulator;
  }, {});
}

function normalizeEntry(source) {
  return {
    pushUps: toNumber(source.pushUps),
    pullUps: toNumber(source.pullUps),
    runKm: toNumber(source.runKm, 1),
    submittedAt: source.submittedAt || source.updatedAt || new Date().toISOString(),
  };
}

function hasAnyEntryValue(source) {
  return source && (source.pushUps !== undefined || source.pullUps !== undefined || source.runKm !== undefined);
}

function setupForm() {
  els.form.addEventListener('submit', handleSubmit);
  els.cancelEdit.addEventListener('click', clearEditState);
}

function setupLogoutButton() {
  if (!els.logoutButton) {
    return;
  }

  els.logoutButton.addEventListener('click', () => {
    try {
      sessionStorage.removeItem(ACTIVE_USER_KEY);
    } catch {
      /* sessionStorage unavailable */
    }

    window.location.href = 'index.html';
  });
}

function setupResetButtons() {
  els.resetButtons.forEach((button) => {
    button.addEventListener('click', handleReset);
  });
}

function setupSkipLinkFocus() {
  if (!els.skipLink || !els.main) {
    return;
  }

  els.skipLink.addEventListener('click', () => {
    requestAnimationFrame(() => {
      els.main.focus({ preventScroll: true });
    });
  });
}

function setupRevealObserver(revealTargets) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
    revealTargets.forEach((element) => element.classList.add('is-visible'));
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.18 });

  revealTargets.forEach((element) => observer.observe(element));
}

function seedWeekDate() {
  if (!els.weekDate.value) {
    els.weekDate.value = toDateInputValue(new Date());
  }
}

function render() {
  const today = new Date();
  const currentWeek = getWeekRecordForDate(today);
  const currentMonthWeeks = getWeeksForMonth(today);
  const latestWeek = state.weeks[0] || null;
  const currentWeekLabel = currentWeek ? currentWeek.label : formatWeekLabelFromDate(today);
  const monthLabel = formatMonthLabel(today);
  const editingWeek = els.editingWeekKey.value
    ? state.weeks.find((week) => week.weekStart === els.editingWeekKey.value) || null
    : null;
  const formWeek = editingWeek || currentWeek;

  els.summaryWeeks.textContent = String(state.weeks.length);
  els.summaryCurrentWeek.textContent = currentWeekLabel;
  els.summaryLastSaved.textContent = latestWeek ? formatRelativeStamp(latestWeek.updatedAt) : 'Noch nichts gespeichert';

  renderLoginState();
  updateStorageStatus();
  renderResultCard('weekly', els.weeklyCard, buildWeekSummary(currentWeek, today), currentWeekLabel);
  renderResultCard('monthly', els.monthlyCard, buildMonthSummary(currentMonthWeeks, today), monthLabel);
  renderHistory();
  syncFormState(formWeek);
}

function renderLoginState() {
  const activeUser = getActiveUser();

  els.userFieldsets.forEach((fieldset) => {
    const userId = fieldset.getAttribute('data-user-fieldset');
    const isActive = activeUser ? activeUser.id === userId : false;
    fieldset.toggleAttribute('disabled', !isActive);
  });
}

function renderResultCard(kind, container, summary, label) {
  const comparison = kind === 'weekly' ? els.weeklyComparison : els.monthlyComparison;
  const emptyNote = kind === 'weekly' ? els.weeklyEmpty : els.monthlyEmpty;
  const title = kind === 'weekly' ? els.weeklyLabel : els.monthlyLabel;
  const statePill = kind === 'weekly' ? els.weeklyState : els.monthlyState;

  title.textContent = label;
  statePill.textContent = getSummaryState(summary);

  container.classList.toggle('is-empty', summary.totalEntries === 0);
  comparison.innerHTML = '';

  if (summary.totalEntries === 0) {
    emptyNote.hidden = false;
    return;
  }

  emptyNote.hidden = true;
  comparison.append(...DISCIPLINES.map((discipline) => createComparisonRow(summary, discipline)));
}

function createComparisonRow(summary, discipline) {
  const row = document.createElement('div');
  row.className = 'comparison-row';

  const leftUser = USERS[0];
  const rightUser = USERS[1];
  const leftEntry = summary.entries[leftUser.id];
  const rightEntry = summary.entries[rightUser.id];
  const leftValue = leftEntry ? leftEntry[discipline.key] : null;
  const rightValue = rightEntry ? rightEntry[discipline.key] : null;
  const leader = getLeaderLabel(leftValue, rightValue, leftEntry, rightEntry);

  row.innerHTML = `
    <div class="row-label">
      <span>${discipline.label}</span>
    </div>
    <div class="metric">
      <span>${leftUser.label}</span>
      <strong>${formatMetricValue(leftValue, discipline)}</strong>
      <small>${formatEntryState(summary.coverage[leftUser.id], summary.totalBuckets)}</small>
    </div>
    <div class="metric">
      <span>${rightUser.label}</span>
      <strong>${formatMetricValue(rightValue, discipline)}</strong>
      <small>${formatEntryState(summary.coverage[rightUser.id], summary.totalBuckets)}</small>
    </div>
    <div class="leader">${leader}</div>
  `;

  return row;
}

function renderHistory() {
  const weeks = state.weeks.slice(0, 8);
  els.historyList.innerHTML = '';
  els.emptyHistory.hidden = weeks.length > 0;

  if (!weeks.length) {
    return;
  }

  for (const week of weeks) {
    const item = document.createElement('article');
    item.className = 'history-item';
    item.innerHTML = `
      <div class="history-main">
        <strong>${week.label}</strong>
        <span class="history-meta">Eingegeben: ${formatRelativeStamp(week.updatedAt)}</span>
      </div>
      <div class="history-discipline">
        <span>${formatHistoryTotals(week.entries[USERS[0].id])}</span>
        <span>${formatHistoryTotals(week.entries[USERS[1].id])}</span>
      </div>
      <div class="history-actions">
        <button type="button" class="button button-ghost" data-edit-week="${week.weekStart}">Meine Woche laden</button>
      </div>
    `;
    els.historyList.append(item);
  }

  els.historyList.querySelectorAll('[data-edit-week]').forEach((button) => {
    button.addEventListener('click', () => loadWeekIntoForm(button.getAttribute('data-edit-week')));
  });
}

function syncFormState(currentWeek) {
  const activeUser = getActiveUser();
  const isLocked = !activeUser;
  els.entryForm.classList.toggle('is-locked', isLocked);
  els.submitLabel.textContent = isLocked
    ? 'Zum Speichern anmelden'
    : (els.editingWeekKey.value ? 'Eintrag aktualisieren' : 'Woche speichern');
  els.submitLabel.disabled = isLocked;
  els.cancelEdit.hidden = !els.editingWeekKey.value;
  els.weekDate.disabled = isLocked || Boolean(els.editingWeekKey.value);

  if (isLocked) {
    updateFormStatus('Bitte oben anmelden, um eigene Werte einzutragen.');
  } else if (!currentWeek) {
    updateFormStatus(`Angemeldet als ${activeUser.label}. Für diese Woche gibt es noch keinen gemeinsamen Eintrag.`);
  } else {
    updateFormStatus(`Angemeldet als ${activeUser.label}.`);
  }

  syncUserInputs(currentWeek);
}

function syncUserInputs(currentWeek) {
  const activeUser = getActiveUser();
  const record = currentWeek || null;

  USERS.forEach((user) => {
    const prefix = ENTRY_PREFIX[user.id];
    const entry = record?.entries?.[user.id] || null;
    setCompetitorValues(prefix, entry);
    const fieldset = document.querySelector(`[data-user-fieldset="${user.id}"]`);
    if (fieldset) {
      fieldset.disabled = !activeUser || activeUser.id !== user.id;
    }
  });
}

function handleSubmit(event) {
  event.preventDefault();

  const activeUser = getActiveUser();
  if (!activeUser) {
    updateFormStatus('Bitte erst anmelden.');
    return;
  }

  const fieldset = document.querySelector(`[data-user-fieldset="${activeUser.id}"]`);
  if (!fieldset || !els.form.reportValidity()) {
    updateFormStatus('Bitte alle Felder prüfen.');
    return;
  }

  const weekDate = parseDateInput(els.weekDate.value);
  if (!weekDate) {
    updateFormStatus('Bitte ein gültiges Datum wählen.');
    return;
  }

  const weekStart = startOfIsoWeek(weekDate);
  const weekEnd = endOfIsoWeek(weekDate);
  const weekKey = toDateKey(weekStart);
  const existingWeek = state.weeks.find((week) => week.weekStart === weekKey);
  const updatedWeek = {
    id: weekKey,
    entryDate: els.weekDate.value,
    weekStart: weekKey,
    weekEnd: toDateKey(weekEnd),
    label: formatWeekRange(weekStart, weekEnd),
    createdAt: existingWeek?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    entries: {
      ...(existingWeek?.entries || {}),
      [activeUser.id]: readUserValues(activeUser.id),
    },
  };

  state = {
    ...state,
    weeks: [updatedWeek, ...state.weeks.filter((week) => week.weekStart !== weekKey)]
      .sort((left, right) => right.weekStart.localeCompare(left.weekStart)),
  };

  persistState();
  updateFormStatus(`Werte für ${activeUser.label} gespeichert.`);
  clearEditState(false);
  render();
}

function readUserValues(userId) {
  const prefix = ENTRY_PREFIX[userId];
  return {
    pushUps: toNumber(document.getElementById(`${prefix}-pushUps`).value),
    pullUps: toNumber(document.getElementById(`${prefix}-pullUps`).value),
    runKm: toNumber(document.getElementById(`${prefix}-runKm`).value, 1),
    submittedAt: new Date().toISOString(),
  };
}

function loadWeekIntoForm(weekKey) {
  const activeUser = getActiveUser();
  if (!activeUser) {
    updateFormStatus('Bitte erst anmelden.');
    return;
  }

  const week = state.weeks.find((entry) => entry.weekStart === weekKey);
  if (!week) {
    return;
  }

  els.editingWeekKey.value = week.weekStart;
  els.weekDate.value = week.entryDate;
  const activeValues = week.entries?.[activeUser.id] || null;
  setCompetitorValues(ENTRY_PREFIX[activeUser.id], activeValues);
  updateFormStatus(`Woche ${week.label} ist für ${activeUser.label} geöffnet.`);
  syncFormState(week);
  els.form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function setCompetitorValues(prefix, values) {
  const pushUpsInput = document.getElementById(`${prefix}-pushUps`);
  const pullUpsInput = document.getElementById(`${prefix}-pullUps`);
  const runKmInput = document.getElementById(`${prefix}-runKm`);

  pushUpsInput.value = values ? values.pushUps : '';
  pullUpsInput.value = values ? values.pullUps : '';
  runKmInput.value = values ? values.runKm : '';
}

function clearEditState(announce = true) {
  els.editingWeekKey.value = '';
  els.form.reset();
  seedWeekDate();
  if (announce) {
    updateFormStatus('Bearbeitung beendet.');
  }
  syncFormState(getWeekRecordForDate(new Date()));
}

function handleReset() {
  const confirmed = window.confirm('Alle lokal gespeicherten Wochen wirklich löschen?');
  if (!confirmed) {
    return;
  }

  try {
    localStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(ACTIVE_USER_KEY);
  } catch {
    /* storage unavailable */
  }

  state = defaultState();
  setActiveUserId('');
  clearEditState(false);
  render();
  updateFormStatus('Lokale Daten wurden gelöscht.');
}

function persistState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    updateFormStatus('Speichern im Browser ist momentan nicht möglich.');
  }
}

function updateStorageStatus() {
}

function updateFormStatus(message) {
  els.formStatus.textContent = message;
}

function getWeekRecordForDate(date) {
  const weekStart = toDateKey(startOfIsoWeek(date));
  return state.weeks.find((week) => week.weekStart === weekStart) || null;
}

function getWeeksForMonth(date) {
  const monthKey = getMonthKey(date);
  return state.weeks.filter((week) => getMonthKey(parseWeekStart(week.weekStart)) === monthKey);
}

function buildWeekSummary(week, monthDate) {
  const label = week ? week.label : formatWeekLabelFromDate(monthDate);
  return createSummary(week ? [week] : [], label, 1);
}

function buildMonthSummary(weeks, monthDate) {
  return createSummary(weeks, formatMonthLabel(monthDate), weeks.length || 1);
}

function createSummary(weeks, label, totalBuckets) {
  const entries = USERS.reduce((accumulator, user) => {
    accumulator[user.id] = null;
    return accumulator;
  }, {});

  const coverage = USERS.reduce((accumulator, user) => {
    accumulator[user.id] = 0;
    return accumulator;
  }, {});

  let totalEntries = 0;

  for (const week of weeks) {
    for (const user of USERS) {
      const entry = week.entries?.[user.id];
      if (!entry) {
        continue;
      }

      if (!entries[user.id]) {
        entries[user.id] = { pushUps: 0, pullUps: 0, runKm: 0 };
      }
      entries[user.id].pushUps += entry.pushUps;
      entries[user.id].pullUps += entry.pullUps;
      entries[user.id].runKm += entry.runKm;
      coverage[user.id] += 1;
      totalEntries += 1;
    }
  }

  return {
    label,
    totalBuckets,
    totalEntries,
    entries,
    coverage,
  };
}

function getSummaryState(summary) {
  if (summary.totalEntries === 0) {
    return 'Leer';
  }

  const complete = USERS.every((user) => summary.coverage[user.id] === summary.totalBuckets);
  return complete ? 'Vollständig' : 'Teilweise';
}

function getLeaderLabel(leftValue, rightValue, leftEntry, rightEntry) {
  if (!leftEntry && !rightEntry) {
    return 'Offen';
  }

  if (!leftEntry || !rightEntry) {
    return 'Offen';
  }

  if (leftValue === rightValue) {
    return 'Gleichstand';
  }

  return leftValue > rightValue ? USERS[0].label : USERS[1].label;
}

function formatEntryState(coverage, totalBuckets) {
  if (!coverage) {
    return 'offen';
  }

  return coverage >= totalBuckets ? 'vollständig' : 'teilweise';
}

function formatHistoryTotals(entry) {
  if (!entry) {
    return 'offen';
  }

  return `${formatMetricValue(entry.pushUps, DISCIPLINES[0])} · ${formatMetricValue(entry.pullUps, DISCIPLINES[1])} · ${formatMetricValue(entry.runKm, DISCIPLINES[2])}`;
}

function formatMetricValue(value, discipline) {
  if (value === null || value === undefined) {
    return '—';
  }

  if (discipline.fractionDigits === 1) {
    return `${value.toFixed(1)} ${discipline.unit}`;
  }

  return `${value} ${discipline.unit}`;
}

function formatWeekRange(start, end) {
  return `${formatDate(start, { day: '2-digit', month: '2-digit' })} bis ${formatDate(end, { day: '2-digit', month: '2-digit', year: 'numeric' })}`;
}

function formatWeekLabelFromDate(date) {
  const start = startOfIsoWeek(date);
  const end = endOfIsoWeek(date);
  return formatWeekRange(start, end);
}

function formatMonthLabel(date) {
  return formatDate(date, { month: 'long', year: 'numeric' });
}

function formatRelativeStamp(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'unbekannt';
  }

  return formatDate(date, { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatDate(date, options) {
  return new Intl.DateTimeFormat('de-DE', options).format(date);
}

function parseDateInput(value) {
  if (!value) {
    return null;
  }

  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) {
    return null;
  }

  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function startOfIsoWeek(date) {
  const result = new Date(date);
  result.setHours(12, 0, 0, 0);
  const day = (result.getDay() + 6) % 7;
  result.setDate(result.getDate() - day);
  result.setHours(0, 0, 0, 0);
  return result;
}

function endOfIsoWeek(date) {
  const result = startOfIsoWeek(date);
  result.setDate(result.getDate() + 6);
  result.setHours(23, 59, 59, 999);
  return result;
}

function toDateKey(date) {
  return toDateInputValue(date);
}

function toDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getMonthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function parseWeekStart(value) {
  const date = parseDateInput(value);
  return date || new Date();
}

function isValidDateString(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function toNumber(value, fractionDigits = 0) {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  if (fractionDigits === 1) {
    return Math.round(parsed * 10) / 10;
  }

  return Math.round(parsed);
}

function setCurrentYear() {
  if (els.yearSlot) {
    els.yearSlot.textContent = String(new Date().getFullYear());
  }
}