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

const SIGNUP_SECRET = 'Mannenavond';
const ROUTE_ACCESS_STORAGE_KEY = 'mannenfietsplanner:route-access-key';

const API_VARIABLES = [
  'temperature_2m',
  'relative_humidity_2m',
  'uv_index',
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

const POLLEN_VARIABLES = [
  'alder_pollen',
  'birch_pollen',
  'grass_pollen',
  'mugwort_pollen',
  'olive_pollen',
  'ragweed_pollen'
].join(',');

const app = document.querySelector('#app');
app.innerHTML = `
  <div id="map" class="map"></div>
  <div class="topbar">
    <div class="brand">
      <div class="logo">🚴</div>
      <div><h1>Mannen Fietsplanner</h1><p>Wind + rain planner</p></div>
    </div>
    <div class="search-auth-row">
      <div class="searchbox">
        <input id="searchInput" placeholder="Search a place, e.g. Groningen, Assen, Leeuwarden" />
        <button id="searchBtn">Search</button>
      </div>
      <div class="top-auth-actions">
        <button id="topAuthBtn" type="button">Log in</button>
        <button id="topRoutesBtn" type="button">Routes</button>
      </div>
    </div>
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
        <div class="metric"><label>Pollen</label><strong id="mPollen">--</strong></div>
        <div class="metric"><label>Confidence</label><strong id="mConfidence">--</strong></div>
      </div>
      <div id="routeTip" class="route-tip">Tip appears after forecast data loads.</div>
    </article>
    <article class="card controls">
      <div class="selectrow"><label>Area</label><select id="zoneSelect"></select></div>
      <div class="selectrow"><label>Ride window</label><select id="windowSelect"></select></div>
    </article>
    <article id="routesCard" class="card routes-card">
      <div class="routes-head">
        <div>
          <h3>GPX routes</h3>
          <p id="routeAuthState">Log in to upload your own routes.</p>
          <button id="routeUnlockBtn" class="route-unlock-btn" type="button" hidden>Unlock uploads</button>
        </div>
        <div class="route-head-actions">
          <button id="clearRouteBtn" class="route-clear-btn" type="button" hidden>Hide route</button>
          <button id="routePanelCloseBtn" class="route-panel-close" type="button" aria-label="Close routes">×</button>
        </div>
      </div>
      <div id="mobileRouteMenu" class="mobile-route-menu" hidden>
        <button type="button" data-mobile-route-action="all">All routes</button>
        <button type="button" data-mobile-route-action="mine">My routes</button>
        <button type="button" data-mobile-route-action="upload">Upload GPX</button>
      </div>
      <form id="routeUploadForm" class="route-upload">
        <div class="route-upload-grid">
          <input id="routeTitleInput" name="title" placeholder="Route name" maxlength="80" />
          <input id="routeCreatorInput" name="creator" placeholder="Made by" maxlength="60" />
        </div>
        <input id="routeDescriptionInput" name="description" placeholder="Short description, optional" maxlength="160" />
        <div class="route-file-row">
          <input id="routeFileInput" name="file" type="file" accept=".gpx,application/gpx+xml,text/xml,application/xml" />
          <button id="routeUploadBtn" type="submit">Upload GPX</button>
        </div>
      </form>
      <div class="route-tabs">
        <button type="button" class="active" data-route-filter="all">All routes</button>
        <button type="button" data-route-filter="mine">My routes</button>
      </div>
      <div id="routeList" class="route-list">Loading routes...</div>
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
        <div class="pill"><span>Temp</span><strong id="dTemp">--</strong></div>
        <div class="pill"><span>Humidity</span><strong id="dHumidity">--</strong></div>
        <div class="pill"><span>UV</span><strong id="dUv">--</strong></div>
        <div class="pill"><span>Pollen</span><strong id="dPollen">--</strong></div>
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
  <div id="authModal" class="auth-modal" hidden>
    <div class="auth-modal-backdrop" data-auth-close="true"></div>
    <section class="auth-dialog card">
      <button id="authModalCloseBtn" class="auth-close" type="button" aria-label="Close login">×</button>
      <h3>Account</h3>
      <p class="auth-help">Log in, or create an account with the secret key.</p>
      <div class="auth-mode-row">
        <button id="authModeLoginBtn" type="button" class="active">Log in</button>
        <button id="authModeSignupBtn" type="button">Create account</button>
      </div>
      <form id="customAuthForm" class="custom-auth-form">
        <input id="authEmailInput" type="email" autocomplete="email" placeholder="Email" required />
        <input id="authPasswordInput" type="password" autocomplete="current-password" placeholder="Password" required />
        <input id="authSecretInput" type="password" autocomplete="off" placeholder="Secret key" hidden />
        <button id="authSubmitBtn" type="submit">Log in</button>
      </form>
      <div id="authModalMessage" class="auth-message"></div>
    </section>
  </div>
`;

let map, markerLayer, heatLayer, pinLayer, routeLayer, selectedZone = ZONES[0], selectedWindow = 'day', selectedDayIndex = 0, expandedDayIndex = null;
let forecast = null;
let particles = [];
let animationFrame = null;
let lastWindFrame = 0;
let lastWindDrawAt = 0;
let windWatchdogTimer = null;
let mapResizeObserver = null;
let mapResizeTimer = null;
let activePin = null;
let authUser = null;
let routes = [];
let routeFilter = 'all';
let activeRoute = null;
let routePanelOpen = false;
let authModalMode = 'login';

const els = {
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
  mPollen: document.querySelector('#mPollen'),
  mConfidence: document.querySelector('#mConfidence'),
  routeTip: document.querySelector('#routeTip'),
  dScore: document.querySelector('#dScore'),
  dRain: document.querySelector('#dRain'),
  dWind: document.querySelector('#dWind'),
  dDir: document.querySelector('#dDir'),
  dTemp: document.querySelector('#dTemp'),
  dHumidity: document.querySelector('#dHumidity'),
  dUv: document.querySelector('#dUv'),
  dPollen: document.querySelector('#dPollen'),
  detailTitle: document.querySelector('#detailTitle'),
  searchInput: document.querySelector('#searchInput'),
  searchBtn: document.querySelector('#searchBtn'),
  topAuthBtn: document.querySelector('#topAuthBtn'),
  topRoutesBtn: document.querySelector('#topRoutesBtn'),
  routesCard: document.querySelector('#routesCard'),
  routePanelCloseBtn: document.querySelector('#routePanelCloseBtn'),
  clearRouteBtn: document.querySelector('#clearRouteBtn'),
  mobileRouteMenu: document.querySelector('#mobileRouteMenu'),
  routeAuthState: document.querySelector('#routeAuthState'),
  routeUnlockBtn: document.querySelector('#routeUnlockBtn'),
  routeUploadForm: document.querySelector('#routeUploadForm'),
  routeTitleInput: document.querySelector('#routeTitleInput'),
  routeCreatorInput: document.querySelector('#routeCreatorInput'),
  routeDescriptionInput: document.querySelector('#routeDescriptionInput'),
  routeFileInput: document.querySelector('#routeFileInput'),
  routeUploadBtn: document.querySelector('#routeUploadBtn'),
  routeList: document.querySelector('#routeList'),
  routeTabs: document.querySelector('.route-tabs'),
  authModal: document.querySelector('#authModal'),
  authModalCloseBtn: document.querySelector('#authModalCloseBtn'),
  authModeLoginBtn: document.querySelector('#authModeLoginBtn'),
  authModeSignupBtn: document.querySelector('#authModeSignupBtn'),
  customAuthForm: document.querySelector('#customAuthForm'),
  authEmailInput: document.querySelector('#authEmailInput'),
  authPasswordInput: document.querySelector('#authPasswordInput'),
  authSecretInput: document.querySelector('#authSecretInput'),
  authSubmitBtn: document.querySelector('#authSubmitBtn'),
  authModalMessage: document.querySelector('#authModalMessage'),
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

function isTouchMapDevice() {
  return window.matchMedia?.('(pointer: coarse)').matches || window.innerWidth <= 980;
}

function selectedPlaceZoom(zone = selectedZone) {
  const baseZoom = Number.isFinite(Number(zone?.zoom)) ? Number(zone.zoom) : 10;
  // Mobile zoom already feels right, so only increase the desktop zoom a little.
  return isTouchMapDevice() ? baseZoom : clamp(baseZoom + 1, 7, 13);
}

function centerMapOnSelectedPlace(delay = 0) {
  if (!map || !selectedZone) return;
  const lat = Number(selectedZone.lat);
  const lon = Number(selectedZone.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

  setTimeout(() => {
    if (!map) return;
    map.invalidateSize(false);
    map.setView([lat, lon], selectedPlaceZoom(selectedZone), { animate: false });
    scheduleMapRefresh(60);
  }, delay);
}

function init() {
  initControls();
  initRouteControls();
  initAuth();
  initMap();
  resizeCanvas();
  window.addEventListener('resize', () => scheduleMapRefresh(80));
  window.addEventListener('orientationchange', () => scheduleMapRefresh(350));
  window.visualViewport?.addEventListener('resize', () => scheduleMapRefresh(120));
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && forecast) startWind(false);
  });
  loadForecast(selectedZone);
  loadRoutes();
  centerMapOnSelectedPlace(450);
}


