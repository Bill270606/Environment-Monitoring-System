// ── THEME (chart-specific hook, called by shell.js) ──
function updateChartTheme(theme) {
  const grid = theme === 'light' ? '#e5e9f2' : '#1a2d4a60';
  const gridAlt = theme === 'light' ? '#e5e9f2a0' : '#1a2d4a40';
  if(chart) {
    chart.options.scales.x.grid.color = grid;
    chart.options.scales.y1.grid.color = gridAlt;
    chart.update();
  }
  if(focusChart) {
    focusChart.options.scales.x.grid.color = grid;
    focusChart.options.scales.y.grid.color = gridAlt;
    focusChart.update();
  }
}

// ── CONFIG ──
const ARC = 235.6;
const SENSORS = {
  temp: { min:0,   max:50,   warn:35,   color:'#ff6b35' },
  hum:  { min:0,   max:100,  warn:85,   color:'#00b4d8' },
  lux:  { min:0,   max:1000, warn:null, color:'#ffd60a' },
  uv:   { min:0,   max:3.3,  warn:null, color:'#ff006e' },
  soil: { min:0,   max:4095, warn:3000, color:'#8338ec', unit:'raw' },
  rain: { min:0,   max:4095, warn:null, color:'#06d6a0', unit:'raw' },
};

// Apply any custom thresholds saved from the Settings page
(function applyThresholdOverrides() {
  const saved = JSON.parse(localStorage.getItem('em_thresholds') || '{}');
  Object.keys(saved).forEach(key => {
    if(SENSORS[key] && typeof saved[key] === 'number') SENSORS[key].warn = saved[key];
  });
})();

const UI_META = {
  temp: { icon:'🌡️', name:'Temperature', unit:'°C'  },
  hum:  { icon:'💧',  name:'Humidity',    unit:'%'   },
  lux:  { icon:'☀️',  name:'Light',       unit:'lux' },
  uv:   { icon:'🔆',  name:'UV',          unit:'V'   },
  soil: { icon:'🌱',  name:'Soil Dryness',unit:'raw' },
  rain: { icon:'🌧️', name:'Rain',        unit:'raw' },
};

const lastValues = {};
const sensorHistory = { temp:[], hum:[], lux:[], uv:[], soil:[], rain:[] };
let currentFocusKey = null;
let focusChart = null;

// ── VIEW SWITCHING ──
function setView(view) {
  document.querySelectorAll('.vt-btn').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  const gridEl = document.getElementById('grid-view');
  const listEl = document.getElementById('list-view');
  if(gridEl) gridEl.style.display = view === 'list' ? 'none' : '';
  if(listEl) listEl.style.display = view === 'list' ? 'flex' : 'none';
  localStorage.setItem('em_view', view);
}

document.querySelectorAll('.vt-btn').forEach(btn => {
  btn.addEventListener('click', () => setView(btn.dataset.view));
});
setView(localStorage.getItem('em_view') || 'grid');

// ── LIST VIEW ROWS ──
function renderListView() {
  const body = document.getElementById('list-body');
  if(!body) return;
  body.innerHTML = Object.keys(SENSORS).map(key => {
    const meta = UI_META[key];
    return `
    <div class="list-row" id="lr-${key}" onclick="openFocus('${key}')">
      <span class="lr-name"><span class="lr-icon">${meta.icon}</span>${meta.name}</span>
      <span class="lr-value" id="lrv-${key}">-- ${meta.unit}</span>
      <span class="lr-badge" id="lrb-${key}">—</span>
      <span class="lr-arrow">›</span>
    </div>`;
  }).join('');
}
renderListView();

