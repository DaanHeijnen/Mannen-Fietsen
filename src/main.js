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
  <div id="predictionNotice" class="prediction-notice" hidden>
    <span id="predictionNoticeText">Showing predictions</span>
    <button id="backToCurrentBtn" type="button">Back to current conditions</button>
  </div>
  <section class="sidepanel">
    <article class="card hero">
      <div class="hero-head">
        <div>
          <div class="eyebrow">Current conditions</div>
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

let map, markerLayer, heatLayer, pinLayer, selectedZone = ZONES[0], selectedWindow = 'day', selectedDayIndex = 0;
let forecast = null;
let particles = [];
let animationFrame = null;
let lastWindFrame = 0;
let lastWindDrawAt = 0;
let windWatchdogTimer = null;
let mapResizeObserver = null;
let mapResizeTimer = null;
let activePin = null;

const els = {
  chipbar: document.querySelector('#chipbar'),
  zoneSelect: document.querySelector('#zoneSelect'),
  windowSelect: document.querySelector('#windowSelect'),
  windows: document.querySelector('#windows'),
  status: document.querySelector('#status'),
  predictionNotice: document.querySelector('#predictionNotice'),
  predictionNoticeText: document.querySelector('#predictionNoticeText'),
  backToCurrentBtn: document.querySelector('#backToCurrentBtn'),
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


function scheduleMapRefresh(delay = 0) {
  if (!map) return;
  clearTimeout(mapResizeTimer);
  mapResizeTimer = setTimeout(() => {
    map.invalidateSize(false);
    resizeCanvas();
    drawWeatherOverlay();
  }, delay);
}

function init() {
  initControls();
  initMap();
  resizeCanvas();
  window.addEventListener('resize', () => scheduleMapRefresh(80));
  window.addEventListener('orientationchange', () => scheduleMapRefresh(350));
  window.visualViewport?.addEventListener('resize', () => scheduleMapRefresh(120));
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && forecast) startWind(false);
  });
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
  els.backToCurrentBtn.addEventListener('click', backToCurrentConditions);
  els.searchBtn.addEventListener('click', searchPlace);
  els.searchInput.addEventListener('keydown', e => { if (e.key === 'Enter') searchPlace(); });
}

function initMap() {
  // Mobile WebViews can render Leaflet's translated tile layers as blocky chunks.
  // Force the stable non-3D path before Leaflet creates the map.
  if (L?.Browser) L.Browser.any3d = false;

  map = L.map('map', {
    zoomControl: false,
    minZoom: 7,
    maxZoom: 13,
    preferCanvas: true,
    worldCopyJump: false,
    zoomAnimation: false,
    fadeAnimation: false,
    markerZoomAnimation: false,
    inertia: false
  }).setView([53.13, 5.65], 8);

  // Use standard OSM raster tiles and darken them with CSS. This proved more stable
  // than provider-side dark tiles in mobile preview/webview environments.
  const baseTiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors | Weather data by Open-Meteo',
    crossOrigin: false,
    updateWhenIdle: true,
    updateWhenZooming: false,
    keepBuffer: 3,
    tileSize: 256,
    className: 'base-map-tile'
  }).addTo(map);

  baseTiles.on('tileerror', event => {
    const img = event.tile;
    if (!img.dataset.fallback) {
      img.dataset.fallback = '1';
      img.src = img.src.replace('https://tile.openstreetmap.org', 'https://a.tile.openstreetmap.org');
    }
  });

  L.control.zoom({ position: 'bottomright' }).addTo(map);
  markerLayer = L.layerGroup().addTo(map);
  heatLayer = L.layerGroup().addTo(map);
  pinLayer = L.layerGroup().addTo(map);

  // Keep the wind animation attached to the map container itself.
  // This fixes the bug where the canvas sits outside Leaflet and the map tiles render in broken blocks.
  els.canvas = document.createElement('canvas');
  els.canvas.id = 'windCanvas';
  els.canvas.className = 'wind-canvas';
  map.getContainer().appendChild(els.canvas);

  renderMarkers();

  map.on('moveend zoomend resize', () => scheduleMapRefresh(20));
  map.on('click', handleMapClick);

  const mapEl = map.getContainer();
  if ('ResizeObserver' in window) {
    mapResizeObserver = new ResizeObserver(() => scheduleMapRefresh(80));
    mapResizeObserver.observe(mapEl);
  }
  mapEl.addEventListener('transitionend', () => scheduleMapRefresh(80));

  // Leaflet sometimes calculates a wrong initial size when the UI is injected dynamically.
  // Force a recalculation after the browser has painted the page.
  requestAnimationFrame(() => scheduleMapRefresh(0));
  setTimeout(() => scheduleMapRefresh(250), 250);
  setTimeout(() => scheduleMapRefresh(700), 700);
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
  clearActivePin();
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
    clearActivePin();
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
    startWind();
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
  renderPredictionNotice();
  drawWeatherOverlay();
  refreshActivePin();
}