function initControls() {
  els.zoneSelect.innerHTML = ZONES.map(z => `<option value="${z.id}">${z.name}</option>`).join('');
  els.windowSelect.innerHTML = Object.entries(WINDOWS).map(([id, w]) => `<option value="${id}">${w.label}</option>`).join('');
  els.zoneSelect.addEventListener('change', e => setZone(e.target.value));
  els.windowSelect.addEventListener('change', e => {
    selectedWindow = e.target.value;
    selectedDayIndex = 0;
    expandedDayIndex = null;
    renderAll();
  });
  els.backToCurrentBtn.addEventListener('click', backToCurrentConditions);
  els.searchBtn.addEventListener('click', searchPlace);
  els.searchInput.addEventListener('keydown', e => { if (e.key === 'Enter') searchPlace(); });
}

function initRouteControls() {
  els.topAuthBtn.addEventListener('click', handleTopAuthClick);
  els.topRoutesBtn.addEventListener('click', () => setRoutePanelOpen(!routePanelOpen));
  els.routePanelCloseBtn.addEventListener('click', () => setRoutePanelOpen(false));
  els.clearRouteBtn.addEventListener('click', () => {
    clearRoute();
    showStatus('Route hidden.');
    setTimeout(hideStatus, 1100);
  });
  els.routeUploadForm.addEventListener('submit', handleRouteUpload);
  els.routeUnlockBtn?.addEventListener('click', unlockRouteAccess);
  els.routeTabs.addEventListener('click', event => {
    const btn = event.target.closest('[data-route-filter]');
    if (!btn) return;
    setRouteFilter(btn.dataset.routeFilter);
  });
  els.mobileRouteMenu.addEventListener('click', event => {
    const btn = event.target.closest('[data-mobile-route-action]');
    if (!btn) return;
    const action = btn.dataset.mobileRouteAction;
    setRoutePanelOpen(true);
    if (action === 'all' || action === 'mine') setRouteFilter(action);
    if (action === 'upload') {
      if (!canUploadRoutes()) {
        openAuthModal('login');
        return;
      }
      setTimeout(() => els.routeTitleInput?.focus(), 120);
    }
  });
  els.authModeLoginBtn.addEventListener('click', () => setAuthModalMode('login'));
  els.authModeSignupBtn.addEventListener('click', () => setAuthModalMode('signup'));
  els.authModalCloseBtn.addEventListener('click', closeAuthModal);
  els.authModal.addEventListener('click', event => {
    if (event.target?.dataset?.authClose) closeAuthModal();
  });
  els.customAuthForm.addEventListener('submit', handleCustomAuthSubmit);
}