// ── FOCUS VIEW ──
function openFocus(key) {
  const meta = UI_META[key];
  const cfg = SENSORS[key];
  if(!meta || !cfg) return;
  currentFocusKey = key;

  document.getElementById('fm-icon').textContent = meta.icon;
  document.getElementById('fm-name').textContent = meta.name;
  document.getElementById('fm-sub').textContent = meta.unit;

  renderFocusValue();

  const hist = sensorHistory[key] || [];
  if(!focusChart) {
    focusChart = new Chart(document.getElementById('focus-chart').getContext('2d'), {
      type: 'line',
      data: { labels: [], datasets: [{ data: [], borderColor: cfg.color, backgroundColor: cfg.color + '30', borderWidth: 2, fill: true, tension: .4, pointRadius: 2 }] },
      options: {
        responsive: true, animation: { duration: 200 },
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: '#1a2d4a60' }, ticks: { color: '#4a6a8a', maxTicksLimit: 6, font: { size: 10 } }, border: { color: '#1a2d4a' } },
          y: { grid: { color: '#1a2d4a40' }, ticks: { color: '#4a6a8a', font: { size: 10 } }, border: { color: '#1a2d4a' } },
        }
      }
    });
  }
  focusChart.data.datasets[0].borderColor = cfg.color;
  focusChart.data.datasets[0].backgroundColor = cfg.color + '30';
  focusChart.data.labels = hist.map(h => h.t);
  focusChart.data.datasets[0].data = hist.map(h => h.v);
  focusChart.update();
  document.getElementById('focus-chart-empty')?.classList.toggle('show', hist.length === 0);

  document.getElementById('focus-modal').classList.add('open');
}

function renderFocusValue() {
  const key = currentFocusKey;
  if(!key) return;
  const meta = UI_META[key];
  const cfg = SENSORS[key];
  const val = lastValues[key];
  const valEl = document.getElementById('fm-value');
  const badgeEl = document.getElementById('fm-badge');
  if(val == null) {
    valEl.textContent = '--';
    badgeEl.textContent = '—';
    badgeEl.className = 'focus-badge';
    return;
  }
  valEl.innerHTML = `${val} <span style="font-size:1.1rem;color:var(--m)">${meta.unit}</span>`;
  const warn = cfg.warn !== null && val > cfg.warn;
  badgeEl.textContent = warn ? '⚠ High' : '✓ Normal';
  badgeEl.className = 'focus-badge ' + (warn ? 'warn' : 'ok');
}

function closeFocus() {
  document.getElementById('focus-modal').classList.remove('open');
  currentFocusKey = null;
}

document.addEventListener('keydown', e => {
  if(e.key === 'Escape' && document.getElementById('focus-modal').classList.contains('open')) closeFocus();
});

function pushHistory(d) {
  const map = { temp: d.temperature, hum: d.humidity, lux: d.lux, uv: d.uvVoltage, soil: d.soilAO, rain: d.rainAO };
  Object.keys(map).forEach(key => {
    const arr = sensorHistory[key];
    arr.push({ t: d.timestamp, v: map[key] });
    if(arr.length > 30) arr.shift();
  });
  if(currentFocusKey && focusChart) {
    const hist = sensorHistory[currentFocusKey];
    focusChart.data.labels = hist.map(h => h.t);
    focusChart.data.datasets[0].data = hist.map(h => h.v);
    focusChart.update('none');
    document.getElementById('focus-chart-empty')?.classList.toggle('show', hist.length === 0);
    renderFocusValue();
  }
}

// ── COMMAND PALETTE ──
function pulseHighlight(el) {
  if(!el) return;
  el.classList.remove('pulse-highlight');
  void el.offsetWidth; // restart animation
  el.classList.add('pulse-highlight');
  setTimeout(() => el.classList.remove('pulse-highlight'), 1000);
}

const CMD_ACTIONS = [
  { id:'theme',   icon:'🌗', label:'Toggle Dark / Light mode', hint:'D',
    run: () => { closeCmdk(); toggleTheme(); } },
  { id:'alerts',  icon:'⚠️', label:'View alert history', hint:'',
    run: () => { closeCmdk(); const el = document.querySelector('.alerts-card'); el?.scrollIntoView({behavior:'smooth', block:'center'}); pulseHighlight(el); } },
  { id:'refresh', icon:'🔄', label:'Refresh data', hint:'R',
    run: () => { closeCmdk(); fetchData(); } },
  { id:'grid',    icon:'⊞',  label:'Switch to Grid view', hint:'',
    run: () => { closeCmdk(); setView('grid'); } },
  { id:'list',    icon:'☰',  label:'Switch to List view', hint:'',
    run: () => { closeCmdk(); setView('list'); } },
];