function renderHero() {
  const current = getCurrentConditionsSummary();
  if (!current) return;
  const h = current.hour;
  const s = current.summary;
  els.heroTitle.textContent = `Now in ${forecast.zone.name}`;
  els.heroSub.textContent = `${Math.round(h.temp)}°C · ${weatherDescription(h.code)} · ${Math.round(h.rainProb)}% rain risk.`;
  els.scoreBubble.style.setProperty('--score', s.score);
  els.scoreBubble.querySelector('span').textContent = s.score;
  els.mRain.textContent = `${Math.round(h.rainProb)}% / ${formatRainMm(Math.max(h.precip, h.rain), h.rainProb)}`;
  els.mWind.textContent = `${Math.round(h.wind)} km/h`;
  els.mGust.textContent = `${Math.round(h.gust)} km/h`;
  els.mConfidence.textContent = `${s.confidence}%`;
  els.routeTip.textContent = routeTip(h.dir, h.wind, h.gust);
}

function renderWindows() {
  els.windows.innerHTML = forecast.days.map((day, idx) => {
    const s = day.windows[selectedWindow];
    const cl = s.grade === 'good' ? '' : s.grade;
    const expanded = idx === selectedDayIndex;
    return `<div class="window-day ${expanded ? 'expanded' : ''}" data-day="${idx}">
      <button class="window-row ${expanded ? 'selected' : ''}" type="button" aria-expanded="${expanded}">
        <div><div class="day">${dayLabel(day.date)}</div><div class="date">${dateShort(day.date)}</div></div>
        <div>
          <div class="row-title"><span>${adviceText(s)}</span><span>${Math.round(s.confidence)}% confidence</span></div>
          <div class="bar"><div class="fill ${cl}" style="width:${s.score}%"></div></div>
        </div>
        <div class="grade ${cl}">${s.grade.toUpperCase()}</div>
      </button>
      ${expanded ? renderHourlyRain(day) : ''}
    </div>`;
  }).join('');
  els.windows.querySelectorAll('[data-day] > .window-row').forEach(row => row.addEventListener('click', () => {
    selectedDayIndex = Number(row.closest('[data-day]').dataset.day);
    renderAll();
  }));
}

function renderHourlyRain(day) {
  const rows = day.items.map(hour => {
    const amount = Math.max(hour.precip, hour.rain);
    const prob = Math.round(hour.rainProb);
    const rainWidth = clamp(prob, 2, 100);
    const amountText = formatRainMm(amount, prob).replace('<', '&lt;');
    return `<div class="hour-row">
      <span class="hour-time">${hourLabel(hour.time)}</span>
      <span class="hour-rainbar"><i style="width:${rainWidth}%"></i></span>
      <strong>${prob}%</strong>
      <span>${amountText}</span>
    </div>`;
  }).join('');

  return `<div class="hourly-panel">
    <div class="hourly-head"><span>Hourly rain forecast</span><span>Chance / amount</span></div>
    <div class="hourly-list">${rows}</div>
  </div>`;
}

