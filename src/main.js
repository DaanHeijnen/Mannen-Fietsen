const ZONES = [
  { id: 'groningen', name: 'Groningen', short: 'Groningen', lat: 53.2194, lon: 6.5665, zoom: 9 },
  { id: 'wadden', name: 'Wadden coast', short: 'Wadden', lat: 53.384, lon: 6.23, zoom: 9 },
  { id: 'friesland', name: 'Friesland inland', short: 'Friesland', lat: 53.2012, lon: 5.7999, zoom: 9 },
  { id: 'drenthe', name: 'Drenthe', short: 'Drenthe', lat: 52.9928, lon: 6.5642, zoom: 9 },
  { id: 'denhelder', name: 'Kop van Noord-Holland', short: 'Kop NH', lat: 52.9563, lon: 4.7608, zoom: 9 },
  { id: 'flevoland', name: 'Flevoland / IJsselmeer', short: 'Flevoland', lat: 52.5185, lon: 5.4714, zoom: 9 },
  { id: 'overijssel', name: 'North Overijssel', short: 'N-Overijssel', lat: 52.5168, lon: 6.083, zoom: 9 }
];

const WINDOWS = {
  day: { label: 'Full day', start: 8, end: 20 },
  morning: { label: 'Morning', start: 7, end: 12 },
  afternoon: { label: 'Afternoon', start: 12, end: 18 },
  evening: { label: 'Evening', start: 18, end: 22 }
};

const API_VARIABLES = [
  'temperature_2m',
  'precipitation_probability',
  'precipitation',
  'rain',
  'showers',
  'cloud_cover',
  'wind_speed_10m',
  'wind_direction_10m',
  'wind_gusts_10m',
  'weather_code'
].join(',');

const app = document.querySelector('#app');
app.innerHTML = `
  <div id="map" class="map"></div>
  <div class="topbar">
    <div class="brand">
      <div class="logo">🚴</div>
      <div><h1>CycleCast Noord</h1><p>Wind + rain planner</p></div>
    </div>
    <div class="searchbox">
      <input id="searchInput" placeholder="Search a place, e.g. Groningen, Assen, Leeuwarden" />
      <button id="searchBtn">Search</button>
    </div>
    <div id="chipbar" class="chipbar"></div>
  </div>
  <div id="status" class="status"></div>
  <section class="sidepanel">
    <article class="card hero">
      <div class="hero-head">
        <div>
          <div class="eyebrow">Best cycling window</div>
          <h2 id="heroTitle">Loading...</h2>
          <div id="heroSub" class="sub">Fetching Open-Meteo forecast for northern Netherlands.</div>
        </div>
        <div id="scoreBubble" class="scorebubble" style="--score: 0"><span>--</span></div>
      </div>
      <div class="metrics">
        <div class="metric"><label>Rain risk</label><strong id="mRain">--</strong></div>
        <div class="metric"><label>Wind</label><strong id="mWind">--</strong></div>
        <div class="metric"><label>Gusts</label><strong id="mGust">--</strong></div>
        <div class="metric"><label>Confidence</label><strong id="mConfidence">--</strong></div>
      </div>
      <div id="routeTip" class="route-tip">Tip appears after forecast data loads.</div>
    </article>
    <article class="card controls">
      <div class="selectrow"><label>Area</label><select id="zoneSelect"></select></div>
      <div class="selectrow"><label>Ride window</label><select id="windowSelect"></select></div>
    </article>
    <article id="windows" class="card windows"></article>
  </section>
  <section class="bottompanel">
    <article class="card detail">
      <h3 id="detailTitle">Selected forecast</h3>
      <div class="detail-grid">
        <div class="pill"><span>Score</span><strong id="dScore">--</strong></div>
        <div class="pill"><span>Rain</span><strong id="dRain">--</strong></div>
        <div class="pill"><span>Wind</span><strong id="dWind">--</strong></div>
        <div class="pill"><span>Direction</span><strong id="dDir">--</strong></div>
      </div>
    </article>
    <article class="card legend">
      <h3>How to read it</h3>
      <div class="legend-items">
        <div class="legend-line"><i class="dot"></i> Good: dry, calm enough, high usable confidence</div>
        <div class="legend-line"><i class="dot maybe"></i> Maybe: some rain or wind risk</div>
        <div class="legend-line"><i class="dot bad"></i> Bad: wet, gusty or too uncertain</div>
        <div class="legend-line"><i class="dot rain"></i> Blue cells mean higher rain pressure</div>
        <div class="legend-line"><i class="dot wind"></i> Particles show wind flow direction and speed</div>
      </div>
    </article>
  </section>
`;