function initAuth() {
  if (!window.netlifyIdentity) {
    authUser = null;
    renderAuthState();
    return;
  }
  window.netlifyIdentity.on('init', user => {
    authUser = user;
    renderAuthState();
    renderRoutes();
  });
  window.netlifyIdentity.on('login', user => {
    authUser = user;
    window.netlifyIdentity.close();
    renderAuthState();
    loadRoutes();
  });
  window.netlifyIdentity.on('logout', () => {
    authUser = null;
    renderAuthState();
    renderRoutes();
  });
  window.netlifyIdentity.init();
}

function renderAuthState() {
  const hasIdentity = Boolean(window.netlifyIdentity);
  const email = authUser?.email;
  const canUpload = canUploadRoutes();
  els.routeAuthState.textContent = email
    ? `Logged in as ${email}. You can upload GPX routes.`
    : hasIdentity ? 'Log in to upload your own routes.' : 'Netlify Identity is not loaded yet.';
  if (els.routeUnlockBtn) els.routeUnlockBtn.hidden = true;
  els.topAuthBtn.textContent = email ? isTouchMapDevice() ? 'Routes' : 'Log out' : 'Log in';
  els.topAuthBtn.classList.toggle('logged-in', Boolean(email));
  els.routeUploadBtn.disabled = !canUpload;
  els.routeUploadForm.classList.toggle('disabled', !canUpload);
  els.mobileRouteMenu.hidden = !(isTouchMapDevice() && email && routePanelOpen);
}

function routeAccessKey() {
  try { return localStorage.getItem(ROUTE_ACCESS_STORAGE_KEY) || ''; } catch { return ''; }
}

function canUploadRoutes() {
  return Boolean(authUser);
}

function currentUserKeys() {
  if (!authUser) return [];
  return [authUser.id, authUser.sub, authUser.email].filter(Boolean).map(String);
}

function isOwnRoute(route) {
  const keys = currentUserKeys();
  return keys.includes(String(route?.ownerId || '')) || (route?.ownerEmail && keys.includes(String(route.ownerEmail)));
}

function unlockRouteAccess() {
  if (!authUser) {
    openAuthModal('login');
    return false;
  }
  const key = window.prompt('Enter the Mannenavond secret key to unlock GPX uploads for this account:');
  if (key === null) return false;
  if (key.trim() !== SIGNUP_SECRET) {
    showStatus('Wrong secret key.', true);
    return false;
  }
  try { localStorage.setItem(ROUTE_ACCESS_STORAGE_KEY, SIGNUP_SECRET); } catch {}
  try {
    const current = window.netlifyIdentity?.currentUser?.();
    current?.update?.({ data: { routeAccessKey: SIGNUP_SECRET, routeAccess: true } });
  } catch {}
  renderAuthState();
  showStatus('GPX uploads unlocked for this browser.');
  setTimeout(hideStatus, 1400);
  return true;
}

function handleTopAuthClick() {
  if (authUser && isTouchMapDevice()) {
    setRoutePanelOpen(!routePanelOpen);
    return;
  }
  if (authUser) {
    window.netlifyIdentity?.logout?.();
    return;
  }
  openAuthModal('login');
}

function openAuthModal(mode = 'login') {
  setAuthModalMode(mode);
  els.authModal.hidden = false;
  els.authModalMessage.textContent = '';
  setTimeout(() => els.authEmailInput?.focus(), 40);
}

function closeAuthModal() {
  els.authModal.hidden = true;
  els.authModalMessage.textContent = '';
  els.customAuthForm.reset();
}

function setAuthModalMode(mode) {
  authModalMode = mode === 'signup' ? 'signup' : 'login';
  els.authModeLoginBtn.classList.toggle('active', authModalMode === 'login');
  els.authModeSignupBtn.classList.toggle('active', authModalMode === 'signup');
  els.authSecretInput.hidden = authModalMode !== 'signup';
  els.authSecretInput.required = authModalMode === 'signup';
  els.authPasswordInput.autocomplete = authModalMode === 'signup' ? 'new-password' : 'current-password';
  els.authSubmitBtn.textContent = authModalMode === 'signup' ? 'Create account' : 'Log in';
}

async function handleCustomAuthSubmit(event) {
  event.preventDefault();
  if (!window.netlifyIdentity?.gotrue) {
    els.authModalMessage.textContent = 'Netlify Identity is not ready yet.';
    return;
  }
  const email = els.authEmailInput.value.trim();
  const password = els.authPasswordInput.value;
  const secret = els.authSecretInput.value.trim();
  els.authSubmitBtn.disabled = true;
  els.authModalMessage.textContent = authModalMode === 'signup' ? 'Creating account...' : 'Logging in...';
  try {
    if (authModalMode === 'signup') {
      if (secret !== SIGNUP_SECRET) throw new Error('Wrong secret key.');
      await window.netlifyIdentity.gotrue.signup(email, password, { routeAccessKey: SIGNUP_SECRET });
      els.authModalMessage.textContent = 'Account created. Check your email if confirmation is enabled, then log in.';
      setAuthModalMode('login');
      els.authPasswordInput.value = '';
      els.authSecretInput.value = '';
    } else {
      const user = await window.netlifyIdentity.gotrue.login(email, password, true);
      authUser = user;
      renderAuthState();
      loadRoutes();
      closeAuthModal();
      showStatus('Logged in.');
      setTimeout(hideStatus, 1200);
    }
  } catch (err) {
    console.error(err);
    els.authModalMessage.textContent = err?.json?.msg || err?.message || 'Authentication failed.';
  } finally {
    els.authSubmitBtn.disabled = false;
  }
}

function setRoutePanelOpen(open) {
  routePanelOpen = Boolean(open);
  els.routesCard.classList.toggle('open', routePanelOpen);
  els.topRoutesBtn.classList.toggle('active', routePanelOpen);
  els.mobileRouteMenu.hidden = !(isTouchMapDevice() && authUser && routePanelOpen);
  if (routePanelOpen) loadRoutes();
}

function setRouteFilter(filter) {
  routeFilter = filter === 'mine' ? 'mine' : 'all';
  [...els.routeTabs.querySelectorAll('[data-route-filter]')].forEach(tab => tab.classList.toggle('active', tab.dataset.routeFilter === routeFilter));
  renderRoutes();
}