function renderDetail() {
  const day = forecast.days[selectedDayIndex];
  const s = day.windows[selectedWindow];
  els.detailTitle.textContent = `${dateLong(day.date)} · ${WINDOWS[selectedWindow].label} · ${forecast.zone.name}`;
  els.dScore.textContent = `${s.score}/100 ${s.grade}`;
  els.dRain.textContent = `${Math.round(s.rainProb)}%, ${formatRainMm(s.rainAmount, s.rainProb)}/h`;
  els.dWind.textContent = `${Math.round(s.wind)} km/h, gusts ${Math.round(s.gust)} km/h`;
  els.dDir.textContent = `${compass(s.dir)} (${Math.round(s.dir)}°)`;
}

function renderPredictionNotice() {
  if (!forecast || selectedDayIndex === 0) {
    els.predictionNotice.hidden = true;
    return;
  }
  const day = forecast.days[selectedDayIndex];
  els.predictionNoticeText.textContent = `Showing predictions for ${dateLong(day.date)}`;
  els.predictionNotice.hidden = false;
}

function backToCurrentConditions() {
  selectedDayIndex = 0;
  renderAll();
  startWind(false);
}

function getCurrentConditionsSummary(sourceForecast = forecast) {
  if (!sourceForecast?.hours?.length) return null;
  const now = new Date();
  let hour = sourceForecast.hours[0];
  let bestDiff = Math.abs(hour.time - now);
  sourceForecast.hours.forEach(row => {
    const diff = Math.abs(row.time - now);
    if (diff < bestDiff) {
      bestDiff = diff;
      hour = row;
    }
  });
  const dayIndex = Math.max(0, sourceForecast.days.findIndex(day => day.key === hour.iso.slice(0, 10)));
  const summary = summarizeWindow([hour], dayIndex, 'current');
  return { hour, summary, dayIndex };
}

function getSelectedForecastSummary(sourceForecast = forecast) {
  if (!sourceForecast) return null;
  if (selectedDayIndex === 0) return getCurrentConditionsSummary(sourceForecast);
  const day = sourceForecast.days[selectedDayIndex] || sourceForecast.days[0];
  const summary = day.windows[selectedWindow];
  return { hour: findBestHourForWindow(day, selectedWindow), summary, dayIndex: selectedDayIndex, day };
}

function findBestHourForWindow(day, windowId) {
  const w = WINDOWS[windowId] || WINDOWS.day;
  const hours = day.items.filter(row => row.time.getHours() >= w.start && row.time.getHours() < w.end);
  if (!hours.length) return day.items[0];
  const targetHour = Math.round((w.start + w.end) / 2);
  return hours.reduce((best, row) => Math.abs(row.time.getHours() - targetHour) < Math.abs(best.time.getHours() - targetHour) ? row : best, hours[0]);
}

function weatherDescription(code) {
  if ([0].includes(code)) return 'Clear';
  if ([1, 2, 3].includes(code)) return 'Cloudy';
  if ([45, 48].includes(code)) return 'Fog';
  if ([51, 53, 55, 56, 57].includes(code)) return 'Drizzle';
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'Rain';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'Snow';
  if ([95, 96, 99].includes(code)) return 'Thunderstorm';
  return 'Forecast';
}

async function handleMapClick(event) {
  if (!event?.latlng) return;
  const { lat, lng } = event.latlng;
  setPinLoading(lat, lng);
  try {
    const data = await getForecast(lat, lng);
    const pinForecast = transformForecast(data, { id: 'pin', name: 'Dropped pin', short: 'Pin', lat, lon: lng, zoom: map.getZoom() });
    const selection = getSelectedForecastSummary(pinForecast);
    activePin = { lat, lon: lng, forecast: pinForecast };
    renderPin(selection);
  } catch (err) {
    console.error(err);
    setPinError(lat, lng);
  }
}

function setPinLoading(lat, lon) {
  if (!pinLayer) return;
  pinLayer.clearLayers();
  activePin = { lat, lon, forecast: null };
  L.marker([lat, lon], { icon: pinIcon('Loading...') })
    .addTo(pinLayer)
    .bindTooltip('Loading wind...', { permanent: true, direction: 'top', offset: [0, -18], className: 'wind-pin-tooltip' })
    .openTooltip();
}