let map, markerLayer, heatLayer, selectedZone = ZONES[0], selectedWindow = 'day', selectedDayIndex = 0;
let forecast = null;
let particles = [];
let animationFrame = null;

const els = {
  chipbar: document.querySelector('#chipbar'),
  zoneSelect: document.querySelector('#zoneSelect'),
  windowSelect: document.querySelector('#windowSelect'),
  windows: document.querySelector('#windows'),
  status: document.querySelector('#status'),
  heroTitle: document.querySelector('#heroTitle'),
  heroSub: document.querySelector('#heroSub'),
  scoreBubble: document.querySelector('#scoreBubble'),
  mRain: document.querySelector('#mRain'),
  mWind: document.querySelector('#mWind'),
  mGust: document.querySelector('#mGust'),
  mConfidence: document.querySelector('#mConfidence'),
  routeTip: document.querySelector('#routeTip'),
  dScore: document.querySelector('#dScore'),
  dRain: document.querySelector('#dRain'),
  dWind: document.querySelector('#dWind'),
  dDir: document.querySelector('#dDir'),
  detailTitle: document.querySelector('#detailTitle'),
  searchInput: document.querySelector('#searchInput'),
  searchBtn: document.querySelector('#searchBtn'),
  canvas: null
};

function init() {
  initControls();
  initMap();
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  loadForecast(selectedZone);
}

function initControls() {
  els.chipbar.innerHTML = ZONES.map(z => `<button class="chip ${z.id === selectedZone.id ? 'active' : ''}" data-zone="${z.id}">${z.short}</button>`).join('');
  els.zoneSelect.innerHTML = ZONES.map(z => `<option value="${z.id}">${z.name}</option>`).join('');
  els.windowSelect.innerHTML = Object.entries(WINDOWS).map(([id, w]) => `<option value="${id}">${w.label}</option>`).join('');
  els.chipbar.addEventListener('click', e => {
    const btn = e.target.closest('[data-zone]');
    if (btn) setZone(btn.dataset.zone);
  });
  els.zoneSelect.addEventListener('change', e => setZone(e.target.value));
  els.windowSelect.addEventListener('change', e => {
    selectedWindow = e.target.value;
    selectedDayIndex = 0;
    renderAll();
  });
  els.searchBtn.addEventListener('click', searchPlace);
  els.searchInput.addEventListener('keydown', e => { if (e.key === 'Enter') searchPlace(); });
}

function initMap() {
  map = L.map('map', {
    zoomControl: false,
    minZoom: 7,
    maxZoom: 13,
    preferCanvas: true,
    worldCopyJump: false
  }).setView([53.13, 5.65], 8);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    subdomains: 'abcd',
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO | Weather data by Open-Meteo',
    crossOrigin: true,
    updateWhenIdle: false,
    updateWhenZooming: false,
    keepBuffer: 4
  }).addTo(map);

  L.control.zoom({ position: 'bottomright' }).addTo(map);
  markerLayer = L.layerGroup().addTo(map);
  heatLayer = L.layerGroup().addTo(map);

  // Keep the wind animation attached to the map container itself.
  // This fixes the bug where the canvas sits outside Leaflet and the map tiles render in broken blocks.
  els.canvas = document.createElement('canvas');
  els.canvas.id = 'windCanvas';
  els.canvas.className = 'wind-canvas';
  map.getContainer().appendChild(els.canvas);

  renderMarkers();

  map.on('moveend zoomend resize', () => {
    resizeCanvas();
    drawWeatherOverlay();
  });

  // Leaflet sometimes calculates a wrong initial size when the UI is injected dynamically.
  // Force a recalculation after the browser has painted the page.
  requestAnimationFrame(() => {
    map.invalidateSize(true);
    resizeCanvas();
    drawWeatherOverlay();
  });
  setTimeout(() => {
    map.invalidateSize(true);
    resizeCanvas();
    drawWeatherOverlay();
  }, 250);
}