function getCmdkSensorItems() {
  return Object.keys(SENSORS).map(key => ({
    id: 'sensor-' + key, icon: UI_META[key].icon, label: UI_META[key].name, hint: 'Sensor',
    run: () => {
      closeCmdk();
      const view = localStorage.getItem('em_view') || 'grid';
      const target = document.getElementById(view === 'list' ? `lr-${key}` : `card-${key}`);
      if(target) { target.scrollIntoView({behavior:'smooth', block:'center'}); pulseHighlight(target); }
    }
  }));
}

let cmdkItems = [];
let cmdkActiveIndex = 0;

function openCmdk() {
  document.getElementById('cmdk-overlay').classList.add('open');
  const input = document.getElementById('cmdk-input');
  input.value = '';
  renderCmdkResults('');
  setTimeout(() => input.focus(), 50);
}
function closeCmdk() {
  document.getElementById('cmdk-overlay').classList.remove('open');
}

function cmdkItemHtml(item) {
  return `<div class="cmdk-item"><span class="cmdk-item-icon">${item.icon}</span><span class="cmdk-item-label">${item.label}</span>${item.hint ? `<span class="cmdk-item-hint">${item.hint}</span>` : ''}</div>`;
}

function updateCmdkActive() {
  const els = document.querySelectorAll('#cmdk-results .cmdk-item');
  els.forEach((el, idx) => el.classList.toggle('active', idx === cmdkActiveIndex));
  els[cmdkActiveIndex]?.scrollIntoView({block:'nearest'});
}

function renderCmdkResults(query) {
  const q = query.trim().toLowerCase();
  const sensors = getCmdkSensorItems().filter(i => !q || i.label.toLowerCase().includes(q));
  const actions = CMD_ACTIONS.filter(i => !q || i.label.toLowerCase().includes(q));
  cmdkItems = [...sensors, ...actions];
  cmdkActiveIndex = 0;

  const results = document.getElementById('cmdk-results');
  if(cmdkItems.length === 0) {
    results.innerHTML = '<div class="cmdk-empty">No results found</div>';
    return;
  }
  let html = '';
  if(sensors.length) html += '<div class="cmdk-group-label">SENSORS</div>' + sensors.map(cmdkItemHtml).join('');
  if(actions.length)  html += '<div class="cmdk-group-label">ACTIONS</div>' + actions.map(cmdkItemHtml).join('');
  results.innerHTML = html;
  updateCmdkActive();
  results.querySelectorAll('.cmdk-item').forEach((el, idx) => {
    el.addEventListener('click', () => cmdkItems[idx].run());
    el.addEventListener('mouseenter', () => { cmdkActiveIndex = idx; updateCmdkActive(); });
  });
}

document.getElementById('cmdk-input').addEventListener('input', e => renderCmdkResults(e.target.value));
document.getElementById('cmdk-input').addEventListener('keydown', e => {
  if(e.key === 'ArrowDown') { e.preventDefault(); cmdkActiveIndex = Math.min(cmdkActiveIndex + 1, cmdkItems.length - 1); updateCmdkActive(); }
  else if(e.key === 'ArrowUp') { e.preventDefault(); cmdkActiveIndex = Math.max(cmdkActiveIndex - 1, 0); updateCmdkActive(); }
  else if(e.key === 'Enter') { e.preventDefault(); cmdkItems[cmdkActiveIndex]?.run(); }
});

document.getElementById('cmdk-trigger')?.addEventListener('click', openCmdk);