function renderPin(selection) {
  if (!activePin || !pinLayer || !selection?.summary) return;
  const s = selection.summary;
  const label = selectedDayIndex === 0
    ? `Now: ${Math.round(s.wind)} km/h · gusts ${Math.round(s.gust)} km/h`
    : `${dateShort(forecast.days[selectedDayIndex].date)} ${WINDOWS[selectedWindow].label}: ${Math.round(s.wind)} km/h · gusts ${Math.round(s.gust)} km/h`;

  pinLayer.clearLayers();
  L.marker([activePin.lat, activePin.lon], { icon: pinIcon(`${Math.round(s.wind)} km/h`) })
    .addTo(pinLayer)
    .bindTooltip(label, { permanent: true, direction: 'top', offset: [0, -20], className: 'wind-pin-tooltip' })
    .openTooltip();
}

function refreshActivePin() {
  if (!activePin?.forecast) return;
  renderPin(getSelectedForecastSummary(activePin.forecast));
}

function setPinError(lat, lon) {
  if (!pinLayer) return;
  pinLayer.clearLayers();
  L.marker([lat, lon], { icon: pinIcon('Error') })
    .addTo(pinLayer)
    .bindTooltip('Could not load wind for this point', { permanent: true, direction: 'top', offset: [0, -18], className: 'wind-pin-tooltip' })
    .openTooltip();
}

function clearActivePin() {
  activePin = null;
  pinLayer?.clearLayers();
}

function pinIcon(text) {
  return L.divIcon({
    className: '',
    html: `<div class="wind-pin"><span>${text}</span></div>`,
    iconSize: [74, 38],
    iconAnchor: [37, 38]
  });
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
  const ctx = els.canvas.getContext('2d');
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, rect.width, rect.height);
  initWindParticles();
  ensureWindRunning();
}

function initWindParticles() {
  if (!els.canvas || !map) return;
  const rect = map.getContainer().getBoundingClientRect();
  const count = Math.max(150, Math.min(620, Math.floor(rect.width * rect.height / 2200)));
  particles = Array.from({ length: count }, () => createWindParticle(rect, true));
}

function createWindParticle(rect, anywhere = false) {
  const s = forecast?.days[selectedDayIndex]?.windows[selectedWindow];
  const dir = s ? s.dir : 270;

  // Open-Meteo gives the direction wind comes FROM. The animation moves TO the opposite side.
  const rad = ((dir + 180) * Math.PI / 180);
  const vx = Math.sin(rad);
  const vy = -Math.cos(rad);
  const margin = 24;

  if (anywhere) {
    const life = 150 + Math.random() * 240;
    return {
      x: Math.random() * rect.width,
      y: Math.random() * rect.height,
      age: Math.random() * life * 0.55,
      life,
      wobble: Math.random() * 1000
    };
  }

  let x;
  let y;
  const entryJitter = Math.random() * 42;
  if (Math.abs(vx) > Math.abs(vy)) {
    x = vx > 0 ? -margin + entryJitter : rect.width + margin - entryJitter;
    y = Math.random() * rect.height;
  } else {
    x = Math.random() * rect.width;
    y = vy > 0 ? -margin + entryJitter : rect.height + margin - entryJitter;
  }

  return {
    x,
    y,
    age: Math.random() * 8,
    life: 110 + Math.random() * 170,
    wobble: Math.random() * 1000
  };
}

function startWind(resetParticles = true) {
  if (!els.canvas || !map) return;
  if (animationFrame) cancelAnimationFrame(animationFrame);
  animationFrame = null;
  lastWindFrame = 0;
  if (resetParticles || !particles.length) initWindParticles();
  animationFrame = requestAnimationFrame(animateWind);
  startWindWatchdog();
}

function ensureWindRunning() {
  if (!forecast || document.hidden) return;
  if (!animationFrame) startWind(false);
}

function startWindWatchdog() {
  if (windWatchdogTimer) return;
  windWatchdogTimer = setInterval(() => {
    if (!forecast || document.hidden) return;
    const stale = !animationFrame || performance.now() - lastWindDrawAt > 2200;
    if (stale) startWind(false);
  }, 1500);
}

