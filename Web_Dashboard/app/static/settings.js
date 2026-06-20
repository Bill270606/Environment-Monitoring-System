// ── CONFIG (mirrors dashboard.js, kept independent on purpose) ──
const SENSOR_DEFAULTS = {
  temp: { icon:'🌡️', name:'Temperature', unit:'°C',  min:0, max:50,   warn:35 },
  hum:  { icon:'💧',  name:'Humidity',    unit:'%',   min:0, max:100,  warn:85 },
  soil: { icon:'🌱',  name:'Soil Dryness', unit:'raw', min:0, max:4095, warn:3000 },
};
const NON_CONFIGURABLE = {
  lux:  { icon:'☀️', name:'Light', unit:'lux', min:0, max:1000 },
  uv:   { icon:'🔆', name:'UV',    unit:'V',   min:0, max:3.3 },
  rain: { icon:'🌧️', name:'Rain',  unit:'raw', min:0, max:4095 },
};

function loadThresholds() {
  return JSON.parse(localStorage.getItem('em_thresholds') || '{}');
}

function renderSettings() {
  const saved = loadThresholds();
  const grid = document.getElementById('settings-grid');
  grid.innerHTML = Object.keys(SENSOR_DEFAULTS).map(key => {
    const s = SENSOR_DEFAULTS[key];
    const current = typeof saved[key] === 'number' ? saved[key] : s.warn;
    return `
    <div class="settings-card">
      <div class="settings-card-head">
        <span class="settings-icon">${s.icon}</span>
        <div>
          <div class="settings-name">${s.name}</div>
          <div class="settings-range">${s.min} – ${s.max} ${s.unit}</div>
        </div>
      </div>
      <label class="settings-label">Warn above (${s.unit})</label>
      <input type="number" class="settings-input" id="th-${key}" min="${s.min}" max="${s.max}" value="${current}"/>
    </div>`;
  }).join('') + Object.keys(NON_CONFIGURABLE).map(key => {
    const s = NON_CONFIGURABLE[key];
    return `
    <div class="settings-card settings-card-disabled">
      <div class="settings-card-head">
        <span class="settings-icon">${s.icon}</span>
        <div>
          <div class="settings-name">${s.name}</div>
          <div class="settings-range">${s.min} – ${s.max} ${s.unit}</div>
        </div>
      </div>
      <p class="settings-note">No alert threshold configured for this sensor.</p>
    </div>`;
  }).join('');
}
renderSettings();

document.getElementById('settings-save')?.addEventListener('click', () => {
  const next = {};
  Object.keys(SENSOR_DEFAULTS).forEach(key => {
    const input = document.getElementById(`th-${key}`);
    const val = parseFloat(input.value);
    if(!isNaN(val)) next[key] = val;
  });
  localStorage.setItem('em_thresholds', JSON.stringify(next));
  showToast('✅ Thresholds saved — changes apply across the dashboard');
});

document.getElementById('settings-reset')?.addEventListener('click', () => {
  localStorage.removeItem('em_thresholds');
  renderSettings();
  showToast('↺ Thresholds reset to defaults');
});

let toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  if(!t) return;
  t.textContent = msg; t.style.display = 'block';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.style.display = 'none'; }, 4000);
}

function pageRefresh() { location.reload(); }

// Alert badge from persisted alert log
const alertN = JSON.parse(localStorage.getItem('em_alerts') || '[]').length;
['alert-count','notif-badge'].forEach(id => {
  const el = document.getElementById(id);
  if(el && alertN > 0) { el.textContent = alertN; el.style.display = ''; }
});

document.body.classList.remove('is-loading');