document.addEventListener('keydown', e => {
  const isMac = navigator.platform.toUpperCase().includes('MAC');
  if((isMac ? e.metaKey : e.ctrlKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    document.getElementById('cmdk-overlay').classList.contains('open') ? closeCmdk() : openCmdk();
  }
  if(e.key === 'Escape' && document.getElementById('cmdk-overlay').classList.contains('open')) closeCmdk();
});

// ── STATS ──
let readings = 0;
let alertCount = 0;
const startTime = Date.now();

function updateUptime() {
  const sec = Math.floor((Date.now() - startTime) / 1000);
  const h = String(Math.floor(sec/3600)).padStart(2,'0');
  const m = String(Math.floor((sec%3600)/60)).padStart(2,'0');
  const s = String(sec%60).padStart(2,'0');
  const el = document.getElementById('sc-uptime');
  if(el) el.textContent = `${h}:${m}:${s}`;
}
setInterval(updateUptime, 1000);

// ── GAUGE ──
function setGauge(key, value) {
  const cfg = SENSORS[key];
  const arc = document.getElementById(`g-${key}`);
  const val = document.getElementById(`v-${key}`);
  const badge = document.getElementById(`b-${key}`);
  const card = document.getElementById(`card-${key}`);
  if(!arc) return;

  const pct = Math.max(0, Math.min(1, (value - cfg.min) / (cfg.max - cfg.min)));
  arc.style.strokeDashoffset = ARC * (1 - pct);
  if(val) val.textContent = value;

  const warn = cfg.warn !== null && value > cfg.warn;
  if(badge) {
    badge.textContent = warn ? '⚠ High' : '✓ Normal';
    badge.className = 'gc-badge ' + (warn ? 'warn' : 'ok');
  }
  if(card) card.classList.toggle('warn', warn);

  lastValues[key] = value;
  updateListRow(key, value, warn);
  return warn;
}

function updateListRow(key, value, warn) {
  const meta = UI_META[key];
  const lrv = document.getElementById(`lrv-${key}`);
  const lrb = document.getElementById(`lrb-${key}`);
  if(lrv) lrv.textContent = `${value} ${meta.unit}`;
  if(lrb) {
    lrb.textContent = warn ? '⚠ High' : '✓ Normal';
    lrb.className = 'lr-badge ' + (warn ? 'warn' : 'ok');
  }
}

// ── BAR ──
function setBar(key, value) {
  const cfg = SENSORS[key];
  const bar = document.getElementById(`bf-${key}`);
  const val = document.getElementById(`v-${key}`);
  const badge = document.getElementById(`b-${key}`);
  const card = document.getElementById(`card-${key}`);
  if(!bar) return;

  const pct = Math.max(0, Math.min(100, (value-cfg.min)/(cfg.max-cfg.min)*100));
  bar.style.width = `${pct}%`;
  if(val) val.innerHTML = `${value} <span class="big-unit">${cfg.unit}</span>`;

  const warn = cfg.warn !== null && value > cfg.warn;
  if(badge) {
    badge.textContent = warn ? '⚠ High' : '✓ Normal';
    badge.className = 'gc-badge ' + (warn ? 'warn' : 'ok');
  }
  if(card) card.classList.toggle('warn', warn);

  lastValues[key] = value;
  updateListRow(key, value, warn);
  return warn;
}

// ── CHART ──
const chartCtx = document.getElementById('chart').getContext('2d');

function makeGrad(ctx, color) {
  const g = ctx.createLinearGradient(0, 0, 0, 280);
  g.addColorStop(0, color + '35');
  g.addColorStop(1, color + '05');
  return g;
}

const chart = new Chart(chartCtx, {
  type: 'line',
  data: {
    labels: [],
    datasets: [
      { label:'Temperature (°C)', data:[], yAxisID:'y1', borderColor:'#ff6b35', backgroundColor:makeGrad(chartCtx,'#ff6b35'), borderWidth:2, fill:true, tension:.4, pointRadius:2 },
      { label:'Humidity (%)',     data:[], yAxisID:'y1', borderColor:'#00b4d8', backgroundColor:makeGrad(chartCtx,'#00b4d8'), borderWidth:2, fill:false,tension:.4, pointRadius:2 },
      { label:'Light (lux)',      data:[], yAxisID:'y2', borderColor:'#ffd60a', backgroundColor:makeGrad(chartCtx,'#ffd60a'), borderWidth:2, fill:false,tension:.4, pointRadius:2 },
    ]
  },
  options: {
    responsive:true, animation:{duration:200},
    interaction:{mode:'index',intersect:false},
    scales:{
      x:{grid:{color:'#1a2d4a60'},ticks:{color:'#4a6a8a',maxTicksLimit:8,font:{size:10}},border:{color:'#1a2d4a'}},
      y1:{grid:{color:'#1a2d4a40'},ticks:{color:'#4a6a8a',font:{size:10}},border:{color:'#1a2d4a'}},
      y2:{position:'right',grid:{drawOnChartArea:false},ticks:{color:'#ffd60a',font:{size:10}},border:{color:'#1a2d4a'}},
    },
    plugins:{
      legend:{display:false},
      tooltip:{backgroundColor:'#0d1626',borderColor:'#1a2d4a',borderWidth:1,titleColor:'#e2eaf6',bodyColor:'#4a6a8a',padding:10},
    }
  }
});

function addChartPoint(d) {
  if(chart.data.labels.length >= 30) {
    chart.data.labels.shift();
    chart.data.datasets.forEach(ds => ds.data.shift());
  }
  chart.data.labels.push(d.timestamp);
  chart.data.datasets[0].data.push(d.temperature);
  chart.data.datasets[1].data.push(d.humidity);
  chart.data.datasets[2].data.push(d.lux);
  chart.update('none');
  updateChartEmptyState();
}

function updateChartEmptyState() {
  document.getElementById('chart-empty')?.classList.toggle('show', chart.data.labels.length === 0);
}
updateChartEmptyState();

// ── ALERTS LOG ──
const alertsLog = [];

function addAlert(msg) {
  const now = new Date().toLocaleTimeString('en-US');
  const entry = { msg, time: now, date: new Date().toLocaleDateString('en-US'), ts: Date.now() };
  alertsLog.unshift(entry);
  if(alertsLog.length > 20) alertsLog.pop();

  const persisted = JSON.parse(localStorage.getItem('em_alerts') || '[]');
  persisted.unshift(entry);
  localStorage.setItem('em_alerts', JSON.stringify(persisted.slice(0, 50)));

  alertCount++;
  const countEls = [
    document.getElementById('alert-count'),
    document.getElementById('notif-badge'),
    document.getElementById('sc-alerts'),
  ];
  countEls.forEach(el => { if(el) el.textContent = alertCount; });
  const badge = document.getElementById('notif-badge');
  if(badge) badge.style.display = 'block';

  renderAlerts();
  showToast('⚠ ' + msg);
}

function renderAlerts() {
  const list = document.getElementById('alerts-list');
  if(!list) return;
  if(alertsLog.length === 0) {
    list.innerHTML = '<div class="no-alerts">✅ No alerts</div>';
    return;
  }
  list.innerHTML = alertsLog.slice(0,10).map(a => `
    <div class="alert-item">
      <span class="alert-icon">⚠️</span>
      <div class="alert-info">
        <div class="alert-msg">${a.msg}</div>
        <div class="alert-time">${a.time}</div>
      </div>
    </div>`).join('');
}

// ── TOAST ──
let toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  if(!t) return;
  t.textContent = msg; t.style.display = 'block';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.style.display = 'none'; }, 4000);
}