function animateWind(now = performance.now()) {
  if (!els.canvas || !map) {
    animationFrame = requestAnimationFrame(animateWind);
    return;
  }

  // Cap the animation a little. It keeps the effect calm and avoids harsh jumps on slower devices.
  if (now - lastWindFrame < 28) {
    animationFrame = requestAnimationFrame(animateWind);
    return;
  }
  lastWindFrame = now;

  const ctx = els.canvas.getContext('2d');
  const rect = map.getContainer().getBoundingClientRect();
  if (rect.width < 2 || rect.height < 2) {
    animationFrame = requestAnimationFrame(animateWind);
    return;
  }
  lastWindDrawAt = now;
  const s = forecast?.days[selectedDayIndex]?.windows[selectedWindow];
  const windKmh = s ? s.wind : 14;
  const gustKmh = s ? s.gust : windKmh;

  // Fade previous lines instead of clearing the whole canvas. This creates a softer Windy-like trail.
  ctx.globalCompositeOperation = 'destination-in';
  ctx.fillStyle = 'rgba(0, 0, 0, 0.88)';
  ctx.fillRect(0, 0, rect.width, rect.height);
  ctx.globalCompositeOperation = 'source-over';

  const rad = s ? ((s.dir + 180) * Math.PI / 180) : 0;
  const speed = clamp(0.075 * windKmh + 0.45, 0.85, 5.2);
  const tail = clamp(4 + windKmh * 0.24, 6, 18);
  const alphaBase = clamp(0.16 + windKmh / 120, 0.20, 0.56);
  const vx = Math.sin(rad) * speed;
  const vy = -Math.cos(rad) * speed;

  ctx.lineWidth = clamp(0.75 + gustKmh / 150, 0.85, 1.65);
  ctx.lineCap = 'round';

  // Keep the field evenly populated. Without this, long-lived particles can
  // drift off-screen together and the visible wind appears stuck near one edge.
  let visibleParticles = 0;

  particles.forEach((p, index) => {
    const prevX = p.x;
    const prevY = p.y;
    const wobble = now / 900 + p.wobble;

    p.x += vx + Math.sin((p.y + wobble) / 58) * 0.22;
    p.y += vy + Math.cos((p.x + wobble) / 70) * 0.18;
    p.age += 1;

    const outside = p.x < -50 || p.x > rect.width + 50 || p.y < -50 || p.y > rect.height + 50;
    if (!outside) visibleParticles += 1;
    if (outside || p.age > p.life) {
      // Important: do not draw from the old position to this new position.
      // Respawn across the whole viewport instead of only at the entry edge,
      // otherwise the animation slowly collects at one side of the map.
      particles[index] = createWindParticle(rect, true);
      return;
    }

    const fadeIn = clamp((p.age + 6) / 20, 0, 1);
    const fadeOut = clamp((p.life - p.age) / 32, 0, 1);
    const alpha = clamp(alphaBase * fadeIn * fadeOut, 0.04, 0.55);

    ctx.strokeStyle = `rgba(226, 246, 255, ${alpha})`;
    ctx.beginPath();
    ctx.moveTo(prevX - Math.sin(rad) * tail * 0.25, prevY + Math.cos(rad) * tail * 0.25);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  });

  if (visibleParticles < particles.length * 0.45) {
    const refillCount = Math.ceil(particles.length * 0.18);
    for (let i = 0; i < refillCount; i += 1) {
      particles[Math.floor(Math.random() * particles.length)] = createWindParticle(rect, true);
    }
  }

  animationFrame = requestAnimationFrame(animateWind);
}

function stopWind() {
  if (animationFrame) cancelAnimationFrame(animationFrame);
  animationFrame = null;
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

function formatRainMm(value, rainProb = 0) {
  const mm = n(value);
  const prob = n(rainProb);
  if (mm > 0 && mm < 0.1) return '<0.1 mm';
  if (mm === 0 && prob > 0) return '<0.1 mm';
  return `${mm.toFixed(1)} mm`;
}
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
function hourLabel(d) { return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }).format(d); }
function dayLabel(d) { return new Intl.DateTimeFormat('en-GB', { weekday: 'short' }).format(d); }
function dateShort(d) { return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short' }).format(d); }
function dateLong(d) { return new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: '2-digit', month: 'long' }).format(d); }
function compass(deg) {
  const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  return dirs[Math.round(deg / 22.5) % 16];
}

init();
