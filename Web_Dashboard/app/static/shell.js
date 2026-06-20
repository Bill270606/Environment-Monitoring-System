// ── AUTH CHECK ──
const user = JSON.parse(localStorage.getItem('em_user') || 'null');
if (!user) { window.location.href = '/login'; }
else {
  const initial = (user.name || 'U')[0].toUpperCase();
  ['sb-avatar','chip-avatar'].forEach(id => {
    const el = document.getElementById(id);
    if(el) el.textContent = initial;
  });
  const nameEl = document.getElementById('sb-name');
  const chipEl = document.getElementById('chip-name');
  if(nameEl) nameEl.textContent = user.name || 'User';
  if(chipEl) chipEl.textContent = (user.name || 'User').split(' ').slice(-1)[0];
}

function logout() {
  localStorage.removeItem('em_user');
  window.location.href = '/login';
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

// ── THEME ──
function applyTheme(theme) {
  document.body.dataset.theme = theme;
  localStorage.setItem('em_theme', theme);
  const btn = document.getElementById('theme-toggle');
  if(btn) btn.textContent = theme === 'light' ? '☀️' : '🌙';
  if(typeof updateChartTheme === 'function') updateChartTheme(theme);
}
function toggleTheme() {
  applyTheme(document.body.dataset.theme === 'light' ? 'dark' : 'light');
}
document.getElementById('theme-toggle')?.addEventListener('click', toggleTheme);
applyTheme(localStorage.getItem('em_theme') || 'dark');

// ── KEYBOARD SHORTCUTS (D / R) + HINT PANEL ──
function isTypingTarget(el) {
  const tag = (el.tagName || '').toLowerCase();
  return tag === 'input' || tag === 'textarea' || el.isContentEditable;
}

document.addEventListener('keydown', e => {
  if(e.ctrlKey || e.metaKey || e.altKey || isTypingTarget(e.target)) return;
  if(e.key.toLowerCase() === 'd') { e.preventDefault(); toggleTheme(); }
  else if(e.key.toLowerCase() === 'r') {
    e.preventDefault();
    if(typeof pageRefresh === 'function') pageRefresh();
    else location.reload();
  }
});

function toggleShortcutsPanel() {
  document.getElementById('shortcuts-panel')?.classList.toggle('open');
}
function closeShortcutsPanel() {
  document.getElementById('shortcuts-panel')?.classList.remove('open');
}
document.getElementById('shortcuts-trigger')?.addEventListener('click', e => {
  e.stopPropagation();
  toggleShortcutsPanel();
});
document.addEventListener('click', e => {
  const panel = document.getElementById('shortcuts-panel');
  const trigger = document.getElementById('shortcuts-trigger');
  if(panel && panel.classList.contains('open') && !panel.contains(e.target) && e.target !== trigger) closeShortcutsPanel();
});
document.addEventListener('keydown', e => {
  if(e.key === 'Escape') closeShortcutsPanel();
});

// ── DISABLED ("Soon") NAV ITEMS ──
document.querySelectorAll('.nav-item.disabled').forEach(el => {
  el.addEventListener('click', e => e.preventDefault());
});