// ── CONNECTION ERROR STATE ──
let consecutiveFailures = 0;

function showConnectionError() {
  document.getElementById('content-error')?.classList.add('show');
}
function hideConnectionError() {
  document.getElementById('content-error')?.classList.remove('show');
}

document.getElementById('ce-retry')?.addEventListener('click', async () => {
  const btn = document.getElementById('ce-retry');
  btn.disabled = true;
  btn.textContent = '🔄 Retrying...';
  await fetchData();
  btn.disabled = false;
  btn.textContent = '🔄 Retry';
});

// ── FARMER-FRIENDLY GARDEN STATUS ──
const FARMER_THRESHOLDS = { tempLow: 18, humLow: 30, luxLow: 200 };

function setFarmerBlock(key, value, label, status) {
  const valEl = document.getElementById(`fb-${key}-value`);
  const statusEl = document.getElementById(`fb-${key}-status`);
  if(valEl) valEl.textContent = value;
  if(statusEl) {
    statusEl.textContent = `Status: ${label}`;
    statusEl.className = 'fb-status ' + status;
  }
}

function renderFarmerAlerts(alerts) {
  const list = document.getElementById('fb-alerts-list');
  if(!list) return;
  if(alerts.length === 0) {
    list.innerHTML = '<div class="fb-ok">✅ No alerts right now</div>';
    return;
  }
  list.innerHTML = alerts.map(a => `
    <div class="fb-alert-item ${a.level}">
      <span class="fb-alert-icon">${a.icon}</span>
      <span class="fb-alert-text">${a.text}</span>
    </div>`).join('');
}