function initMap() {
  // Keep the old non-3D hardening for desktop/deploy preview, but do NOT force it on touch devices.
  // Leaflet's native touch zoom needs its normal transform path to keep pinch zoom centered and stable.
  const isTouchDevice = window.matchMedia?.('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
  if (L?.Browser) L.Browser.any3d = isTouchDevice ? true : false;

  map = L.map('map', {
    zoomControl: false,
    minZoom: 7,
    maxZoom: 21,
    preferCanvas: true,
    worldCopyJump: false,
    touchZoom: true,
    tap: false,
    bounceAtZoomLimits: false,
    // Keep desktop zoom on Leaflet defaults. Earlier fractional/custom desktop zoom settings
    // made trackpads unpredictable and could block zooming completely in some browsers.
    // Mobile pinch zoom is unchanged.
    scrollWheelZoom: true,
    zoomSnap: 1,
    zoomDelta: 1,
    wheelPxPerZoomLevel: 135,
    wheelDebounceTime: 45,
    zoomAnimation: false,
    fadeAnimation: false,
    markerZoomAnimation: false,
    inertia: false
  }).setView([53.13, 5.65], 8);

  // Use the standard OpenStreetMap tile service for faster high-zoom loading.
  // It still contains mapped cycle paths and avoids the slow/blank CyclOSM tiles at deep zoom levels.
  const baseTiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 21,
    maxNativeZoom: 19,
    attribution: '&copy; OpenStreetMap contributors | Weather data by Open-Meteo',
    crossOrigin: false,
    updateWhenIdle: true,
    updateWhenZooming: false,
    keepBuffer: 2,
    tileSize: 256,
    className: 'base-map-tile cycling-map-tile'
  }).addTo(map);

  L.control.zoom({ position: 'bottomright' }).addTo(map);
  map.createPane('routePane');
  map.getPane('routePane').style.zIndex = 640;
  map.getPane('routePane').style.pointerEvents = 'none';
  markerLayer = L.layerGroup().addTo(map);
  heatLayer = L.layerGroup().addTo(map);
  pinLayer = L.layerGroup().addTo(map);
  routeLayer = L.layerGroup().addTo(map);

  // Do not attach custom touchmove/gesture handlers here.
  // CSS touch-action keeps the browser from page-zooming, while Leaflet receives the full gesture
  // and can calculate the real midpoint between the two fingers.

  // Keep the wind animation attached to the map container itself.
  // This fixes the bug where the canvas sits outside Leaflet and the map tiles render in broken blocks.
  els.canvas = document.createElement('canvas');
  els.canvas.id = 'windCanvas';
  els.canvas.className = 'wind-canvas';
  map.getContainer().appendChild(els.canvas);

  renderMarkers();

  map.on('moveend zoomend resize', () => scheduleMapRefresh(20));
  map.on('zoomstart', () => { if (els.canvas) els.canvas.style.opacity = '0.35'; });
  map.on('zoomend', () => { if (els.canvas) els.canvas.style.opacity = ''; scheduleMapRefresh(40); });
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
  expandedDayIndex = null;
  els.zoneSelect.value = selectedZone.id;
  centerMapOnSelectedPlace();
  clearActivePin();
  await loadForecast(selectedZone);
  centerMapOnSelectedPlace(120);
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
    selectedDayIndex = 0;
    expandedDayIndex = null;
    els.zoneSelect.value = ZONES[0].id;
    centerMapOnSelectedPlace();
    clearActivePin();
    await loadForecast(selectedZone);
    centerMapOnSelectedPlace(120);
  } catch (err) {
    console.error(err);
    showStatus('Could not search right now. Check your internet connection.', true);
  }
}

