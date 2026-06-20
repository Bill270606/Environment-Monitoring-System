const ALERT_TYPES = [
  { key:'temp', icon:'🌡️', label:'Temperature', match:'temperature' },
  { key:'hum',  icon:'💧',  label:'Humidity',    match:'humidity' },
  { key:'soil', icon:'🌱',  label:'Soil',        match:'Soil' },
];

function typeOf(msg) {
  return ALERT_TYPES.find(t => msg.includes(t.match)) || { key:'other', icon:'⚠️', label:'Other' };
}

function loadAlerts() {
  return JSON.parse(localStorage.getItem('em_alerts') || '[]');
}

let activeFilter = 'all';

function renderFilters() {
  const all = loadAlerts();
  const present = ALERT_TYPES.filter(t => all.some(a => typeOf(a.msg).key === t.key));
  const wrap = document.getElementById('alerts-filters');
  const chips = [{ key:'all', icon:'🔔', label:'All' }, ...present];
  wrap.innerHTML = chips.map(c =>
    `<button class="alert-filter-chip ${c.key === activeFilter ? 'active' : ''}" data-key="${c.key}">${c.icon} ${c.label}</button>`
  ).join('');
  wrap.querySelectorAll('.alert-filter-chip').forEach(btn => {
    btn.addEventListener('click', () => { activeFilter = btn.dataset.key; renderFilters(); renderFullAlerts(); });
  });
}

function renderFullAlerts() {
  const all = loadAlerts();
  const filtered = activeFilter === 'all' ? all : all.filter(a => typeOf(a.msg).key === activeFilter);
  const list = document.getElementById('full-alerts-list');

  if(all.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="ce-icon">✅</div>
        <h3 class="ce-title">No alerts recorded yet</h3>
        <p class="ce-desc">When a sensor reading goes above its warning threshold, it will show up here.</p>
      </div>`;
    return;
  }
  if(filtered.length === 0) {
    list.innerHTML = `<div class="no-alerts">No alerts in this category</div>`;
    return;
  }
  list.innerHTML = filtered.map(a => {
    const t = typeOf(a.msg);
    return `
    <div class="alert-item">
      <span class="alert-icon">${t.icon}</span>
      <div class="alert-info">
        <div class="alert-msg">${a.msg}</div>
        <div class="alert-time">${a.date || ''} ${a.time}</div>
      </div>
    </div>`;
  }).join('');
}

document.getElementById('clear-alerts')?.addEventListener('click', () => {
  if(!confirm('Clear all alert history? This cannot be undone.')) return;
  localStorage.removeItem('em_alerts');
  activeFilter = 'all';
  renderFilters();
  renderFullAlerts();
  document.getElementById('alert-count').textContent = '0';
});

function pageRefresh() { location.reload(); }

renderFilters();
renderFullAlerts();

const alertN = loadAlerts().length;
['alert-count','notif-badge'].forEach(id => {
  const el = document.getElementById(id);
  if(el && alertN > 0) { el.textContent = alertN; el.style.display = ''; }
});

document.body.classList.remove('is-loading');