function updateFarmerView(d) {
  const tempWarn = SENSORS.temp.warn ?? 35;
  const humWarn  = SENSORS.hum.warn  ?? 85;
  const soilWarn = SENSORS.soil.warn ?? 3000;
  const { tempLow, humLow, luxLow } = FARMER_THRESHOLDS;

  let tempStatus = 'ok', tempLabel = 'Good';
  if(d.temperature > tempWarn)      { tempStatus = 'danger'; tempLabel = 'High'; }
  else if(d.temperature < tempLow)  { tempStatus = 'warn';   tempLabel = 'Low'; }

  let humStatus = 'ok', humLabel = 'Good';
  if(d.humidity > humWarn)      { humStatus = 'warn'; humLabel = 'High'; }
  else if(d.humidity < humLow)  { humStatus = 'warn'; humLabel = 'Low'; }

  let luxStatus = 'ok', luxLabel = 'Good';
  if(d.lux < luxLow) { luxStatus = 'warn'; luxLabel = 'Low light'; }

  // Top summary readouts
  const gsTemp = document.getElementById('gs-temp');
  const gsHum  = document.getElementById('gs-hum');
  const gsLux  = document.getElementById('gs-lux');
  if(gsTemp) gsTemp.textContent = `${d.temperature} °C`;
  if(gsHum)  gsHum.textContent  = `${d.humidity} %`;
  if(gsLux)  gsLux.textContent  = luxLabel;

  // 4 big blocks
  setFarmerBlock('temp', `${d.temperature} °C`, tempLabel, tempStatus);
  setFarmerBlock('hum',  `${d.humidity} %`,     humLabel,  humStatus);
  setFarmerBlock('lux',  `${d.lux} lux`,        luxLabel,  luxStatus);

  // Plain-language alerts
  const alerts = [];
  if(tempStatus === 'danger') alerts.push({ level:'danger', icon:'🔴', text:`Temperature is too high (${d.temperature}°C). Water the plants or provide some shade.` });
  else if(tempStatus === 'warn') alerts.push({ level:'warn', icon:'🟠', text:`Temperature is low (${d.temperature}°C). Plants may grow slower — shield them from cold wind.` });

  if(humLabel === 'Low') alerts.push({ level:'warn', icon:'🟠', text:`Air humidity is low (${d.humidity}%). Consider misting the plants or raising humidity.` });
  else if(humLabel === 'High') alerts.push({ level:'warn', icon:'🟠', text:`Air humidity is high (${d.humidity}%). Plants are at risk of fungal disease — improve ventilation.` });

  if(luxStatus === 'warn') alerts.push({ level:'info', icon:'🟡', text:'Light level is low. Plants may not get enough light to grow well — check their placement.' });

  if(d.soilAO > soilWarn) alerts.push({ level:'warn', icon:'🟠', text:'Soil is dry. Plants may be short on water — check the irrigation system.' });

  renderFarmerAlerts(alerts);

  // Overall badge
  const badge = document.getElementById('gs-badge');
  if(badge) {
    if(alerts.some(a => a.level === 'danger')) { badge.textContent = '🔴 Critical alert';   badge.className = 'gs-badge danger'; }
    else if(alerts.length > 0)                 { badge.textContent = '🟠 Needs attention';   badge.className = 'gs-badge warn'; }
    else                                        { badge.textContent = '🟢 Good conditions';  badge.className = 'gs-badge ok'; }
  }
}