async function loadForecast(zone) {
  showStatus(`Loading forecast for ${zone.name}...`);
  stopWind();
  try {
    const [data, pollenData] = await Promise.all([
      getForecast(zone.lat, zone.lon),
      getPollenForecast(zone.lat, zone.lon).catch(err => {
        console.warn('Pollen forecast unavailable', err);
        return null;
      })
    ]);
    forecast = transformForecast(data, zone, pollenData);
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
  // Open-Meteo Air Quality accepts up to 7 forecast days, and pollen is often shorter.
  // Asking for 10 days made the endpoint fail, which made the app fall back to Low.
  url.searchParams.set('forecast_days', '7');
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

async function getPollenForecast(lat, lon) {
  const key = `pollen:${lat.toFixed(3)}:${lon.toFixed(3)}`;
  const cached = readCache(key, 1000 * 60 * 60);
  if (cached) return cached;
  const url = new URL('https://air-quality-api.open-meteo.com/v1/air-quality');
  url.searchParams.set('latitude', lat);
  url.searchParams.set('longitude', lon);
  url.searchParams.set('hourly', POLLEN_VARIABLES);
  // Open-Meteo Air Quality accepts up to 7 forecast days, and pollen is often shorter.
  // Asking for 10 days made the endpoint fail, which made the app fall back to Low.
  url.searchParams.set('forecast_days', '7');
  url.searchParams.set('timezone', 'Europe/Amsterdam');
  const data = await fetchJson(url.toString());
  writeCache(key, data);
  return data;
}

function transformForecast(data, zone, pollenData = null) {
  const h = data.hourly;
  const pollenByTime = new Map((pollenData?.hourly?.time || []).map((time, i) => {
    const ph = pollenData.hourly;
    const values = {
      alder: finiteOrNull(ph.alder_pollen?.[i]),
      birch: finiteOrNull(ph.birch_pollen?.[i]),
      grass: finiteOrNull(ph.grass_pollen?.[i]),
      mugwort: finiteOrNull(ph.mugwort_pollen?.[i]),
      olive: finiteOrNull(ph.olive_pollen?.[i]),
      ragweed: finiteOrNull(ph.ragweed_pollen?.[i])
    };
    const scoreInfo = pollenScore(values);
    return [time, {
      ...values,
      total: scoreInfo.hasData ? sum(Object.values(values).filter(v => v !== null)) : null,
      max: scoreInfo.hasData ? Math.max(...Object.values(values).filter(v => v !== null)) : null,
      score: scoreInfo.score,
      dominant: scoreInfo.dominant
    }];
  }));
  const rows = h.time.map((time, i) => ({
    time: new Date(time),
    iso: time,
    temp: n(h.temperature_2m?.[i]),
    humidity: n(h.relative_humidity_2m?.[i]),
    uv: n(h.uv_index?.[i]),
    pollen: pollenByTime.get(time)?.score ?? null,
    pollenTotal: pollenByTime.get(time)?.total ?? null,
    pollenPeak: pollenByTime.get(time)?.max ?? null,
    pollenDominant: pollenByTime.get(time)?.dominant ?? null,
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
  const humidity = avg(items.map(i => i.humidity));
  const uv = Math.max(...items.map(i => i.uv));
  const pollenValues = items.map(i => i.pollen).filter(isFiniteNumber);
  const pollen = pollenValues.length ? Math.max(...pollenValues) : null;
  const pollenPeakValues = items.map(i => i.pollenPeak).filter(isFiniteNumber);
  const pollenPeak = pollenPeakValues.length ? Math.max(...pollenPeakValues) : null;
  const pollenDominant = dominantPollenType(items);
  const clouds = avg(items.map(i => i.clouds));
  const score = cyclingScore({ rainProb, rainAmount, wind, gust, dayIndex });
  const confidence = confidenceScore({ rainProb, rainAmount, wind, gust, temp, humidity, uv, pollen, dayIndex, items });
  const grade = score >= 74 ? 'good' : score >= 48 ? 'maybe' : 'bad';
  return { id, rainProb, rainAmount, wind, gust, dir, temp, humidity, uv, pollen, pollenPeak, pollenDominant, clouds, score, confidence, grade };
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

function confidenceScore({ rainProb, rainAmount, wind, gust, temp, humidity, uv, pollen, dayIndex, items }) {
  const rainVolatility = stdev(items.map(i => i.rainProb)) / 2.4;
  const windVolatility = stdev(items.map(i => i.wind)) * 1.4;
  const tempVolatility = stdev(items.map(i => i.temp)) * 0.9;
  const humidityVolatility = stdev(items.map(i => i.humidity)) / 6;
  const uvVolatility = stdev(items.map(i => i.uv)) * 1.2;
  const pollenValues = items.map(i => i.pollen).filter(isFiniteNumber);
  const pollenVolatility = pollenValues.length ? stdev(pollenValues) / 18 : 0;
  const horizonPenalty = dayIndex * 5.5;
  const edgePenalty = rainProb > 30 && rainProb < 65 ? 10 : 0;
  const gustPenalty = gust > 45 ? 8 : 0;
  const amountPenalty = rainAmount > 0.7 ? 8 : 0;
  const tempPenalty = temp < 5 || temp > 28 ? 5 : 0;
  const humidityPenalty = humidity > 86 || humidity < 34 ? 5 : 0;
  const uvPenalty = uv >= 6 ? 5 : uv >= 3 ? 2 : 0;
  const pollenPenalty = pollenRiskLevel(pollen).penalty;
  const penalty = horizonPenalty + rainVolatility + windVolatility + tempVolatility + humidityVolatility + uvVolatility + pollenVolatility + edgePenalty + gustPenalty + amountPenalty + tempPenalty + humidityPenalty + uvPenalty + pollenPenalty;
  return clamp(Math.round(94 - penalty), 24, 96);
}

function renderAll() {
  if (!forecast) return;
  renderHero();
  renderWindows();
  renderDetail();
  renderPredictionNotice();
  drawWeatherOverlay();
  refreshActivePin();
  renderRoutes();
}


function renderHero() {
  const current = getCurrentConditionsSummary();
  if (!current) return;
  const h = current.hour;
  const s = current.summary;
  els.heroTitle.textContent = `Now in ${forecast.zone.name}`;
  els.heroSub.textContent = `Next 3 hours: ${Math.round(s.temp)}°C · ${weatherDescription(h.code)} · ${Math.round(s.rainProb)}% rain risk · ${formatPollen(s.pollen)} pollen.`;
  els.scoreBubble.style.setProperty('--score', s.score);
  els.scoreBubble.querySelector('span').textContent = s.score;
  els.mRain.textContent = `${Math.round(h.rainProb)}% / ${formatRainMm(Math.max(h.precip, h.rain), h.rainProb)}`;
  els.mWind.textContent = `${Math.round(h.wind)} km/h`;
  els.mGust.textContent = `${Math.round(h.gust)} km/h`;
  els.mPollen.textContent = formatPollen(h.pollen);
  els.mConfidence.textContent = `${s.confidence}%`;
  els.routeTip.textContent = routeTip(h.dir, h.wind, h.gust);
}

function renderWindows() {
  els.windows.innerHTML = forecast.days.map((day, idx) => {
    const s = day.windows[selectedWindow];
    const cl = s.grade === 'good' ? '' : s.grade;
    const expanded = idx === expandedDayIndex;
    return `<div class="window-day ${expanded ? 'expanded' : ''}" data-day="${idx}">
      <button class="window-row ${expanded ? 'selected' : ''}" type="button" aria-expanded="${expanded}">
        <div><div class="day">${dayLabel(day.date)}</div><div class="date">${dateShort(day.date)}</div></div>
        <div>
          <div class="row-title"><span>${adviceText(s)}</span><span>${Math.round(s.confidence)}% confidence</span></div>
          <div class="bar"><div class="fill ${cl}" style="width:${s.score}%"></div></div>
          <div class="day-weather-meta">
            <span>${Math.round(s.temp)}°C</span>
            <span>${Math.round(s.humidity)}% humidity</span>
            <span>UV ${formatUv(s.uv)}</span>
            <span>Pollen ${formatPollen(s.pollen)}</span>
          </div>
        </div>
        <div class="grade ${cl}">${s.grade.toUpperCase()}</div>
      </button>
      ${expanded ? renderHourlyRain(day) : ''}
    </div>`;
  }).join('');
  els.windows.querySelectorAll('[data-day] > .window-row').forEach(row => row.addEventListener('click', () => {
    const idx = Number(row.closest('[data-day]').dataset.day);
    selectedDayIndex = idx;
    expandedDayIndex = expandedDayIndex === idx ? null : idx;
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
  els.dTemp.textContent = `${Math.round(s.temp)}°C`;
  els.dHumidity.textContent = `${Math.round(s.humidity)}%`;
  els.dUv.textContent = formatUv(s.uv);
  els.dPollen.textContent = formatPollen(s.pollen);
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
  expandedDayIndex = null;
  renderAll();
  startWind(false);
}

function getCurrentConditionsSummary(sourceForecast = forecast) {
  if (!sourceForecast?.hours?.length) return null;
  const now = new Date();
  const start = new Date(now.getTime() - 15 * 60 * 1000);
  const end = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  let hours = sourceForecast.hours.filter(row => row.time >= start && row.time <= end);
  if (!hours.length) {
    const future = sourceForecast.hours.filter(row => row.time >= now);
    hours = future.length ? future.slice(0, 3) : sourceForecast.hours.slice(0, 3);
  }
  hours = hours.slice(0, 3);
  const hour = hours[0] || sourceForecast.hours[0];
  const dayIndex = Math.max(0, sourceForecast.days.findIndex(day => day.key === hour.iso.slice(0, 10)));
  const summary = summarizeWindow(hours.length ? hours : [hour], dayIndex, 'current');
  return { hour, hours, summary, dayIndex };
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
    const [data, pollenData] = await Promise.all([
      getForecast(lat, lng),
      getPollenForecast(lat, lng).catch(() => null)
    ]);
    const pinForecast = transformForecast(data, { id: 'pin', name: 'Dropped pin', short: 'Pin', lat, lon: lng, zoom: map.getZoom() }, pollenData);
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

async function loadRoutes() {
  try {
    const data = await fetchJson('/.netlify/functions/routes-list');
    routes = Array.isArray(data.routes) ? data.routes : [];
    renderRoutes();
  } catch (err) {
    console.error(err);
    els.routeList.textContent = 'Could not load routes yet. Deploy with Netlify Functions to enable this.';
  }
}

async function handleRouteUpload(event) {
  event.preventDefault();
  const file = els.routeFileInput.files?.[0];
  if (!canUploadRoutes()) {
    openAuthModal('login');
    return;
  }
  if (!file) return showStatus('Choose a .gpx file first.', true);
  if (!file.name.toLowerCase().endsWith('.gpx')) return showStatus('Only .gpx files are supported.', true);
  if (file.size > 4 * 1024 * 1024) return showStatus('This GPX file is too large. Keep it below 4 MB.', true);

  showStatus('Reading GPX route...');
  try {
    const gpx = await file.text();
    const parsed = parseGpx(gpx);
    if (!parsed.points.length) return showStatus('No route points found in this GPX file.', true);
    const title = els.routeTitleInput.value.trim() || parsed.name || file.name.replace(/\.gpx$/i, '');
    const creatorName = els.routeCreatorInput.value.trim() || authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'Unknown rider';
    const description = els.routeDescriptionInput.value.trim();
    const token = await getIdentityToken();

    const res = await fetch('/.netlify/functions/routes-upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({
        title,
        creatorName,
        description,
        gpx,
        distanceKm: parsed.distanceKm,
        startLat: parsed.start?.[0],
        startLon: parsed.start?.[1],
        endLat: parsed.end?.[0],
        endLon: parsed.end?.[1],
        bounds: parsed.bounds,
        pointCount: parsed.points.length
      })
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data?.error || 'Upload failed');
    els.routeUploadForm.reset();
    showStatus('Route uploaded.');
    setTimeout(hideStatus, 1200);
    await loadRoutes();
    if (data.route?.id) await showRoute(data.route.id);
  } catch (err) {
    console.error(err);
    showStatus(err.message || 'Could not upload this route.', true);
  }
}

async function showRoute(id) {
  const route = routes.find(r => r.id === id);
  showStatus(route ? `Loading ${route.title}...` : 'Loading route...');
  try {
    const data = await fetchJson(`/.netlify/functions/routes-get?id=${encodeURIComponent(id)}`);
    const parsed = parseGpx(data.gpx);
    if (!parsed.points.length) throw new Error('This route has no points.');
    activeRoute = { ...(route || data.route), points: parsed.points };
    drawRoute(parsed.points);
    if (els.clearRouteBtn) els.clearRouteBtn.hidden = false;
    renderRoutes();
    if (isTouchMapDevice()) setRoutePanelOpen(false);
    showStatus(route ? `${route.title} shown on the map.` : 'Route shown on the map.');
    setTimeout(hideStatus, 1200);
  } catch (err) {
    console.error(err);
    showStatus(err.message || 'Could not load this route.', true);
  }
}

async function deleteRoute(id) {
  const route = routes.find(r => r.id === id);
  if (!route) return showStatus('Route not found.', true);
  if (!authUser || !isOwnRoute(route)) return showStatus('You can only delete your own uploaded routes.', true);
  const confirmed = window.confirm(`Delete "${route.title || 'this route'}"? This cannot be undone.`);
  if (!confirmed) return;

  showStatus('Deleting route...');
  try {
    const token = await getIdentityToken();
    const res = await fetch('/.netlify/functions/routes-delete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ id })
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data?.error || 'Delete failed');
    if (activeRoute?.id === id) clearRoute();
    routes = routes.filter(r => r.id !== id);
    renderRoutes();
    showStatus('Route deleted.');
    setTimeout(hideStatus, 1200);
  } catch (err) {
    console.error(err);
    showStatus(err.message || 'Could not delete this route.', true);
  }
}

function drawRoute(points) {
  if (!routeLayer || !map) return;
  routeLayer.clearLayers();
  const line = L.polyline(points, {
    color: '#ffb21a',
    weight: 5,
    opacity: 0.92,
    lineJoin: 'round',
    lineCap: 'round',
    interactive: false,
    pane: 'routePane'
  }).addTo(routeLayer);
  const outline = L.polyline(points, {
    color: '#071018',
    weight: 8,
    opacity: 0.55,
    lineJoin: 'round',
    lineCap: 'round',
    interactive: false,
    pane: 'routePane'
  }).addTo(routeLayer);
  outline.bringToBack();
  line.bringToFront();
  map.fitBounds(line.getBounds(), { padding: [36, 36], animate: false, maxZoom: isTouchMapDevice() ? 12 : 16 });
  scheduleMapRefresh(120);
  startWind(false);
}

function clearRoute() {
  activeRoute = null;
  routeLayer?.clearLayers();
  if (els.clearRouteBtn) els.clearRouteBtn.hidden = true;
  renderRoutes();
}

function renderRoutes() {
  if (!els.routeList) return;
  const filtered = routeFilter === 'mine'
    ? routes.filter(route => authUser && route.ownerId === (authUser.id || authUser.sub))
    : routes;
  if (!filtered.length) {
    els.routeList.innerHTML = `<div class="route-empty">${routeFilter === 'mine' ? 'You have not uploaded any routes yet.' : 'No GPX routes uploaded yet.'}</div>`;
    return;
  }
  els.routeList.innerHTML = filtered.map(route => {
    const selected = activeRoute?.id === route.id;
    const owned = authUser && isOwnRoute(route);
    const weather = routeWeatherSummary(route);
    return `<article class="route-item ${selected ? 'selected' : ''}">
      <button type="button" class="route-view-btn" data-route-id="${escapeHtml(route.id)}" aria-label="Show ${escapeHtml(route.title || 'route')} on the map">
        <div class="route-title-row"><strong>${escapeHtml(route.title || 'Untitled route')}</strong><span>${formatKm(route.distanceKm)}</span></div>
        <div class="route-meta">Made by ${escapeHtml(route.creatorName || 'Unknown')} · ${formatRouteDate(route.createdAt)}</div>
        ${route.description ? `<div class="route-description">${escapeHtml(route.description)}</div>` : ''}
        <div class="route-weather">${weather}</div>
      </button>
      <div class="route-actions">
        <button type="button" class="route-download-btn" data-route-download-id="${escapeHtml(route.id)}" aria-label="Download ${escapeHtml(route.title || 'route')} GPX">Download GPX</button>
        ${owned ? `<button type="button" class="route-delete-btn" data-route-delete-id="${escapeHtml(route.id)}" aria-label="Delete ${escapeHtml(route.title || 'route')}">Delete</button>` : ''}
      </div>
    </article>`;
  }).join('');
  els.routeList.querySelectorAll('[data-route-id]').forEach(btn => btn.addEventListener('click', () => showRoute(btn.dataset.routeId)));
  els.routeList.querySelectorAll('[data-route-download-id]').forEach(btn => btn.addEventListener('click', event => {
    event.stopPropagation();
    downloadRoute(btn.dataset.routeDownloadId);
  }));
  els.routeList.querySelectorAll('[data-route-delete-id]').forEach(btn => btn.addEventListener('click', event => {
    event.stopPropagation();
    deleteRoute(btn.dataset.routeDeleteId);
  }));
}

async function downloadRoute(id) {
  const route = routes.find(r => r.id === id);
  showStatus(route ? `Preparing ${route.title}...` : 'Preparing GPX download...');
  try {
    const data = await fetchJson(`/.netlify/functions/routes-get?id=${encodeURIComponent(id)}`);
    const filename = `${slugifyFilename(data.route?.title || route?.title || 'mannen-fietsroute')}.gpx`;
    const blob = new Blob([data.gpx], { type: 'application/gpx+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showStatus('GPX download started.');
    setTimeout(hideStatus, 1200);
  } catch (err) {
    console.error(err);
    showStatus(err.message || 'Could not download this GPX route.', true);
  }
}

function routeWeatherSummary(route) {
  const distance = Number(route?.distanceFromSelectedKm);
  const selected = getSelectedForecastSummary();
  if (!selected?.summary) return 'Weather loading...';
  const s = selected.summary;
  return `${Math.round(s.wind)} km/h wind · ${Math.round(s.rainProb)}% rain · ${Math.round(s.temp)}°C · ${formatPollen(s.pollen)} pollen`;
}

function parseGpx(gpxText) {
  const xml = new DOMParser().parseFromString(gpxText, 'application/xml');
  const parserError = xml.querySelector('parsererror');
  if (parserError) throw new Error('This GPX file is not valid XML.');
  const name = xml.querySelector('trk > name, rte > name, metadata > name')?.textContent?.trim() || '';
  const nodes = [...xml.querySelectorAll('trkpt, rtept')];
  const points = nodes.map(node => [Number(node.getAttribute('lat')), Number(node.getAttribute('lon'))])
    .filter(([lat, lon]) => Number.isFinite(lat) && Number.isFinite(lon));
  let distanceKm = 0;
  for (let i = 1; i < points.length; i += 1) distanceKm += distanceBetweenKm(points[i - 1], points[i]);
  const bounds = points.length ? makeBounds(points) : null;
  return { name, points, distanceKm, start: points[0] || null, end: points[points.length - 1] || null, bounds };
}

function makeBounds(points) {
  const lats = points.map(p => p[0]);
  const lons = points.map(p => p[1]);
  return [[Math.min(...lats), Math.min(...lons)], [Math.max(...lats), Math.max(...lons)]];
}

function distanceBetweenKm(a, b) {
  const toRad = deg => deg * Math.PI / 180;
  const r = 6371;
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * r * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

async function getIdentityToken() {
  const user = window.netlifyIdentity?.currentUser?.() || window.netlifyIdentity?.gotrue?.currentUser?.() || authUser;
  const direct = await tokenFromIdentityUser(user);
  if (direct) return direct;

  // Netlify Identity stores the logged-in user in localStorage. Some widget/login paths
  // expose authUser to the UI but do not keep a fresh token on that object. This fallback
  // finds the real access_token so Functions can still confirm the user is logged in.
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i) || '';
      const raw = localStorage.getItem(key) || '';
      if (!raw || (!key.toLowerCase().includes('gotrue') && !key.toLowerCase().includes('netlify') && !raw.includes('access_token'))) continue;
      const parsed = JSON.parse(raw);
      const token = findAccessToken(parsed);
      if (token) return token;
    }
  } catch (err) {
    console.warn('Could not read Identity token from localStorage:', err);
  }
  return '';
}

async function tokenFromIdentityUser(user) {
  if (!user) return '';
  try {
    if (typeof user.jwt === 'function') {
      const refreshed = await user.jwt(true);
      if (refreshed) return refreshed;
    }
  } catch (err) {
    console.warn('Could not refresh Identity token:', err);
  }
  return findAccessToken(user);
}

function findAccessToken(value, depth = 0) {
  if (!value || depth > 5) return '';
  if (typeof value === 'string') return value.split('.').length === 3 ? value : '';
  if (typeof value !== 'object') return '';

  const direct = value.access_token || value.accessToken || value.jwt || value.token;
  if (typeof direct === 'string' && direct.split('.').length === 3) return direct;

  for (const child of Object.values(value)) {
    const found = findAccessToken(child, depth + 1);
    if (found) return found;
  }
  return '';
}

async function safeJson(res) {
  try { return await res.json(); } catch { return null; }
}

function formatKm(value) {
  const km = n(value);
  if (km <= 0) return '-- km';
  return `${km.toFixed(km < 10 ? 1 : 0)} km`;
}

function formatRouteDate(value) {
  const d = value ? new Date(value) : null;
  if (!d || Number.isNaN(d.getTime())) return 'just now';
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short' }).format(d);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[ch]));
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

  const rainAlpha = clamp(s.rainProb / 100, 0.08, 0.62);
  const windAlpha = clamp(s.wind / 55, 0.08, 0.55);
  const gradeClass = s.grade === 'good' ? 'good' : s.grade;
  const color = s.grade === 'good' ? '#35d07f' : s.grade === 'maybe' ? '#ffd45d' : '#ff6b6b';
  const center = [forecast.zone.lat, forecast.zone.lon];

  // Keep the selected-place ring locked to the city with a marker-based overlay.
  // Mobile pinch zoom can make large SVG meter-radius circles appear to lag behind the map.
  // A divIcon marker is positioned by Leaflet at the exact lat/lon every frame and stays visually anchored.
  L.marker(center, {
    interactive: false,
    keyboard: false,
    icon: L.divIcon({
      className: '',
      html: `<div class="selected-zone-ring ${gradeClass}"></div>`,
      iconSize: [92, 92],
      iconAnchor: [46, 46]
    })
  }).addTo(heatLayer);

  // Softer rain/wind pressure halos. These are circle markers in screen pixels instead of huge geographic
  // circles, which keeps them stable during mobile pinch zoom.
  L.circleMarker(center, {
    radius: 56,
    color: '#4bb3fd',
    fillColor: '#4bb3fd',
    fillOpacity: rainAlpha * 0.16,
    weight: 0,
    opacity: 0,
    interactive: false
  }).addTo(heatLayer);
  L.circleMarker(center, {
    radius: 34,
    color: '#b77cff',
    fillColor: '#b77cff',
    fillOpacity: windAlpha * 0.16,
    weight: 0,
    opacity: 0,
    interactive: false
  }).addTo(heatLayer);
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

  const windLineWidth = clamp(0.95 + gustKmh / 130, 1.05, 2.1);
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

    // Darker particles are much more visible on the new light cycling map.
    ctx.lineWidth = windLineWidth;
    ctx.strokeStyle = `rgba(7, 31, 48, ${clamp(alpha * 1.35, 0.08, 0.78)})`;
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
function formatTemp(value) { return `${Math.round(n(value))}°C`; }
function formatHumidity(value) { return `${Math.round(n(value))}%`; }
function formatUv(value) {
  const uv = n(value);
  if (uv <= 0) return '0';
  return uv < 10 ? uv.toFixed(1).replace(/\.0$/, '') : Math.round(uv).toString();
}
function pollenScore(values) {
  const thresholds = {
    alder: [10, 30, 50],
    birch: [10, 50, 100],
    grass: [5, 20, 50],
    mugwort: [5, 20, 50],
    olive: [10, 50, 100],
    ragweed: [3, 10, 30]
  };
  let best = { score: null, dominant: null, hasData: false };
  Object.entries(values || {}).forEach(([type, value]) => {
    if (!isFiniteNumber(value)) return;
    best.hasData = true;
    const [low, moderate, high] = thresholds[type] || [10, 50, 100];
    let score;
    if (value <= 0) score = 0;
    else if (value < low) score = (value / low) * 24;
    else if (value < moderate) score = 25 + ((value - low) / (moderate - low)) * 24;
    else if (value < high) score = 50 + ((value - moderate) / (high - moderate)) * 24;
    else score = clamp(75 + ((value - high) / high) * 25, 75, 100);
    if (best.score === null || score > best.score) best = { score, dominant: type, hasData: true };
  });
  return best;
}
function pollenRiskLevel(value) {
  if (!isFiniteNumber(value)) return { label: '--', penalty: 0 };
  const p = n(value);
  if (p < 30) return { label: 'Low', penalty: 0 };
  if (p < 65) return { label: 'Medium', penalty: 4 };
  return { label: 'High', penalty: 9 };
}
function formatPollen(value) {
  return pollenRiskLevel(value).label;
}
function pollenTypeLabel(type) {
  const labels = { alder: 'alder', birch: 'birch', grass: 'grass', mugwort: 'mugwort', olive: 'olive', ragweed: 'ragweed' };
  return labels[type] || type;
}
function dominantPollenType(items) {
  let best = { score: -1, dominant: null };
  items.forEach(item => {
    if (isFiniteNumber(item.pollen) && item.pollen > best.score) best = { score: item.pollen, dominant: item.pollenDominant || null };
  });
  return best.dominant;
}
function slugifyFilename(value) {
  return String(value || 'route')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'route';
}
function isFiniteNumber(x) { return Number.isFinite(Number(x)); }
function finiteOrNull(x) { return isFiniteNumber(x) ? Number(x) : null; }
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
