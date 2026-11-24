// TaskBoard frontend — plain JavaScript, no build step.
(function () {
  'use strict';

  const STATUSES = ['todo', 'in_progress', 'done'];
  const EMPTY_STATE = {
    todo: { icon: 'sparkle', text: 'Nothing planned yet — add your first task above.' },
    in_progress: { icon: 'bolt', text: 'Drag a card here when you start working on it.' },
    done: { icon: 'trophy', text: 'Finished work lands here. You got this!' },
  };
  const RING_CIRCUMFERENCE = 2 * Math.PI * 24;

  // Static, trusted SVG markup only — user content never goes through innerHTML.
  const ICONS = {
    left: '<svg viewBox="0 0 24 24" width="14" height="14"><path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    right: '<svg viewBox="0 0 24 24" width="14" height="14"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    check: '<svg viewBox="0 0 24 24" width="14" height="14"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    edit: '<svg viewBox="0 0 24 24" width="14" height="14"><path d="M4 20h4L19 9l-4-4L4 16v4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
    trash: '<svg viewBox="0 0 24 24" width="14" height="14"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    clock: '<svg viewBox="0 0 24 24" width="12" height="12"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 7v5l3 2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    sun: '<svg viewBox="0 0 24 24" width="18" height="18"><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    moon: '<svg viewBox="0 0 24 24" width="18" height="18"><path d="M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
    sparkle: '<svg viewBox="0 0 24 24" width="28" height="28"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>',
    bolt: '<svg viewBox="0 0 24 24" width="28" height="28"><path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>',
    trophy: '<svg viewBox="0 0 24 24" width="28" height="28"><path d="M8 4h8v5a4 4 0 01-8 0V4zM8 6H5a3 3 0 003 4M16 6h3a3 3 0 01-3 4M12 13v4M8 21h8M9 17h6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  };

  const state = { tasks: [], search: '', priority: 'all' };

  const $ = (sel) => document.querySelector(sel);
  const form = $('#task-form');
  const titleInput = $('#title');
  const searchInput = $('#search');
  const healthEl = $('#health');
  const themeBtn = $('#theme-toggle');
  const dialog = $('#edit-dialog');
  const editForm = $('#edit-form');
  let editingId = null;

  // ---------- helpers ----------

  function icon(name) {
    const span = document.createElement('span');
    span.className = 'icon';
    span.innerHTML = ICONS[name];
    return span;
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  async function api(path, options = {}) {
    const res = await fetch(path, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    if (res.status === 204) return null;
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = body.errors ? body.errors.join(', ') : body.error || `Request failed (${res.status})`;
      throw new Error(msg);
    }
    return body;
  }

  function toast(message, type = 'info') {
    const t = el('div', `toast ${type}`, message);
    $('#toasts').appendChild(t);
    setTimeout(() => {
      t.classList.add('leaving');
      setTimeout(() => t.remove(), 260);
    }, 2800);
  }

  function relativeTime(iso) {
    const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
    if (seconds < 45) return 'just now';
    const units = [
      ['year', 31536000], ['month', 2592000], ['week', 604800],
      ['day', 86400], ['hour', 3600], ['minute', 60],
    ];
    const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
    for (const [unit, secs] of units) {
      if (seconds >= secs) return rtf.format(-Math.floor(seconds / secs), unit);
    }
    return 'just now';
  }

  // ---------- rendering ----------

  function matchesFilters(task) {
    if (state.priority !== 'all' && task.priority !== state.priority) return false;
    if (!state.search) return true;
    const q = state.search.toLowerCase();
    return task.title.toLowerCase().includes(q) || (task.description || '').toLowerCase().includes(q);
  }

  function renderCard(task) {
    const li = el('li', `card priority-${task.priority}`);
    li.draggable = true;
    li.dataset.id = task.id;
    li.tabIndex = 0;

    const top = el('div', 'card-top');
    top.appendChild(el('span', 'badge', task.priority));
    li.appendChild(top);

    li.appendChild(el('p', 'card-title', task.title));
    if (task.description) li.appendChild(el('p', 'card-desc', task.description));

    const foot = el('div', 'card-foot');
    const time = el('span', 'time');
    time.dataset.updated = task.updatedAt;
    time.appendChild(icon('clock'));
    time.appendChild(document.createTextNode(relativeTime(task.updatedAt)));
    time.title = `Updated ${new Date(task.updatedAt).toLocaleString()}`;
    foot.appendChild(time);

    const actions = el('div', 'actions');
    const idx = STATUSES.indexOf(task.status);
    if (idx > 0) actions.appendChild(actionBtn('left', 'Move back', () => moveTask(task.id, STATUSES[idx - 1])));
    if (idx < STATUSES.length - 1) {
      const next = STATUSES[idx + 1];
      actions.appendChild(actionBtn(next === 'done' ? 'check' : 'right', next === 'done' ? 'Mark done' : 'Start', () => moveTask(task.id, next), next === 'done' ? 'success' : ''));
    }
    actions.appendChild(actionBtn('edit', 'Edit', () => openEdit(task.id)));
    actions.appendChild(actionBtn('trash', 'Delete', () => deleteTask(task.id), 'danger'));
    foot.appendChild(actions);
    li.appendChild(foot);

    li.addEventListener('dblclick', () => openEdit(task.id));
    li.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target === li) openEdit(task.id);
    });
    li.addEventListener('dragstart', (e) => {
      li.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', task.id);
    });
    li.addEventListener('dragend', () => li.classList.remove('dragging'));

    return li;
  }

  function actionBtn(iconName, label, onClick, variant = '') {
    const b = el('button', `act ${variant}`.trim());
    b.type = 'button';
    b.title = label;
    b.setAttribute('aria-label', label);
    b.appendChild(icon(iconName));
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      onClick();
    });
    return b;
  }

  function renderEmpty(status) {
    const li = el('li', 'empty');
    li.appendChild(icon(EMPTY_STATE[status].icon));
    const filtered = state.search || state.priority !== 'all';
    li.appendChild(el('span', '', filtered ? 'No tasks match your filters.' : EMPTY_STATE[status].text));
    return li;
  }

  function render() {
    const visible = state.tasks.filter(matchesFilters);
    for (const status of STATUSES) {
      const list = document.querySelector(`.cards[data-status="${status}"]`);
      const items = visible.filter((t) => t.status === status);
      list.replaceChildren(...(items.length ? items.map(renderCard) : [renderEmpty(status)]));
      document.querySelector(`[data-count="${status}"]`).textContent = items.length;
    }
    renderStats();
  }

  function renderStats() {
    const total = state.tasks.length;
    const done = state.tasks.filter((t) => t.status === 'done').length;
    const pct = total ? Math.round((done / total) * 100) : 0;
    $('#stat-total').textContent = total;
    $('#stat-progress').textContent = state.tasks.filter((t) => t.status === 'in_progress').length;
    $('#stat-high').textContent = state.tasks.filter((t) => t.priority === 'high' && t.status !== 'done').length;
    $('#stat-done-pct').textContent = `${pct}%`;
    $('#ring-fg').style.strokeDashoffset = String(RING_CIRCUMFERENCE * (1 - pct / 100));
  }

  // ---------- data actions ----------

  async function loadTasks() {
    try {
      state.tasks = await api('/api/tasks');
      render();
    } catch (err) {
      toast(`Could not load tasks: ${err.message}`, 'error');
    }
  }

  async function moveTask(id, status) {
    const task = state.tasks.find((t) => t.id === id);
    if (!task || task.status === status) return;
    const previous = task.status;
    task.status = status; // optimistic update for a snappy feel
    render();
    try {
      Object.assign(task, await api(`/api/tasks/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }));
      render();
      if (status === 'done') toast('Nice! Task completed 🎉', 'success');
    } catch (err) {
      task.status = previous;
      render();
      toast(err.message, 'error');
    }
  }

  async function deleteTask(id) {
    try {
      await api(`/api/tasks/${id}`, { method: 'DELETE' });
      state.tasks = state.tasks.filter((t) => t.id !== id);
      render();
      toast('Task deleted');
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    try {
      const task = await api('/api/tasks', { method: 'POST', body: JSON.stringify(data) });
      state.tasks.push(task);
      form.reset();
      titleInput.focus();
      render();
      toast('Task added', 'success');
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  // ---------- edit dialog ----------

  function openEdit(id) {
    const task = state.tasks.find((t) => t.id === id);
    if (!task) return;
    editingId = id;
    editForm.elements.title.value = task.title;
    editForm.elements.description.value = task.description || '';
    editForm.elements.status.value = task.status;
    editForm.elements.priority.value = task.priority;
    dialog.showModal();
    editForm.elements.title.focus();
  }

  editForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(editForm));
    try {
      const updated = await api(`/api/tasks/${editingId}`, { method: 'PATCH', body: JSON.stringify(data) });
      state.tasks = state.tasks.map((t) => (t.id === updated.id ? updated : t));
      dialog.close();
      render();
      toast('Changes saved', 'success');
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  $('#edit-cancel').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close(); // click on backdrop
  });

  // ---------- drag & drop ----------

  document.querySelectorAll('.cards').forEach((list) => {
    list.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      list.classList.add('drag-over');
    });
    list.addEventListener('dragleave', (e) => {
      if (!list.contains(e.relatedTarget)) list.classList.remove('drag-over');
    });
    list.addEventListener('drop', (e) => {
      e.preventDefault();
      list.classList.remove('drag-over');
      const id = e.dataTransfer.getData('text/plain');
      if (id) moveTask(id, list.dataset.status);
    });
  });

  // ---------- search & filters ----------

  searchInput.addEventListener('input', () => {
    state.search = searchInput.value.trim();
    render();
  });

  document.querySelectorAll('#filters .chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('#filters .chip').forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      state.priority = chip.dataset.filter;
      render();
    });
  });

  // ---------- keyboard shortcuts ----------

  document.addEventListener('keydown', (e) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
    if (e.key === 'Escape' && document.activeElement === searchInput) {
      searchInput.value = '';
      state.search = '';
      searchInput.blur();
      render();
      return;
    }
    if (typing || dialog.open || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === '/') {
      e.preventDefault();
      searchInput.focus();
    } else if (e.key.toLowerCase() === 'n') {
      e.preventDefault();
      titleInput.focus();
    }
  });

  // ---------- theme ----------

  function storedTheme() {
    try {
      return localStorage.getItem('taskboard-theme');
    } catch {
      return null;
    }
  }

  function currentTheme() {
    return document.documentElement.dataset.theme ||
      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  }

  function applyTheme(theme) {
    if (theme) document.documentElement.dataset.theme = theme;
    themeBtn.replaceChildren(icon(currentTheme() === 'dark' ? 'sun' : 'moon'));
  }

  themeBtn.addEventListener('click', () => {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    try {
      localStorage.setItem('taskboard-theme', next);
    } catch {
      /* storage unavailable — theme just won't persist */
    }
  });

  // ---------- health & info ----------

  async function checkHealth() {
    const label = healthEl.querySelector('.health-label');
    try {
      await api('/readyz');
      healthEl.className = 'health ok';
      label.textContent = 'All systems go';
    } catch {
      healthEl.className = 'health down';
      label.textContent = 'Degraded';
    }
  }

  async function loadInfo() {
    const meta = $('#meta');
    try {
      const info = await api('/api/info');
      const chips = [
        ['version', `v${info.version}`],
        ['env', info.environment],
        ['storage', info.storage],
        ['served by', info.hostname],
      ].map(([k, v]) => {
        const chip = el('span', 'meta-chip', `${k} `);
        chip.appendChild(el('b', '', v));
        return chip;
      });
      meta.replaceChildren(...chips);
    } catch {
      meta.replaceChildren(el('span', 'meta-chip', 'app info unavailable'));
    }
  }

  // ---------- boot ----------

  $('#today').textContent = new Date().toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric',
  });
  applyTheme(storedTheme());
  loadTasks();
  loadInfo();
  checkHealth();
  setInterval(checkHealth, 10000);
  // Keep "updated x minutes ago" fresh without re-rendering (which would replay animations).
  setInterval(() => {
    document.querySelectorAll('.time[data-updated]').forEach((t) => {
      t.lastChild.textContent = relativeTime(t.dataset.updated);
    });
  }, 60000);
})();