function renderThresholdLegend() {
  const rows = document.getElementById('legend-rows');
  if(!rows) return;
  const t = FARMER_THRESHOLDS;
  const tempWarn = SENSORS.temp.warn ?? 35;
  const humWarn  = SENSORS.hum.warn  ?? 85;
  const soilWarn = SENSORS.soil.warn ?? 3000;

  rows.innerHTML = `
    <div class="legend-row">
      <span class="legend-sensor">🌡️ Temperature</span>
      <span class="legend-chip ok">${t.tempLow}–${tempWarn}°C: Good</span>
      <span class="legend-chip warn">Below ${t.tempLow}°C: Low</span>
      <span class="legend-chip danger">Above ${tempWarn}°C: High</span>
    </div>
    <div class="legend-row">
      <span class="legend-sensor">💧 Humidity</span>
      <span class="legend-chip ok">${t.humLow}–${humWarn}%: Good</span>
      <span class="legend-chip warn">Below ${t.humLow}%: Low</span>
      <span class="legend-chip warn">Above ${humWarn}%: High</span>
    </div>
    <div class="legend-row">
      <span class="legend-sensor">☀️ Light</span>
      <span class="legend-chip ok">${t.luxLow}+ lux: Good</span>
      <span class="legend-chip warn">Below ${t.luxLow} lux: Low</span>
    </div>
    <div class="legend-row">
      <span class="legend-sensor">🌱 Soil</span>
      <span class="legend-chip ok">0–${soilWarn} (raw): Good</span>
      <span class="legend-chip warn">Above ${soilWarn} (raw): Dry, needs attention</span>
    </div>
  `;
}
renderThresholdLegend();

// ── MAIN UPDATE ──
const prevAlerts = {};

async function fetchData() {
  try {
    const res  = await fetch('/data/latest');
    const d    = await res.json();
    document.body.classList.remove('is-loading');
    consecutiveFailures = 0;
    hideConnectionError();

    // Time / date
    const tsEl   = document.getElementById('time-display');
    const dateEl = document.getElementById('date-display');
    if(tsEl)   tsEl.textContent   = d.timestamp;
    if(dateEl) dateEl.textContent = d.date;

    // Connection status
    const conn = document.getElementById('conn-status');
    if(conn) { conn.classList.add('online'); conn.querySelector('span').style.display = 'inline-block'; conn.innerHTML = '<span class="conn-dot"></span>Connected'; }

    // Readings counter
    readings++;
    const rEl = document.getElementById('sc-readings');
    if(rEl) rEl.textContent = readings;

    // Gauges
    const wTemp = setGauge('temp', d.temperature);
    const wHum  = setGauge('hum',  d.humidity);
                  setGauge('lux',  d.lux);
                  setGauge('uv',   d.uvVoltage);
    const wSoil = setBar('soil', d.soilAO);
                  setBar('rain', d.rainAO);

    // Alert log (only on new warnings)
    const warns = [
      [wTemp, `High temperature: ${d.temperature}°C`],
      [wHum,  `High humidity: ${d.humidity}%`],
      [wSoil, `Soil very dry: ${d.soilAO} raw`],
    ];
    warns.forEach(([isWarn, msg]) => {
      const key = msg.split(':')[0];
      if(isWarn && !prevAlerts[key]) addAlert(msg);
      prevAlerts[key] = isWarn;
    });

    // Stat card
    const alertNow = warns.filter(([w]) => w).length;
    const scAlert = document.getElementById('sc-alerts');
    if(scAlert) scAlert.textContent = alertNow;

    // Chart
    addChartPoint(d);
    pushHistory(d);

    // Farmer-friendly summary
    updateFarmerView(d);

  } catch(e) {
    document.body.classList.remove('is-loading');
    const conn = document.getElementById('conn-status');
    if(conn) { conn.classList.remove('online'); conn.innerHTML = '<span class="conn-dot"></span>Disconnected'; }
    consecutiveFailures++;
    if(consecutiveFailures >= 2) showConnectionError();
  }
}

fetchData();
setInterval(fetchData, 2000);

const pageRefresh = fetchData;
updateChartTheme(document.body.dataset.theme || 'dark');
