const CHART_SENSORS = {
  temp: { icon:'🌡️', name:'Temperature',  unit:'°C',  color:'#ff6b35', field:'temperature' },
  hum:  { icon:'💧',  name:'Humidity',     unit:'%',   color:'#00b4d8', field:'humidity' },
  lux:  { icon:'☀️',  name:'Light',        unit:'lux', color:'#ffd60a', field:'lux' },
  uv:   { icon:'🔆',  name:'UV',           unit:'V',   color:'#ff006e', field:'uvVoltage' },
  soil: { icon:'🌱',  name:'Soil Dryness', unit:'raw', color:'#8338ec', field:'soilAO' },
  rain: { icon:'🌧️', name:'Rain',         unit:'raw', color:'#06d6a0', field:'rainAO' },
};

const charts = {};

function renderChartCards() {
  const grid = document.getElementById('charts-grid');
  grid.innerHTML = Object.keys(CHART_SENSORS).map(key => {
    const s = CHART_SENSORS[key];
    return `
    <div class="card mini-chart-card">
      <div class="card-header">
        <div>
          <h3 class="card-title">${s.icon} ${s.name}</h3>
          <p class="card-desc">${s.unit}</p>
        </div>
      </div>
      <div class="chart-wrap mini-chart-wrap">
        <canvas id="mc-${key}" height="160"></canvas>
        <div class="skeleton-overlay"></div>
        <div class="chart-empty" id="mc-empty-${key}">
          <div class="ce2-icon">📈</div>
          <p>No historical data yet.</p>
        </div>
      </div>
    </div>`;
  }).join('');
}
renderChartCards();

function makeGrad(ctx, color) {
  const g = ctx.createLinearGradient(0, 0, 0, 160);
  g.addColorStop(0, color + '35');
  g.addColorStop(1, color + '05');
  return g;
}

function createCharts() {
  Object.keys(CHART_SENSORS).forEach(key => {
    const s = CHART_SENSORS[key];
    const ctx = document.getElementById(`mc-${key}`).getContext('2d');
    charts[key] = new Chart(ctx, {
      type: 'line',
      data: { labels: [], datasets: [{ data: [], borderColor: s.color, backgroundColor: makeGrad(ctx, s.color), borderWidth: 2, fill: true, tension: .4, pointRadius: 0 }] },
      options: {
        responsive: true, maintainAspectRatio: false, animation: { duration: 200 },
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: '#1a2d4a60' }, ticks: { color: '#4a6a8a', maxTicksLimit: 5, font: { size: 9 } }, border: { color: '#1a2d4a' } },
          y: { grid: { color: '#1a2d4a40' }, ticks: { color: '#4a6a8a', font: { size: 9 } }, border: { color: '#1a2d4a' } },
        }
      }
    });
  });
}
createCharts();
function updateChartTheme(theme) {
  const grid = theme === 'light' ? '#e5e9f2' : '#1a2d4a60';
  const gridAlt = theme === 'light' ? '#e5e9f2a0' : '#1a2d4a40';
  Object.values(charts).forEach(c => {
    c.options.scales.x.grid.color = grid;
    c.options.scales.y.grid.color = gridAlt;
    c.update();
  });
}

function setChartData(key, points) {
  const chart = charts[key];
  chart.data.labels = points.map(p => p.timestamp);
  chart.data.datasets[0].data = points.map(p => p[CHART_SENSORS[key].field]);
  chart.update('none');
  document.getElementById(`mc-empty-${key}`)?.classList.toggle('show', points.length === 0);
}

function appendPoint(d) {
  Object.keys(CHART_SENSORS).forEach(key => {
    const chart = charts[key];
    if(chart.data.labels.length >= 50) {
      chart.data.labels.shift();
      chart.data.datasets[0].data.shift();
    }
    chart.data.labels.push(d.timestamp);
    chart.data.datasets[0].data.push(d[CHART_SENSORS[key].field]);
    chart.update('none');
    document.getElementById(`mc-empty-${key}`)?.classList.toggle('show', chart.data.labels.length === 0);
  });
}

async function loadHistory() {
  try {
    const res = await fetch('/data/history');
    const points = await res.json();
    Object.keys(CHART_SENSORS).forEach(key => setChartData(key, points));
  } catch(e) { /* fall back to live polling only */ }
}

async function fetchLatest() {
  try {
    const res = await fetch('/data/latest');
    const d = await res.json();
    document.body.classList.remove('is-loading');
    appendPoint(d);
  } catch(e) {
    document.body.classList.remove('is-loading');
  }
}

function pageRefresh() { loadHistory(); fetchLatest(); }

loadHistory().then(() => {
  fetchLatest();
  setInterval(fetchLatest, 2000);
});

updateChartTheme(document.body.dataset.theme || 'dark');

const alertN = JSON.parse(localStorage.getItem('em_alerts') || '[]').length;
['alert-count','notif-badge'].forEach(id => {
  const el = document.getElementById(id);
  if(el && alertN > 0) { el.textContent = alertN; el.style.display = ''; }
});