function renderMarkers() {
  markerLayer.clearLayers();
  ZONES.forEach(z => {
    const icon = L.divIcon({ className: '', html: '<div class="zone-marker"></div>', iconSize: [16, 16], iconAnchor: [8, 8] });
    L.marker([z.lat, z.lon], { icon }).addTo(markerLayer).bindTooltip(z.short, { permanent: false }).on('click', () => setZone(z.id));
  });
}

async function setZone(id) {
  selectedZone = ZONES.find(z => z.id === id) || ZONES[0];
  selectedDayIndex = 0;
  els.zoneSelect.value = selectedZone.id;
  [...els.chipbar.querySelectorAll('.chip')].forEach(b => b.classList.toggle('active', b.dataset.zone === selectedZone.id));
  map.setView([selectedZone.lat, selectedZone.lon], selectedZone.zoom);
  await loadForecast(selectedZone);
}

async function searchPlace() {
  const q = els.searchInput.value.trim();
  if (!q) return;
  showStatus('Searching location...');
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1&language=en&format=json`;
    const data = await fetchJson(url);
    if (!data.results?.length) return showStatus('No location found. Try Groningen, Leeuwarden or Assen.', true);
    const p = data.results[0];
    selectedZone = { id: 'custom', name: `${p.name}${p.admin1 ? ', ' + p.admin1 : ''}`, short: p.name, lat: p.latitude, lon: p.longitude, zoom: 10 };
    els.zoneSelect.value = ZONES[0].id;
    [...els.chipbar.querySelectorAll('.chip')].forEach(b => b.classList.remove('active'));
    map.setView([selectedZone.lat, selectedZone.lon], 10);
    await loadForecast(selectedZone);
  } catch (err) {
    console.error(err);
    showStatus('Could not search right now. Check your internet connection.', true);
  }
}

async function loadForecast(zone) {
  showStatus(`Loading forecast for ${zone.name}...`);
  stopWind();
  try {
    const data = await getForecast(zone.lat, zone.lon);
    forecast = transformForecast(data, zone);
    showStatus(`Forecast loaded for ${zone.name}.`);
    setTimeout(hideStatus, 1400);
    renderAll();
    initWindParticles();
    animateWind();
  } catch (err) {
    console.error(err);
    showStatus('Open-Meteo forecast could not be loaded. The app is running, but weather data failed. Try refreshing.', true);
    renderError();
  }
}

async function getForecast(lat, lon) {
  const key = `forecast:${lat.toFixed(3)}:${lon.toFixed(3)}`;
  const cached = readCache(key, 1000 * 60 * 20);
  if (cached) return cached;
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', lat);
  url.searchParams.set('longitude', lon);
  url.searchParams.set('hourly', API_VARIABLES);
  url.searchParams.set('daily', 'sunrise,sunset,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max');
  url.searchParams.set('forecast_days', '10');
  url.searchParams.set('timezone', 'Europe/Amsterdam');
  url.searchParams.set('wind_speed_unit', 'kmh');
  url.searchParams.set('precipitation_unit', 'mm');
  const data = await fetchJson(url.toString());
  writeCache(key, data);
  return data;
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

function transformForecast(data, zone) {
  const h = data.hourly;
  const rows = h.time.map((time, i) => ({
    time: new Date(time),
    iso: time,
    temp: n(h.temperature_2m?.[i]),
    rainProb: n(h.precipitation_probability?.[i]),
    precip: n(h.precipitation?.[i]),
    rain: n(h.rain?.[i]) + n(h.showers?.[i]),
    clouds: n(h.cloud_cover?.[i]),
    wind: n(h.wind_speed_10m?.[i]),
    dir: n(h.wind_direction_10m?.[i]),
    gust: n(h.wind_gusts_10m?.[i]),
    code: h.weather_code?.[i] ?? 0
  }));
  const byDay = groupByDay(rows).map((items, dayIndex) => summarizeDay(items, dayIndex));
  return { zone, raw: data, hours: rows, days: byDay };
}

function groupByDay(rows) {
  const groups = new Map();
  rows.forEach(r => {
    const key = r.iso.slice(0, 10);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  });
  return [...groups.values()];
}

function summarizeDay(items, dayIndex) {
  const key = items[0].iso.slice(0, 10);
  const windows = {};
  Object.entries(WINDOWS).forEach(([id, w]) => {
    const part = items.filter(r => r.time.getHours() >= w.start && r.time.getHours() < w.end);
    windows[id] = summarizeWindow(part.length ? part : items, dayIndex, id);
  });
  return { key, date: items[0].time, items, windows };
}

function summarizeWindow(items, dayIndex, id) {
  const rainProb = Math.max(...items.map(i => i.rainProb));
  const rainAmount = sum(items.map(i => Math.max(i.precip, i.rain))) / Math.max(items.length, 1);
  const wind = avg(items.map(i => i.wind));
  const gust = Math.max(...items.map(i => i.gust));
  const dir = circularMean(items.map(i => i.dir), items.map(i => Math.max(1, i.wind)));
  const temp = avg(items.map(i => i.temp));
  const clouds = avg(items.map(i => i.clouds));
  const score = cyclingScore({ rainProb, rainAmount, wind, gust, dayIndex });
  const confidence = confidenceScore({ rainProb, rainAmount, wind, gust, dayIndex, items });
  const grade = score >= 74 ? 'good' : score >= 48 ? 'maybe' : 'bad';
  return { id, rainProb, rainAmount, wind, gust, dir, temp, clouds, score, confidence, grade };
}

function cyclingScore({ rainProb, rainAmount, wind, gust, dayIndex }) {
  let score = 100;
  score -= Math.max(0, rainProb - 12) * 0.75;
  score -= Math.min(45, rainAmount * 34);
  score -= Math.max(0, wind - 18) * 1.45;
  score -= Math.max(0, gust - 32) * 0.85;
  score -= Math.max(0, dayIndex - 4) * 3.3;
  return clamp(Math.round(score), 0, 100);
}

function confidenceScore({ rainProb, rainAmount, wind, gust, dayIndex, items }) {
  const rainVolatility = stdev(items.map(i => i.rainProb)) / 2.4;
  const windVolatility = stdev(items.map(i => i.wind)) * 1.4;
  const horizonPenalty = dayIndex * 5.5;
  const edgePenalty = rainProb > 30 && rainProb < 65 ? 10 : 0;
  const gustPenalty = gust > 45 ? 8 : 0;
  const amountPenalty = rainAmount > 0.7 ? 8 : 0;
  return clamp(Math.round(94 - horizonPenalty - rainVolatility - windVolatility - edgePenalty - gustPenalty - amountPenalty), 24, 96);
}

function renderAll() {
  if (!forecast) return;
  renderHero();
  renderWindows();
  renderDetail();
  drawWeatherOverlay();
}

function renderHero() {
  const best = getBestWindow();
  els.heroTitle.textContent = `${dayLabel(best.day.date)} ${WINDOWS[best.summary.id].label.toLowerCase()}`;
  els.heroSub.textContent = `${forecast.zone.name}: ${adviceText(best.summary)}.`;
  els.scoreBubble.style.setProperty('--score', best.summary.score);
  els.scoreBubble.querySelector('span').textContent = best.summary.score;
  els.mRain.textContent = `${Math.round(best.summary.rainProb)}% / ${best.summary.rainAmount.toFixed(1)} mm/h`;
  els.mWind.textContent = `${Math.round(best.summary.wind)} km/h`;
  els.mGust.textContent = `${Math.round(best.summary.gust)} km/h`;
  els.mConfidence.textContent = `${best.summary.confidence}%`;
  els.routeTip.textContent = routeTip(best.summary.dir, best.summary.wind, best.summary.gust);
}

function renderWindows() {
  els.windows.innerHTML = forecast.days.map((day, idx) => {
    const s = day.windows[selectedWindow];
    const cl = s.grade === 'good' ? '' : s.grade;
    return `<div class="window-row ${idx === selectedDayIndex ? 'selected' : ''}" data-day="${idx}">
      <div><div class="day">${dayLabel(day.date)}</div><div class="date">${dateShort(day.date)}</div></div>
      <div>
        <div class="row-title"><span>${adviceText(s)}</span><span>${Math.round(s.confidence)}% confidence</span></div>
        <div class="bar"><div class="fill ${cl}" style="width:${s.score}%"></div></div>
      </div>
      <div class="grade ${cl}">${s.grade.toUpperCase()}</div>
    </div>`;
  }).join('');
  els.windows.querySelectorAll('[data-day]').forEach(row => row.addEventListener('click', () => {
    selectedDayIndex = Number(row.dataset.day);
    renderAll();
  }));
}

function renderDetail() {
  const day = forecast.days[selectedDayIndex];
  const s = day.windows[selectedWindow];
  els.detailTitle.textContent = `${dateLong(day.date)} · ${WINDOWS[selectedWindow].label} · ${forecast.zone.name}`;
  els.dScore.textContent = `${s.score}/100 ${s.grade}`;
  els.dRain.textContent = `${Math.round(s.rainProb)}%, ${s.rainAmount.toFixed(1)} mm/h`;
  els.dWind.textContent = `${Math.round(s.wind)} km/h, gusts ${Math.round(s.gust)}`;
  els.dDir.textContent = `${compass(s.dir)} (${Math.round(s.dir)}°)`;
}

function renderError() {
  els.heroTitle.textContent = 'Weather unavailable';
  els.heroSub.textContent = 'The app loaded, but the free weather API did not respond. Refresh or try later.';
}

function getBestWindow() {
  let best = null;
  forecast.days.forEach(day => {
    Object.values(day.windows).forEach(summary => {
      if (!best || summary.score + summary.confidence * 0.12 > best.summary.score + best.summary.confidence * 0.12) best = { day, summary };
    });
  });
  return best;
}

function adviceText(s) {
  if (s.grade === 'good') return 'Good ride window';
  if (s.rainProb > 55 || s.rainAmount > 1) return 'Rain risk is high';
  if (s.gust > 55) return 'Gusts are too strong';
  if (s.wind > 34) return 'Wind will be hard work';
  if (s.confidence < 50) return 'Forecast is uncertain';
  return 'Possible, but check again later';
}

function routeTip(dir, wind, gust) {
  const from = compass(dir);
  const to = compass((dir + 180) % 360);
  if (wind < 16 && gust < 30) return `Light ${from} wind. Any route direction should feel comfortable.`;
  if (gust > 50) return `Strong gusts from ${from}. Pick a sheltered route or postpone if you want a relaxed ride.`;
  return `Wind comes from ${from}. For an easier return, start riding toward ${from} and come back with more tailwind toward ${to}.`;
}

function drawWeatherOverlay() {
  if (!map || !forecast) return;
  heatLayer.clearLayers();
  const s = forecast.days[selectedDayIndex]?.windows[selectedWindow];
  if (!s) return;
  const radius = Math.max(9000, 26000 - map.getZoom() * 1700);
  const rainAlpha = clamp(s.rainProb / 100, 0.08, 0.62);
  const windAlpha = clamp(s.wind / 55, 0.08, 0.55);
  const color = s.grade === 'good' ? '#35d07f' : s.grade === 'maybe' ? '#ffd45d' : '#ff6b6b';
  L.circle([forecast.zone.lat, forecast.zone.lon], { radius: radius * 1.45, color, fillColor: color, fillOpacity: 0.13, weight: 1.5, opacity: 0.75 }).addTo(heatLayer);
  L.circle([forecast.zone.lat, forecast.zone.lon], { radius: radius, color: '#4bb3fd', fillColor: '#4bb3fd', fillOpacity: rainAlpha * 0.18, weight: 0, opacity: 0 }).addTo(heatLayer);
  L.circle([forecast.zone.lat, forecast.zone.lon], { radius: radius * 0.6, color: '#b77cff', fillColor: '#b77cff', fillOpacity: windAlpha * 0.18, weight: 0, opacity: 0 }).addTo(heatLayer);
}

function resizeCanvas() {
  if (!els.canvas || !map) return;
  const rect = map.getContainer().getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  els.canvas.style.width = `${rect.width}px`;
  els.canvas.style.height = `${rect.height}px`;
  els.canvas.width = Math.max(1, Math.floor(rect.width * ratio));
  els.canvas.height = Math.max(1, Math.floor(rect.height * ratio));
  els.canvas.getContext('2d').setTransform(ratio, 0, 0, ratio, 0, 0);
  initWindParticles();
}

function initWindParticles() {
  if (!els.canvas || !map) return;
  const rect = map.getContainer().getBoundingClientRect();
  const count = Math.max(90, Math.min(380, Math.floor(rect.width * rect.height / 3300)));
  particles = Array.from({ length: count }, () => ({
    x: Math.random() * rect.width,
    y: Math.random() * rect.height,
    life: 40 + Math.random() * 100,
    wobble: Math.random() * 1000
  }));
}

function animateWind() {
  if (!els.canvas || !map) return;
  const ctx = els.canvas.getContext('2d');
  const rect = map.getContainer().getBoundingClientRect();
  ctx.clearRect(0, 0, rect.width, rect.height);

  const s = forecast?.days[selectedDayIndex]?.windows[selectedWindow];
  const windKmh = s ? s.wind : 14;
  const gustKmh = s ? s.gust : windKmh;

  // Open-Meteo wind direction is the direction the wind comes FROM.
  // The particles should move TO the opposite direction, so add 180 degrees.
  const rad = s ? ((s.dir + 180) * Math.PI / 180) : 0;
  const speed = clamp(0.11 * windKmh + 0.7, 1.2, 9.5);
  const tail = clamp(5 + windKmh * 0.38, 7, 26);
  const alphaBase = clamp(0.24 + windKmh / 80, 0.32, 0.88);
  const vx = Math.sin(rad) * speed;
  const vy = -Math.cos(rad) * speed;

  ctx.lineWidth = clamp(1.1 + gustKmh / 80, 1.2, 2.2);
  ctx.lineCap = 'round';

  particles.forEach(p => {
    const oldX = p.x - Math.sin(rad) * tail;
    const oldY = p.y + Math.cos(rad) * tail;
    const wobble = Date.now() / 650 + p.wobble;
    p.x += vx + Math.sin((p.y + wobble) / 54) * 0.42;
    p.y += vy + Math.cos((p.x + wobble) / 64) * 0.32;
    p.life -= 1;

    if (p.x < -40 || p.x > rect.width + 40 || p.y < -40 || p.y > rect.height + 40 || p.life <= 0) {
      p.x = Math.random() * rect.width;
      p.y = Math.random() * rect.height;
      p.life = 55 + Math.random() * 110;
      p.wobble = Math.random() * 1000;
    }

    const alpha = clamp((p.life / 120) * alphaBase, 0.12, 0.9);
    ctx.strokeStyle = `rgba(235,248,255,${alpha})`;
    ctx.beginPath();
    ctx.moveTo(oldX, oldY);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  });

  animationFrame = requestAnimationFrame(animateWind);
}

function stopWind() {
  if (animationFrame) cancelAnimationFrame(animationFrame);
}

function readCache(key, maxAge) {
  try {
    const item = JSON.parse(localStorage.getItem(key));
    if (!item || Date.now() - item.t > maxAge) return null;
    return item.v;
  } catch { return null; }
}
function writeCache(key, value) {
  try { localStorage.setItem(key, JSON.stringify({ t: Date.now(), v: value })); } catch {}
}

function showStatus(msg, sticky = false) {
  els.status.textContent = msg;
  els.status.classList.add('show');
  if (!sticky) clearTimeout(showStatus.t);
}
function hideStatus() { els.status.classList.remove('show'); }

function n(x) { return Number.isFinite(Number(x)) ? Number(x) : 0; }
function avg(arr) { return arr.length ? sum(arr) / arr.length : 0; }
function sum(arr) { return arr.reduce((a, b) => a + n(b), 0); }
function stdev(arr) { const m = avg(arr); return Math.sqrt(avg(arr.map(x => (x - m) ** 2))); }
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function circularMean(degs, weights) {
  let x = 0, y = 0;
  degs.forEach((deg, i) => { const r = deg * Math.PI / 180; const w = weights[i] || 1; x += Math.sin(r) * w; y += Math.cos(r) * w; });
  return (Math.atan2(x, y) * 180 / Math.PI + 360) % 360;
}
function dayLabel(d) { return new Intl.DateTimeFormat('en-GB', { weekday: 'short' }).format(d); }
function dateShort(d) { return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short' }).format(d); }
function dateLong(d) { return new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: '2-digit', month: 'long' }).format(d); }
function compass(deg) {
  const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  return dirs[Math.round(deg / 22.5) % 16];
}

init();
