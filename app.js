/**
 * KIKES HUEVO PWA - Seccional Cauca (ALKA 1 + ALKA 2 + ALKA PALMAS)
 * Lee las 3 carpetas de Google Drive y almacena en SQLite (sql.js) optimizando por planta+fecha.
 */

const PLANTS = [
  {
    id: 'ALKA1',
    name: 'ALKA 1',
    subtitle: 'Producción 1 (PX1) y Producción 2 (PX2)',
    rangeLabel: 'Galpones 1–20',
    minGalpon: 1,
    maxGalpon: 20,
    color: '#2563eb',
    defaultFolderId: '1YH-koHjnW_SowWWF5bG_2YjTrjn_CHGo',
    sections: [
      { key: 'PX1', title: 'Producción 1 · PX1', rangeLabel: '1–10', minGalpon: 1, maxGalpon: 10 },
      { key: 'PX2', title: 'Producción 2 · PX2', rangeLabel: '11–20', minGalpon: 11, maxGalpon: 20 }
    ]
  },
  {
    id: 'ALKA2',
    name: 'ALKA 2',
    subtitle: 'Producción 3 · PX3',
    rangeLabel: 'Galpones 21–30',
    minGalpon: 21,
    maxGalpon: 30,
    color: '#f59e0b',
    defaultFolderId: '1pRKUndHR9qpDtfHAY__IIDChzHxxVUZl',
    sections: [
      { key: 'PX3', title: 'Producción 3 · PX3', rangeLabel: '21–30', minGalpon: 21, maxGalpon: 30 }
    ]
  },
  {
    id: 'PALMAS',
    name: 'ALKA PALMAS',
    subtitle: 'Producción Palmas · PXPALMAS',
    rangeLabel: 'Galpones 1–8',
    minGalpon: 1,
    maxGalpon: 8,
    color: '#2e9e22',
    defaultFolderId: '0AMF9kxJDWux9Uk9PVA',
    sections: [
      { key: 'PXPALMAS', title: 'Producción Palmas', rangeLabel: '1–8', minGalpon: 1, maxGalpon: 8 }
    ]
  }
];

const MQTT_TOPIC_DEFS = [
  { key: 'PX1', label: 'ALKA 1 · PX1 (1–10)', plantId: 'ALKA1', minGalpon: 1, maxGalpon: 10, defaultTopic: '@/KIKES/ALKA1/PX1/CONTEO' },
  { key: 'PX2', label: 'ALKA 1 · PX2 (11–20)', plantId: 'ALKA1', minGalpon: 11, maxGalpon: 20, defaultTopic: '@/KIKES/ALKA1/PX2/CONTEO' },
  { key: 'PX3', label: 'ALKA 2 · PX3 (21–30)', plantId: 'ALKA2', minGalpon: 21, maxGalpon: 30, defaultTopic: '@/KIKES/ALKA2/PX3/CONTEO' },
  { key: 'PXPALMAS', label: 'ALKA PALMAS (1–8)', plantId: 'PALMAS', minGalpon: 1, maxGalpon: 8, defaultTopic: '@/KIKES/ALKAPALMAS/PXPALMAS/CONTEO' }
];

const DEFAULT_MQTT_BROKER = 'wss://broker.emqx.io:8084/mqtt';

const CONFIG = {
  CLIENT_ID: '830764017290-lhj433d1luv0okqfefs1maba7omrjjjj.apps.googleusercontent.com',
  SCOPES: 'https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',
  STORAGE_KEYS: {
    AUTH_TOKEN: 'kikes_cauca_pwa_token',
    AUTH_EXPIRY: 'kikes_cauca_pwa_expiry',
    USER_INFO: 'kikes_cauca_pwa_user',
    FOLDERS: 'kikes_cauca_pwa_folders',
    AUTO_REFRESH_MIN: 'kikes_cauca_pwa_refresh_min',
    LAST_SYNC: 'kikes_cauca_pwa_last_sync',
    HOY_SOURCE: 'kikes_cauca_pwa_hoy_source',
    MQTT_CFG: 'kikes_cauca_pwa_mqtt_cfg',
    MQTT_TODAY: 'kikes_cauca_pwa_mqtt_today'
  }
};

function loadSavedFolders() {
  const saved = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.FOLDERS) || '{}');
  return {
    ALKA1: saved.ALKA1 || PLANTS[0].defaultFolderId,
    ALKA2: saved.ALKA2 || PLANTS[1].defaultFolderId,
    PALMAS: saved.PALMAS || PLANTS[2].defaultFolderId
  };
}

function loadSavedMqttCfg() {
  try {
    const saved = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.MQTT_CFG) || '{}');
    const topics = saved.topics || {};
    return {
      enabled: saved.enabled !== false,
      brokerUrl: String(saved.brokerUrl || DEFAULT_MQTT_BROKER).trim() || DEFAULT_MQTT_BROKER,
      topics: {
        PX1: String(topics.PX1 || MQTT_TOPIC_DEFS[0].defaultTopic).trim(),
        PX2: String(topics.PX2 || MQTT_TOPIC_DEFS[1].defaultTopic).trim(),
        PX3: String(topics.PX3 || MQTT_TOPIC_DEFS[2].defaultTopic).trim(),
        PXPALMAS: String(topics.PXPALMAS || MQTT_TOPIC_DEFS[3].defaultTopic).trim()
      }
    };
  } catch {
    return {
      enabled: true,
      brokerUrl: DEFAULT_MQTT_BROKER,
      topics: {
        PX1: MQTT_TOPIC_DEFS[0].defaultTopic,
        PX2: MQTT_TOPIC_DEFS[1].defaultTopic,
        PX3: MQTT_TOPIC_DEFS[2].defaultTopic,
        PXPALMAS: MQTT_TOPIC_DEFS[3].defaultTopic
      }
    };
  }
}

function loadSavedHoySource() {
  const s = localStorage.getItem(CONFIG.STORAGE_KEYS.HOY_SOURCE);
  return s === 'mqtt' || s === 'drive' || s === 'auto' ? s : 'auto';
}

const State = {
  accessToken: localStorage.getItem(CONFIG.STORAGE_KEYS.AUTH_TOKEN) || null,
  tokenExpiry: parseInt(localStorage.getItem(CONFIG.STORAGE_KEYS.AUTH_EXPIRY) || '0', 10),
  userInfo: JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.USER_INFO) || 'null'),
  folders: loadSavedFolders(),
  autoRefreshMin: parseInt(localStorage.getItem(CONFIG.STORAGE_KEYS.AUTO_REFRESH_MIN) || '5', 10),
  hoySource: loadSavedHoySource(),
  mqttCfg: loadSavedMqttCfg(),

  selectedPlant: 'TODAS',
  isSyncing: false,
  chart: null,
  autoRefreshTimer: null,
  filteredRows: [],

  // Datos en vivo recibidos hoy por MQTT (Map<'PX1'|'PX2'|'PX3'|'PXPALMAS', slot>)
  mqttDataByKey: new Map(),
  recentMqttChanges: new Map(),
  lastMqttTopicLabel: null,
  mqttState: 'offline'
};

let gisTokenClient = null;
let mqttClient = null;

// =============================================================================
// INICIALIZACIÓN
// =============================================================================
document.addEventListener('DOMContentLoaded', async () => {
  initServiceWorker();
  initEventListeners();
  applyPreset('7d', false);
  populateGalponFilter();
  initChart();
  loadMqttCacheIntoMemory();
  syncHoySourceButtons();
  updateUserUI();

  try {
    await CaucaSQLite.init();
    renderAllFromSqlite();
  } catch (err) {
    console.error('Error SQLite:', err);
    showToast('Error iniciando SQLite: ' + err.message, 'error');
  }

  connectMqttClient();

  const hasHash = await checkUrlHashToken();
  if (!hasHash) {
    if (State.accessToken && Date.now() < State.tokenExpiry) {
      updateUserUI();
      hideLoginModal();
      syncCaucaFromDrive(false);
    } else {
      showLoginModal();
    }
  }

  restartAutoRefreshTimer();
});

function initServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch((e) => console.warn('SW warning:', e));
  }
}

function getLocalDateStr(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function cleanFolderId(raw) {
  if (!raw) return '';
  const s = String(raw).trim();
  const idx = s.toLowerCase().indexOf('/folders/');
  if (idx >= 0) return s.slice(idx + 9).split(/[?/#&]/)[0].trim();
  return s.replace(/^[/\\]+|[/\\]+$/g, '');
}

function getPlantConfig(plantaId) {
  return PLANTS.find((p) => p.id === plantaId) || PLANTS[0];
}

// =============================================================================
// GOOGLE OAUTH2 (GIS)
// =============================================================================
function initGisAuthClient() {
  if (typeof google !== 'undefined' && google.accounts?.oauth2) {
    gisTokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CONFIG.CLIENT_ID,
      scope: CONFIG.SCOPES,
      callback: async (tokenRes) => {
        if (tokenRes.error) {
          showToast('Error Google Auth: ' + tokenRes.error, 'error');
          return;
        }
        if (tokenRes.access_token) {
          State.accessToken = tokenRes.access_token;
          State.tokenExpiry = Date.now() + (parseInt(tokenRes.expires_in || '3600', 10) * 1000) - 60000;
          localStorage.setItem(CONFIG.STORAGE_KEYS.AUTH_TOKEN, State.accessToken);
          localStorage.setItem(CONFIG.STORAGE_KEYS.AUTH_EXPIRY, State.tokenExpiry.toString());
          await fetchUserInfoAndSync();
        }
      }
    });
  }
}

function loginWithGoogle() {
  if (!gisTokenClient) initGisAuthClient();
  if (gisTokenClient) {
    gisTokenClient.requestAccessToken({ prompt: 'select_account' });
  } else {
    const redirectUri = window.location.origin + window.location.pathname;
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${encodeURIComponent(CONFIG.CLIENT_ID)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=token` +
      `&scope=${encodeURIComponent(CONFIG.SCOPES)}` +
      `&prompt=select_account`;
    window.location.href = authUrl;
  }
}

async function checkUrlHashToken() {
  const hash = window.location.hash.substring(1);
  if (!hash) return false;
  const params = new URLSearchParams(hash);
  const token = params.get('access_token');
  const expiresIn = parseInt(params.get('expires_in') || '3600', 10);
  if (!token) return false;

  State.accessToken = token;
  State.tokenExpiry = Date.now() + (expiresIn * 1000) - 60000;
  localStorage.setItem(CONFIG.STORAGE_KEYS.AUTH_TOKEN, State.accessToken);
  localStorage.setItem(CONFIG.STORAGE_KEYS.AUTH_EXPIRY, State.tokenExpiry.toString());
  window.history.replaceState(null, '', window.location.pathname);

  await fetchUserInfoAndSync();
  return true;
}

async function fetchUserInfoAndSync() {
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${State.accessToken}` }
    });
    if (res.ok) {
      State.userInfo = await res.json();
      localStorage.setItem(CONFIG.STORAGE_KEYS.USER_INFO, JSON.stringify(State.userInfo));
    }
  } catch { }
  updateUserUI();
  hideLoginModal();
  showToast('Sesión Google iniciada', 'success');
  syncCaucaFromDrive(false);
}

function logoutGoogle() {
  State.accessToken = null;
  State.tokenExpiry = 0;
  State.userInfo = null;
  localStorage.removeItem(CONFIG.STORAGE_KEYS.AUTH_TOKEN);
  localStorage.removeItem(CONFIG.STORAGE_KEYS.AUTH_EXPIRY);
  localStorage.removeItem(CONFIG.STORAGE_KEYS.USER_INFO);
  updateUserUI();
  showLoginModal();
}

function showLoginModal() {
  document.getElementById('loginOverlay')?.classList.remove('hidden');
}

function hideLoginModal() {
  document.getElementById('loginOverlay')?.classList.add('hidden');
}

function updateUserUI() {
  const email = State.userInfo?.email || 'Sin sesión';
  const name = State.userInfo?.name || email;
  document.getElementById('lblUserEmail').textContent = email;
  document.getElementById('userAvatar').textContent = name.charAt(0).toUpperCase();
  document.getElementById('settingsUserEmail').textContent = email;
  document.getElementById('inputFolderAlka1').value = State.folders.ALKA1;
  document.getElementById('inputFolderAlka2').value = State.folders.ALKA2;
  document.getElementById('inputFolderPalmas').value = State.folders.PALMAS;
  document.getElementById('inputAutoRefreshMin').value = State.autoRefreshMin;

  const lastSync = localStorage.getItem(CONFIG.STORAGE_KEYS.LAST_SYNC);
  document.getElementById('settingsLastSync').textContent =
    'Última sincronización: ' + (lastSync ? new Date(lastSync).toLocaleString() : '--');

  const chkMqtt = document.getElementById('chkMqttEnabled');
  if (chkMqtt) chkMqtt.checked = !!State.mqttCfg.enabled;
  const inBroker = document.getElementById('inputMqttBroker');
  if (inBroker) inBroker.value = State.mqttCfg.brokerUrl;
  const inPx1 = document.getElementById('inputMqttTopicPx1');
  if (inPx1) inPx1.value = State.mqttCfg.topics.PX1;
  const inPx2 = document.getElementById('inputMqttTopicPx2');
  if (inPx2) inPx2.value = State.mqttCfg.topics.PX2;
  const inPx3 = document.getElementById('inputMqttTopicPx3');
  if (inPx3) inPx3.value = State.mqttCfg.topics.PX3;
  const inPalmas = document.getElementById('inputMqttTopicPalmas');
  if (inPalmas) inPalmas.value = State.mqttCfg.topics.PXPALMAS;

  renderMqttDebugList();
}

// =============================================================================
// SUSCRIPCIÓN MQTT EN TIEMPO REAL (SOLO DÍA ACTUAL)
// =============================================================================
function loadMqttCacheIntoMemory() {
  try {
    const raw = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.MQTT_TODAY) || '{}');
    const todayStr = getLocalDateStr();
    State.mqttDataByKey.clear();
    for (const def of MQTT_TOPIC_DEFS) {
      const slot = raw[def.key];
      if (slot && slot.fecha === todayStr && slot.valuesObj) {
        const valuesByNum = {};
        let total = 0;
        for (let n = def.minGalpon; n <= def.maxGalpon; n++) {
          const val = Number(slot.valuesObj[n] || 0);
          valuesByNum[n] = val;
          total += val;
        }
        State.mqttDataByKey.set(def.key, {
          fecha: todayStr,
          valuesByNum,
          updatedAtByNum: slot.updatedAtByNum || {},
          total,
          raw: slot.raw || '',
          receivedAt: slot.receivedAt || null,
          isRetained: !!slot.isRetained,
          topic: slot.topic || State.mqttCfg.topics[def.key]
        });
      }
    }
  } catch {
    State.mqttDataByKey.clear();
  }
}

function persistMqttCache() {
  const todayStr = getLocalDateStr();
  const obj = {};
  for (const [key, slot] of State.mqttDataByKey.entries()) {
    if (slot.fecha === todayStr) {
      obj[key] = {
        fecha: slot.fecha,
        valuesObj: slot.valuesByNum,
        updatedAtByNum: slot.updatedAtByNum || {},
        raw: slot.raw,
        receivedAt: slot.receivedAt,
        isRetained: !!slot.isRetained,
        topic: slot.topic
      };
    }
  }
  localStorage.setItem(CONFIG.STORAGE_KEYS.MQTT_TODAY, JSON.stringify(obj));
}

function setMqttVisual(state, label) {
  State.mqttState = state;
  const dot = document.getElementById('mqttDot');
  const lbl = document.getElementById('lblMqttEstado');
  if (dot) {
    dot.classList.remove('online', 'connecting', 'offline');
    dot.classList.add(state);
  }
  if (lbl && label) lbl.textContent = label;
}

function flashMqttDot() {
  const dot = document.getElementById('mqttDot');
  if (!dot) return;
  dot.classList.add('flash');
  setTimeout(() => dot.classList.remove('flash'), 650);
}

function disconnectMqttClient() {
  if (mqttClient) {
    try {
      mqttClient.removeAllListeners();
      mqttClient.end(true);
    } catch { }
    mqttClient = null;
  }
}

function connectMqttClient() {
  disconnectMqttClient();

  if (!State.mqttCfg.enabled) {
    setMqttVisual('offline', 'MQTT apagado');
    renderMqttDebugList();
    return;
  }

  if (typeof mqtt === 'undefined' || typeof mqtt.connect !== 'function') {
    setMqttVisual('offline', 'MQTT lib no cargada');
    return;
  }

  const brokerUrl = State.mqttCfg.brokerUrl || DEFAULT_MQTT_BROKER;
  const topics = Array.from(new Set(
    MQTT_TOPIC_DEFS.map((d) => State.mqttCfg.topics[d.key]).filter(Boolean)
  ));
  if (topics.length === 0) {
    setMqttVisual('offline', 'MQTT sin tópicos');
    return;
  }

  setMqttVisual('connecting', 'MQTT: Conectando...');

  mqttClient = mqtt.connect(brokerUrl, {
    clientId: 'KIKES_CAUCA_PWA_' + Math.random().toString(16).slice(2, 8),
    clean: true,
    reconnectPeriod: 5000,
    connectTimeout: 12000
  });

  mqttClient.on('connect', () => {
    mqttClient.subscribe(topics, { qos: 0 }, (err) => {
      if (err) {
        setMqttVisual('offline', 'MQTT: Error suscr.');
        return;
      }
      updateMqttStatusLabel();
    });
  });

  mqttClient.on('reconnect', () => setMqttVisual('connecting', 'MQTT: Reconectando...'));
  mqttClient.on('close', () => {
    if (State.mqttCfg.enabled) setMqttVisual('connecting', 'MQTT: Esperando red');
  });
  mqttClient.on('error', () => setMqttVisual('offline', 'MQTT: Error conexión'));
  mqttClient.on('message', (topic, payloadBuffer, packet) => {
    handleIncomingMqttMessage(topic, payloadBuffer ? payloadBuffer.toString() : '', !!packet?.retain);
  });
}

function extractRawStringFromPayload(payloadStr) {
  const s = String(payloadStr || '').trim();
  if (!s) return '';
  if (s.startsWith('{')) {
    try {
      const obj = JSON.parse(s);
      if (obj && obj.value !== undefined && obj.value !== null) {
        return String(obj.value).trim();
      }
    } catch { }
  }
  return s;
}

function handleIncomingMqttMessage(topic, payloadStr, isRetained = false) {
  const matchingDefs = MQTT_TOPIC_DEFS.filter((d) => State.mqttCfg.topics[d.key] === topic);
  if (matchingDefs.length === 0) return;

  const raw = extractRawStringFromPayload(payloadStr);
  if (!raw) return;

  const parts = raw.split(/[|,;]/).map((p) => p.trim());
  if (parts.length === 0) return;

  const todayStr = getLocalDateStr();
  const nowIso = new Date().toISOString();
  let updated = false;

  for (const def of matchingDefs) {
    const prevSlot = State.mqttDataByKey.get(def.key);
    const sameDayPrev = prevSlot && prevSlot.fecha === todayStr ? prevSlot : null;
    const expectedCount = def.maxGalpon - def.minGalpon + 1;
    const valuesByNum = {};
    const updatedAtByNum = {};
    let total = 0;

    for (let i = 0; i < expectedCount; i++) {
      const galponNum = def.minGalpon + i;
      const cell = parts[i] !== undefined ? parts[i].replace(/[^\d-]/g, '') : '0';
      const val = parseInt(cell, 10) || 0;
      valuesByNum[galponNum] = val;
      total += val;

      const prevVal = sameDayPrev?.valuesByNum?.[galponNum];
      if (!sameDayPrev || prevVal !== val) {
        updatedAtByNum[galponNum] = nowIso;
        if (sameDayPrev) {
          State.recentMqttChanges.set(`${def.plantId}|${galponNum}`, Date.now());
        }
      } else {
        updatedAtByNum[galponNum] = sameDayPrev.updatedAtByNum?.[galponNum] || nowIso;
      }
    }

    State.mqttDataByKey.set(def.key, {
      fecha: todayStr,
      valuesByNum,
      updatedAtByNum,
      total,
      raw,
      receivedAt: nowIso,
      isRetained,
      topic
    });
    State.lastMqttTopicLabel = def.label;
    updated = true;
  }

  if (updated) {
    persistMqttCache();
    flashMqttDot();
    updateMqttStatusLabel();
    renderAllFromSqlite();
    setTimeout(() => {
      const cutoff = Date.now() - 5500;
      let cleaned = false;
      for (const [k, ts] of State.recentMqttChanges.entries()) {
        if (ts <= cutoff) {
          State.recentMqttChanges.delete(k);
          cleaned = true;
        }
      }
      if (cleaned) renderMonitorView();
    }, 5800);
  }
}

function updateMqttStatusLabel() {
  const todayStr = getLocalDateStr();
  let receivedCount = 0;
  let latestIso = null;

  for (const def of MQTT_TOPIC_DEFS) {
    const slot = State.mqttDataByKey.get(def.key);
    if (slot && slot.fecha === todayStr) {
      receivedCount++;
      if (slot.receivedAt && (!latestIso || slot.receivedAt > latestIso)) {
        latestIso = slot.receivedAt;
      }
    }
  }

  if (mqttClient && mqttClient.connected) {
    const timePart = latestIso
      ? ` · ${State.lastMqttTopicLabel ? State.lastMqttTopicLabel.split('(')[0].trim() + ' ' : ''}${new Date(latestIso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
      : '';
    setMqttVisual('online', `MQTT: ${receivedCount}/${MQTT_TOPIC_DEFS.length}${timePart}`);
  } else if (State.mqttCfg.enabled) {
    setMqttVisual('connecting', `MQTT (${receivedCount}/${MQTT_TOPIC_DEFS.length})`);
  } else {
    setMqttVisual('offline', 'MQTT apagado');
  }

  renderMqttDebugList();
}

function renderMqttDebugList() {
  const el = document.getElementById('mqttDebugList');
  if (!el) return;
  const todayStr = getLocalDateStr();

  el.innerHTML = MQTT_TOPIC_DEFS.map((def) => {
    const topic = State.mqttCfg.topics[def.key] || def.defaultTopic;
    const slot = State.mqttDataByKey.get(def.key);
    const activeToday = slot && slot.fecha === todayStr;
    const hora = activeToday && slot.receivedAt
      ? new Date(slot.receivedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      : 'Sin datos hoy';
    const rawPreview = activeToday ? `${slot.raw} (= ${slot.total.toLocaleString()})` : '--';

    return `
      <div class="mqtt-dbg-row">
        <div class="mqtt-dbg-top">
          <span>${escapeHtml(def.label)}</span>
          <span>${escapeHtml(hora)}</span>
        </div>
        <div class="mqtt-dbg-val">${escapeHtml(topic)}</div>
        <div class="mqtt-dbg-val">${escapeHtml(rawPreview)}</div>
      </div>
    `;
  }).join('');
}

function syncHoySourceButtons() {
  document.querySelectorAll('#hoySourceSeg .mseg-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.source === State.hoySource);
  });
}

// =============================================================================
// SINCRONIZACIÓN DRIVE (3 PLANTAS CAUCA -> SQLITE)
// =============================================================================
async function listDriveFilesInFolder(folderId, accessToken) {
  const files = [];
  let pageToken = null;

  do {
    const q = `'${folderId}' in parents and mimeType != 'application/vnd.google-apps.folder' and trashed=false`;
    let url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=nextPageToken,files(id,name,modifiedTime)&orderBy=name desc&pageSize=1000&supportsAllDrives=true&includeItemsFromAllDrives=true`;
    if (pageToken) url += `&pageToken=${encodeURIComponent(pageToken)}`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (res.status === 401) throw new Error('AUTH_EXPIRED');
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`HTTP ${res.status}: ${txt}`);
    }
    const data = await res.json();
    if (Array.isArray(data.files)) files.push(...data.files);
    pageToken = data.nextPageToken || null;
  } while (pageToken);

  return files;
}

function extractDateFromFileName(fileName) {
  const m = String(fileName).match(/(\d{4})(\d{2})(\d{2})\.csv$/i);
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

function splitCsvLine(line) {
  const out = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') inQ = !inQ;
    else if (ch === ',' && !inQ) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

function parseProductionCsv(csvText) {
  const clean = csvText.replace(/^\uFEFF/, '');
  const lines = clean.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length <= 1) return { galpones: [], totalPlanta: 0 };

  const galpones = [];
  let totalPlanta = null;

  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    if (cols.length < 5) continue;

    const gCol = String(cols[1]).trim().toUpperCase();
    const codigo = String(cols[2]).trim();
    const nombre = String(cols[3]).trim();
    const val = parseInt(String(cols[4]).replace(/[^\d-]/g, ''), 10) || 0;

    if (gCol === 'TOTAL' || codigo === 'TOTAL') {
      totalPlanta = val;
    } else {
      const num = parseInt(gCol, 10);
      if (!isNaN(num)) {
        galpones.push({
          numeroGalpon: num,
          codigoGalpon: codigo || `GALPON${num}`,
          nombreGalpon: nombre || `Galpón ${num}`,
          totalProduccion: val
        });
      }
    }
  }

  galpones.sort((a, b) => a.numeroGalpon - b.numeroGalpon);
  if (totalPlanta === null) {
    totalPlanta = galpones.reduce((acc, g) => acc + g.totalProduccion, 0);
  }
  return { galpones, totalPlanta };
}

async function syncSinglePlant(plant, todayStr, forceAll, targetDate) {
  const folderId = cleanFolderId(State.folders[plant.id]) || plant.defaultFolderId;
  if (!folderId) return { plant: plant.id, downloaded: 0, skipped: 0, error: null };

  const remoteFiles = await listDriveFilesInFolder(folderId, State.accessToken);
  const importedMap = CaucaSQLite.getImportedMapForPlant(plant.id);

  let downloaded = 0;
  let skipped = 0;

  for (const file of remoteFiles) {
    const fecha = extractDateFromFileName(file.name);
    if (!fecha) continue;
    if (targetDate && fecha !== targetDate) continue;

    const isToday = fecha === todayStr;
    const localMeta = importedMap.get(fecha);

    if (!forceAll && !targetDate && localMeta) {
      if (!isToday && localMeta.cerrada === 1) {
        skipped++;
        continue;
      }
      if (isToday && localMeta.modified_time === (file.modifiedTime || '')) {
        skipped++;
        continue;
      }
    }

    const dlUrl = `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media&supportsAllDrives=true`;
    const dlRes = await fetch(dlUrl, {
      headers: { Authorization: `Bearer ${State.accessToken}` }
    });
    if (!dlRes.ok) continue;

    const csvText = await dlRes.text();
    const { galpones, totalPlanta } = parseProductionCsv(csvText);
    const cerrarDia = fecha < todayStr;

    await CaucaSQLite.savePlantDay(plant.id, fecha, file, galpones, totalPlanta, cerrarDia);
    downloaded++;
  }

  return { plant: plant.id, downloaded, skipped, error: null };
}

async function syncCaucaFromDrive(forceAll = false, targetPlant = null, targetDate = null) {
  if (!State.accessToken || Date.now() >= State.tokenExpiry) {
    showLoginModal();
    return;
  }
  if (State.isSyncing) return;

  State.isSyncing = true;
  updateSyncPill('syncing', 'Sincronizando Cauca...');

  try {
    const todayStr = getLocalDateStr();
    const plantsToSync = targetPlant ? PLANTS.filter((p) => p.id === targetPlant) : PLANTS;

    let totalDownloaded = 0;
    let totalSkipped = 0;
    const errors = [];

    for (const plant of plantsToSync) {
      try {
        const res = await syncSinglePlant(plant, todayStr, forceAll, targetDate);
        totalDownloaded += res.downloaded;
        totalSkipped += res.skipped;
      } catch (err) {
        if (err.message === 'AUTH_EXPIRED') throw err;
        console.warn(`Error en carpeta ${plant.name}:`, err);
        errors.push(`${plant.name}: ${err.message}`);
      }
    }

    localStorage.setItem(CONFIG.STORAGE_KEYS.LAST_SYNC, new Date().toISOString());
    updateUserUI();
    renderAllFromSqlite();

    if (errors.length > 0 && totalDownloaded === 0 && totalSkipped === 0) {
      updateSyncPill('error', 'Error Drive');
      showToast(errors[0], 'error');
    } else {
      updateSyncPill('ready', 'Sincronizado');
      if (totalDownloaded > 0) {
        showToast(`Cauca actualizado: ${totalDownloaded} archivo(s) importado(s), ${totalSkipped} omitido(s).`, 'success');
      } else {
        showToast(`Cauca al día (${totalSkipped} archivo(s) ya en SQLite, 0 descargas).`, 'info');
      }
    }
  } catch (err) {
    if (err.message === 'AUTH_EXPIRED') {
      logoutGoogle();
      showToast('Sesión expirada. Inicia sesión nuevamente.', 'error');
    } else {
      updateSyncPill('error', 'Error Drive');
      showToast('Error Drive: ' + err.message, 'error');
    }
  } finally {
    State.isSyncing = false;
  }
}

function updateSyncPill(mode, text) {
  const pill = document.getElementById('syncStatusPill');
  const lbl = document.getElementById('syncStatusText');
  if (!pill || !lbl) return;
  pill.classList.remove('syncing', 'error');
  if (mode === 'syncing') pill.classList.add('syncing');
  if (mode === 'error') pill.classList.add('error');
  lbl.textContent = text;
}

// =============================================================================
// RESOLUCIÓN POR GALPÓN (SOLO DÍA ACTUAL: AUTO / MQTT / ARCHIVOS) Y EFECTOS VISUALES
// =============================================================================
const MONITOR_LAST_SHOWN = {
  kpiScope: null,
  kpiDate: null,
  kpiTotalHoy: null,
  alka1: null,
  alka2: null,
  palmas: null,
  monitorFecha: null,
  plantCardTotals: { ALKA1: null, ALKA2: null, PALMAS: null }
};
const FLASH_TIMERS = new WeakMap();

/**
 * Dispara animación visual temporal sobre un elemento (Header Totalizador o Card de Planta).
 */
function triggerChangeFlash(el) {
  if (!el) return;
  const prevTimer = FLASH_TIMERS.get(el);
  if (prevTimer) clearTimeout(prevTimer);

  el.classList.remove('val-changed');
  void el.offsetWidth;
  el.classList.add('val-changed');

  const tid = setTimeout(() => {
    el.classList.remove('val-changed');
    FLASH_TIMERS.delete(el);
  }, 1900);
  FLASH_TIMERS.set(el, tid);
}

function selectGalponReadingToday(sqliteRow, sqliteTime, mqttSlot, galponNum, mode) {
  const driveVal = sqliteRow ? Number(sqliteRow.total_produccion || 0) : null;
  const hasMqtt = !!mqttSlot;
  const mqttVal = hasMqtt ? Number(mqttSlot.valuesByNum[galponNum] || 0) : null;
  const mqttTime = hasMqtt ? (mqttSlot.updatedAtByNum?.[galponNum] || mqttSlot.receivedAt) : null;

  if (mode === 'mqtt') {
    return { val: mqttVal ?? 0, source: hasMqtt ? 'MQTT' : 'NONE', updatedAt: mqttTime, diffVsDrive: 0 };
  }
  if (mode === 'drive') {
    return { val: driveVal ?? 0, source: sqliteRow ? 'DRIVE' : 'NONE', updatedAt: sqliteTime, diffVsDrive: 0 };
  }

  // Modo AUTO: decide por cada galpón hoy
  if (!hasMqtt && !sqliteRow) return { val: 0, source: 'NONE', updatedAt: null, diffVsDrive: 0 };
  if (hasMqtt && !sqliteRow) return { val: mqttVal, source: 'MQTT', updatedAt: mqttTime, diffVsDrive: 0 };
  if (!hasMqtt && sqliteRow) return { val: driveVal, source: 'DRIVE', updatedAt: sqliteTime, diffVsDrive: 0 };

  if (mqttVal === 0 && driveVal > 0) {
    return { val: driveVal, source: 'DRIVE', updatedAt: sqliteTime, diffVsDrive: 0 };
  }

  const isLiveNewer = !mqttSlot.isRetained && mqttTime && sqliteTime && mqttTime >= sqliteTime;
  if (isLiveNewer || mqttVal >= driveVal) {
    return {
      val: mqttVal,
      source: 'MQTT',
      updatedAt: mqttTime,
      diffVsDrive: driveVal > 0 ? (mqttVal - driveVal) : 0
    };
  }

  return { val: driveVal, source: 'DRIVE', updatedAt: sqliteTime, diffVsDrive: 0 };
}

function getSourceBadgeMeta(source) {
  if (source === 'MQTT') return { cls: 'src-mqtt', text: 'MQTT' };
  if (source === 'DRIVE') return { cls: 'src-drive', text: 'Archivo' };
  if (source === 'MIX') return { cls: 'src-mix', text: 'MQTT+Arch' };
  return { cls: 'src-none', text: 'Sin dato' };
}

function getEffectivePlantDay(plantaId, fecha, preloadedSqliteRows = null, importedMapCache = null) {
  const todayStr = getLocalDateStr();
  const plant = getPlantConfig(plantaId);
  const sqliteRows = preloadedSqliteRows || CaucaSQLite.getDayData(fecha, plantaId);
  const importedMap = importedMapCache || CaucaSQLite.getImportedMapForPlant(plantaId);
  const meta = importedMap.get(fecha);
  const sqliteTime = meta?.modified_time || null;

  // Fechas pasadas o modo Archivos/SQLite salen exclusivamente de SQLite
  if (fecha !== todayStr || State.hoySource === 'drive') {
    const totalP = sqliteRows.reduce((s, r) => s + Number(r.total_produccion || 0), 0);
    const activosP = sqliteRows.filter((r) => Number(r.total_produccion || 0) > 0).length;
    const hasData = sqliteRows.length > 0;
    return {
      planta: plantaId,
      fecha,
      rows: sqliteRows.map((r) => ({ ...r, source: 'DRIVE', updatedAt: sqliteTime, diffVsDrive: 0 })),
      total: totalP,
      activos: activosP,
      diffVsDrive: 0,
      source: hasData ? 'DRIVE' : 'NONE',
      latestMod: sqliteTime
    };
  }

  const sqliteByNum = new Map(sqliteRows.map((r) => [Number(r.numero_galpon), r]));
  const topicDefs = MQTT_TOPIC_DEFS.filter((d) => d.plantId === plantaId);
  const rows = [];
  let total = 0;
  let activos = 0;
  let diffTotal = 0;
  let mqttCount = 0;
  let driveCount = 0;
  let latestMod = null;

  for (const def of topicDefs) {
    const slot = State.mqttDataByKey.get(def.key);
    const mqttSlot = slot && slot.fecha === todayStr ? slot : null;

    for (let n = def.minGalpon; n <= def.maxGalpon; n++) {
      const sRow = sqliteByNum.get(n);
      const picked = selectGalponReadingToday(sRow, sqliteTime, mqttSlot, n, State.hoySource);
      if (picked.source === 'MQTT') mqttCount++;
      else if (picked.source === 'DRIVE') driveCount++;

      if (picked.updatedAt && (!latestMod || picked.updatedAt > latestMod)) {
        latestMod = picked.updatedAt;
      }

      total += picked.val;
      if (picked.val > 0) activos++;
      if (picked.source === 'MQTT' && picked.diffVsDrive > 0) diffTotal += picked.diffVsDrive;

      rows.push({
        planta: plantaId,
        fecha,
        numero_galpon: n,
        codigo_galpon: sRow?.codigo_galpon || `GALPON${n}`,
        nombre_galpon: sRow?.nombre_galpon || `Galpón ${n}`,
        total_produccion: picked.val,
        source: picked.source,
        updatedAt: picked.updatedAt,
        diffVsDrive: picked.diffVsDrive
      });
    }
  }

  let source = 'NONE';
  if (mqttCount > 0 && driveCount > 0) source = 'MIX';
  else if (mqttCount > 0) source = 'MQTT';
  else if (driveCount > 0) source = 'DRIVE';

  rows.sort((a, b) => a.numero_galpon - b.numero_galpon);
  return { planta: plantaId, fecha, rows, total, activos, diffVsDrive: diffTotal, source, latestMod };
}

function getEffectiveTodayRows(plantaFilter = 'TODAS', numeroGalpon = 0) {
  const todayStr = getLocalDateStr();
  const targetPlants = plantaFilter === 'TODAS' ? PLANTS : PLANTS.filter((p) => p.id === plantaFilter);
  const out = [];
  for (const p of targetPlants) {
    const eff = getEffectivePlantDay(p.id, todayStr);
    for (const r of eff.rows) {
      if (r.source === 'NONE') continue;
      if (numeroGalpon > 0 && Number(r.numero_galpon) !== numeroGalpon) continue;
      out.push(r);
    }
  }
  return out;
}

function getEffectiveProductionRows(planta = 'TODAS', ini = null, fin = null, galpon = 0) {
  const baseRows = CaucaSQLite.queryProduction(planta, ini || null, fin || null, galpon);
  if (State.hoySource === 'drive') return baseRows;

  const todayStr = getLocalDateStr();
  const inRange = (!ini || todayStr >= ini) && (!fin || todayStr <= fin);
  if (!inRange) return baseRows;

  const withoutToday = baseRows.filter((r) => r.fecha !== todayStr);
  const effectiveToday = getEffectiveTodayRows(planta, galpon);
  return [...effectiveToday, ...withoutToday].sort(
    (a, b) => b.fecha.localeCompare(a.fecha) || a.planta.localeCompare(b.planta) || a.numero_galpon - b.numero_galpon
  );
}

function updateKpiHeaderToday(todayStr, scope, hoyDisplay, diffHoyDisplay, hoySourceTag, tAlka1, tAlka2, tPalmas) {
  const cardEl = document.getElementById('kpiCardHoy');
  const totalEl = document.getElementById('kpiTotalHoy');
  const srcTagEl = document.getElementById('kpiHoySrcTag');
  const bdEl = document.getElementById('kpiHoyBreakdown');

  const diffHtml = diffHoyDisplay > 0
    ? ` <small class="kpi-diff-badge">+${diffHoyDisplay.toLocaleString()}</small>`
    : '';
  totalEl.innerHTML = `${hoyDisplay.toLocaleString()} <span>Und</span>${diffHtml}`;

  if (srcTagEl) {
    if (hoySourceTag && hoySourceTag !== 'NONE') {
      const meta = getSourceBadgeMeta(hoySourceTag);
      srcTagEl.textContent = meta.text;
      srcTagEl.classList.remove('hidden');
    } else {
      srcTagEl.classList.add('hidden');
    }
  }

  bdEl.innerHTML =
    `<span class="kpi-plant-part" data-plant="ALKA1">ALKA 1: ${tAlka1.toLocaleString()}</span> · ` +
    `<span class="kpi-plant-part" data-plant="ALKA2">ALKA 2: ${tAlka2.toLocaleString()}</span> · ` +
    `<span class="kpi-plant-part" data-plant="PALMAS">PALMAS: ${tPalmas.toLocaleString()}</span>`;

  const sameDate = MONITOR_LAST_SHOWN.kpiDate === todayStr;
  if (sameDate) {
    const totalChanged = MONITOR_LAST_SHOWN.kpiScope === scope && MONITOR_LAST_SHOWN.kpiTotalHoy !== hoyDisplay;
    const alka1Changed = MONITOR_LAST_SHOWN.alka1 !== tAlka1;
    const alka2Changed = MONITOR_LAST_SHOWN.alka2 !== tAlka2;
    const palmasChanged = MONITOR_LAST_SHOWN.palmas !== tPalmas;

    if (totalChanged) {
      triggerChangeFlash(cardEl);
      triggerChangeFlash(totalEl);
    } else if (alka1Changed || alka2Changed || palmasChanged) {
      triggerChangeFlash(cardEl);
    }

    if (alka1Changed) triggerChangeFlash(bdEl.querySelector('[data-plant="ALKA1"]'));
    if (alka2Changed) triggerChangeFlash(bdEl.querySelector('[data-plant="ALKA2"]'));
    if (palmasChanged) triggerChangeFlash(bdEl.querySelector('[data-plant="PALMAS"]'));
  }

  MONITOR_LAST_SHOWN.kpiScope = scope;
  MONITOR_LAST_SHOWN.kpiDate = todayStr;
  MONITOR_LAST_SHOWN.kpiTotalHoy = hoyDisplay;
  MONITOR_LAST_SHOWN.alka1 = tAlka1;
  MONITOR_LAST_SHOWN.alka2 = tAlka2;
  MONITOR_LAST_SHOWN.palmas = tPalmas;
}

// =============================================================================
// RENDERIZADO DESDE SQLITE + MQTT (HOY)
// =============================================================================
function renderAllFromSqlite() {
  const todayStr = getLocalDateStr();
  const stats = CaucaSQLite.getSummaryStats(todayStr);
  const sizeKb = CaucaSQLite.getDatabaseSizeKb();

  const ini = document.getElementById('filtroFechaInicio').value;
  const fin = document.getElementById('filtroFechaFin').value;
  const galpon = parseInt(document.getElementById('filtroGalpon').value || '0', 10);

  State.filteredRows = getEffectiveProductionRows(State.selectedPlant, ini || null, fin || null, galpon);

  // Totales efectivos de hoy por planta (SQLite + MQTT según modo)
  const effAlka1 = getEffectivePlantDay('ALKA1', todayStr);
  const effAlka2 = getEffectivePlantDay('ALKA2', todayStr);
  const effPalmas = getEffectivePlantDay('PALMAS', todayStr);
  const effByPlant = { ALKA1: effAlka1, ALKA2: effAlka2, PALMAS: effPalmas };

  const tAlka1 = effAlka1.total;
  const tAlka2 = effAlka2.total;
  const tPalmas = effPalmas.total;
  const totalHoyCauca = tAlka1 + tAlka2 + tPalmas;

  let hoyDisplay = totalHoyCauca;
  let diffHoyDisplay = effAlka1.diffVsDrive + effAlka2.diffVsDrive + effPalmas.diffVsDrive;
  let activosDisplay = effAlka1.activos + effAlka2.activos + effPalmas.activos;
  let capacidadGalpones = 38;
  let hoySourceTag = 'NONE';

  const visibleSources = (State.selectedPlant === 'TODAS' ? PLANTS : PLANTS.filter((p) => p.id === State.selectedPlant))
    .map((p) => effByPlant[p.id].source)
    .filter((s) => s !== 'NONE');
  if (visibleSources.includes('MIX') || (visibleSources.includes('MQTT') && visibleSources.includes('DRIVE'))) {
    hoySourceTag = 'MIX';
  } else if (visibleSources.includes('MQTT')) {
    hoySourceTag = 'MQTT';
  } else if (visibleSources.includes('DRIVE')) {
    hoySourceTag = 'DRIVE';
  }

  if (State.selectedPlant !== 'TODAS') {
    const pCfg = getPlantConfig(State.selectedPlant);
    const pEff = effByPlant[State.selectedPlant];
    hoyDisplay = pEff.total;
    diffHoyDisplay = pEff.diffVsDrive;
    activosDisplay = pEff.activos;
    capacidadGalpones = pCfg.maxGalpon - pCfg.minGalpon + 1;
    document.getElementById('kpiHoyTitle').textContent = `TOTAL ${pCfg.name} HOY`;
  } else {
    document.getElementById('kpiHoyTitle').textContent = 'TOTAL CAUCA HOY';
  }

  updateKpiHeaderToday(todayStr, State.selectedPlant, hoyDisplay, diffHoyDisplay, hoySourceTag, tAlka1, tAlka2, tPalmas);

  const totalPeriodo = State.filteredRows.reduce((s, r) => s + Number(r.total_produccion || 0), 0);
  const diasUnicos = new Set(State.filteredRows.map((r) => r.fecha)).size;
  const promDia = diasUnicos > 0 ? Math.round(totalPeriodo / diasUnicos) : 0;

  document.getElementById('kpiTotalPeriodo').innerHTML = `${totalPeriodo.toLocaleString()} <span>Und</span>`;
  document.getElementById('kpiPeriodoSub').textContent =
    `${diasUnicos} día(s) · ${State.selectedPlant === 'TODAS' ? '3 plantas Cauca' : getPlantConfig(State.selectedPlant).name}`;
  document.getElementById('kpiGalponesActivos').textContent = `${activosDisplay} / ${capacidadGalpones}`;
  document.getElementById('kpiPromedioDiaSub').textContent = `Prom. diario: ${promDia.toLocaleString()} Und`;
  document.getElementById('kpiSqliteDias').innerHTML = `${stats.totalRegistrosImportados} <span>Reg</span>`;
  document.getElementById('kpiSqliteSub').textContent = `${stats.registrosCerrados} cerrados · ${sizeKb} KB`;
  document.getElementById('lblSqliteBadge').textContent = `SQLite: ${stats.diasUnicos} días`;

  const deltaHoyVsSqlite = totalHoyCauca - stats.totalHoyCauca;
  document.getElementById('totalUltimos7Dias').textContent = (stats.total7DiasCauca + deltaHoyVsSqlite).toLocaleString();
  document.getElementById('totalMesActual').textContent = (stats.totalMesCauca + deltaHoyVsSqlite).toLocaleString();

  populateMonitorDateSelector(todayStr);
  renderMonitorView();
  renderConsolidado();
  renderDetallePorGalpon();
  renderSqliteControlTab(sizeKb, stats);
}

function populateMonitorDateSelector(todayStr) {
  const select = document.getElementById('selectFechaMonitor');
  const prev = select.value;
  const metas = CaucaSQLite.getAllImportedMeta();
  const uniqueDates = Array.from(new Set(metas.map((m) => m.fecha))).sort((a, b) => b.localeCompare(a));
  if (!uniqueDates.includes(todayStr)) uniqueDates.unshift(todayStr);

  select.innerHTML = uniqueDates
    .map((f) => `<option value="${f}">${f === todayStr ? `${f} (Hoy)` : f}</option>`)
    .join('');

  select.value = uniqueDates.includes(prev) ? prev : uniqueDates[0];
}

function buildPlantSectionRender(plant, section, byNum, totalPlanta, recentCutoff) {
  const cards = [];
  let sectionTotal = 0;
  let sectionDiff = 0;
  let mqttCount = 0;
  let driveCount = 0;

  for (let n = section.minGalpon; n <= section.maxGalpon; n++) {
    const r = byNum.get(n);
    const val = Number(r?.total_produccion || 0);
    sectionTotal += val;

    const gSrc = r?.source || 'NONE';
    if (gSrc === 'MQTT') {
      mqttCount++;
      if (r?.diffVsDrive > 0) sectionDiff += r.diffVsDrive;
    } else if (gSrc === 'DRIVE') {
      driveCount++;
    }

    const pct = totalPlanta > 0 ? ((val / totalPlanta) * 100).toFixed(1) : '0.0';
    const recentTs = State.recentMqttChanges.get(`${plant.id}|${n}`) || 0;
    const isFlash = gSrc === 'MQTT' && recentTs > recentCutoff;
    const timeStr = r?.updatedAt
      ? new Date(r.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '';

    const hasDiff = gSrc === 'MQTT' && r?.diffVsDrive > 0;
    const badgeHtml = hasDiff
      ? `<span class="galpon-code tag-mqtt">+${r.diffVsDrive.toLocaleString()}</span>`
      : '';

    let footerTxt = `${pct}% de ${plant.name}`;
    if (gSrc === 'MQTT') {
      footerTxt = `${pct}% · MQTT ${timeStr}`;
    } else if (gSrc === 'DRIVE') {
      footerTxt = `${pct}% · Archivo${timeStr ? ' ' + timeStr : ''}`;
    }

    cards.push(`
      <div class="galpon-card p-${plant.id} ${val === 0 ? 'sin-dato' : ''} ${gSrc === 'MQTT' ? 'is-mqtt' : ''} ${isFlash ? 'mqtt-flash' : ''}">
        <div class="galpon-card-top">
          <span class="galpon-name">${escapeHtml(r?.nombre_galpon || `Galpón ${n}`)}</span>
          ${badgeHtml}
        </div>
        <div class="galpon-value">${val.toLocaleString()}</div>
        <div class="galpon-bar-track">
          <div class="galpon-bar-fill" style="width:${Math.min(100, Number(pct))}%;background:${plant.color};"></div>
        </div>
        <div class="galpon-share ${gSrc === 'MQTT' ? 'is-mqtt-txt' : ''}">${escapeHtml(footerTxt)}</div>
      </div>
    `);
  }

  let sectionSource = 'NONE';
  if (mqttCount > 0 && driveCount > 0) sectionSource = 'MIX';
  else if (mqttCount > 0) sectionSource = 'MQTT';
  else if (driveCount > 0) sectionSource = 'DRIVE';

  return { cardsHtml: cards.join(''), total: sectionTotal, diff: sectionDiff, source: sectionSource };
}

function renderMonitorView() {
  const todayStr = getLocalDateStr();
  const fecha = document.getElementById('selectFechaMonitor').value || todayStr;
  const isToday = fecha === todayStr;
  const modeLabel = isToday ? (State.hoySource === 'mqtt' ? 'Solo MQTT' : State.hoySource === 'drive' ? 'Solo SQLite/Drive' : 'Auto MQTT+SQLite') : 'Histórico SQLite';
  document.getElementById('lblMonitorFecha').textContent = `Mostrando fecha: ${fecha} · ${modeLabel}`;

  const allDayRows = CaucaSQLite.getDayData(fecha, 'TODAS');
  const rawByPlant = { ALKA1: [], ALKA2: [], PALMAS: [] };
  for (const r of allDayRows) {
    if (rawByPlant[r.planta]) rawByPlant[r.planta].push(r);
  }

  const effByPlant = {};
  for (const p of PLANTS) {
    effByPlant[p.id] = getEffectivePlantDay(p.id, fecha, rawByPlant[p.id]);
  }

  const changedPlantIds = [];
  const sameMonitorFecha = MONITOR_LAST_SHOWN.monitorFecha === fecha;

  // Tarjetas resumen de las 3 plantas (con detección de cambio para animar las cards)
  const summaryCards = PLANTS.map((p) => {
    const eff = effByPlant[p.id];
    const totalP = eff.total;
    const activosP = eff.activos;
    const cap = p.maxGalpon - p.minGalpon + 1;
    const isSel = State.selectedPlant === p.id;
    const badge = getSourceBadgeMeta(eff.source);
    const diffHtml = eff.diffVsDrive > 0 ? `<span class="ps-diff">(+${eff.diffVsDrive.toLocaleString()})</span>` : '';
    const timeStr = eff.latestMod
      ? new Date(eff.latestMod).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '';
    const timePart = timeStr ? ` · ${eff.source === 'MQTT' || eff.source === 'MIX' ? 'MQTT' : 'Act.'} ${timeStr}` : '';

    if (sameMonitorFecha && MONITOR_LAST_SHOWN.plantCardTotals[p.id] !== totalP) {
      changedPlantIds.push(p.id);
    }
    MONITOR_LAST_SHOWN.plantCardTotals[p.id] = totalP;

    return `
      <div class="plant-summary-card p-${p.id.toLowerCase()} ${eff.source === 'MQTT' || eff.source === 'MIX' ? 'is-mqtt' : ''} ${isSel ? 'selected' : ''}" data-planta="${p.id}" onclick="window.selectPlantFilter('${p.id}')">
        <div class="ps-top">
          <span class="ps-name">${p.name}</span>
          <div class="ps-badges">
            <span class="src-pill ${badge.cls}">${badge.text}</span>
            <span class="ps-range">${p.rangeLabel}</span>
          </div>
        </div>
        <div class="ps-val-row">
          <div class="ps-val">${totalP.toLocaleString()}</div>
          ${diffHtml}
        </div>
        <div class="ps-sub">${p.subtitle} · ${activosP}/${cap} galpones${timePart}</div>
      </div>
    `;
  }).join('');

  MONITOR_LAST_SHOWN.monitorFecha = fecha;
  const gridResumen = document.getElementById('gridResumenPlantas');
  gridResumen.innerHTML = summaryCards;
  for (const pId of changedPlantIds) {
    triggerChangeFlash(gridResumen.querySelector(`.plant-summary-card[data-planta="${pId}"]`));
  }

  // Secciones de galpones según planta seleccionada (dividiendo PX1 y PX2 en ALKA 1)
  const visiblePlants = State.selectedPlant === 'TODAS' ? PLANTS : PLANTS.filter((p) => p.id === State.selectedPlant);
  const recentCutoff = Date.now() - 5500;
  let totalVisible = 0;

  const sectionsHtml = visiblePlants.map((p) => {
    const eff = effByPlant[p.id];
    const totalP = eff.total;
    totalVisible += totalP;
    const badge = getSourceBadgeMeta(eff.source);
    const byNum = new Map((eff.rows || []).map((r) => [Number(r.numero_galpon), r]));
    const sections = p.sections || [{ key: p.id, title: p.subtitle, rangeLabel: p.rangeLabel, minGalpon: p.minGalpon, maxGalpon: p.maxGalpon }];
    const splitBySection = sections.length > 1;

    const renderedSections = sections.map((sec) => ({
      sec,
      rendered: buildPlantSectionRender(p, sec, byNum, totalP, recentCutoff)
    }));
    const diffP = renderedSections.reduce((s, item) => s + item.rendered.diff, 0);

    const innerHtml = renderedSections.map(({ sec, rendered }) => {
      if (!splitBySection) {
        return `<div class="galpones-grid">${rendered.cardsHtml}</div>`;
      }
      const secBadge = getSourceBadgeMeta(rendered.source);
      return `
        <div class="prod-subsection">
          <div class="prod-subhead">
            <span class="prod-sub-title">${escapeHtml(sec.title)} (${sec.rangeLabel})</span>
            <div class="prod-sub-right">
              <span class="src-pill ${secBadge.cls}">${secBadge.text}</span>
              <span>${rendered.total.toLocaleString()} huevos</span>
              ${rendered.diff > 0 ? `<span class="pb-diff">(+${rendered.diff.toLocaleString()})</span>` : ''}
            </div>
          </div>
          <div class="galpones-grid">${rendered.cardsHtml}</div>
        </div>
      `;
    }).join('');

    return `
      <div class="plant-section">
        <div class="plant-section-header">
          <div class="plant-section-title">
            <span class="plant-dot dot-${p.id}"></span>
            <span>${p.name}</span>
            <span class="panel-sub">(${p.rangeLabel} · ${p.subtitle})</span>
          </div>
          <div class="plant-section-right">
            <span class="src-pill ${badge.cls}">${badge.text}</span>
            <div><strong>${totalP.toLocaleString()}</strong> huevos</div>
            ${diffP > 0 ? `<span class="pb-diff">(+${diffP.toLocaleString()})</span>` : ''}
          </div>
        </div>
        ${innerHtml}
      </div>
    `;
  }).join('');

  document.getElementById('contenedorGalponesPorPlanta').innerHTML = sectionsHtml;
  document.getElementById('totalDiaSeleccionado').textContent = totalVisible.toLocaleString();
}

window.selectPlantFilter = (plantaId) => {
  State.selectedPlant = State.selectedPlant === plantaId ? 'TODAS' : plantaId;
  syncPlantPillsUI();
  populateGalponFilter();
  renderAllFromSqlite();
};

function syncPlantPillsUI() {
  document.querySelectorAll('#plantPills .plant-pill').forEach((b) => {
    b.classList.toggle('active', b.dataset.planta === State.selectedPlant);
  });
}

function populateGalponFilter() {
  const select = document.getElementById('filtroGalpon');
  const prev = select.value;
  const opts = ['<option value="0">Todos los Galpones</option>'];

  if (State.selectedPlant === 'TODAS') {
    for (let n = 1; n <= 30; n++) {
      opts.push(`<option value="${n}">Galpón ${n}</option>`);
    }
  } else {
    const p = getPlantConfig(State.selectedPlant);
    for (let n = p.minGalpon; n <= p.maxGalpon; n++) {
      opts.push(`<option value="${n}">Galpón ${n}</option>`);
    }
  }
  select.innerHTML = opts.join('');
  if (Array.from(select.options).some((o) => o.value === prev)) {
    select.value = prev;
  }
}

function renderConsolidado() {
  const mode = document.getElementById('selectAgrupar').value;
  const rows = State.filteredRows;
  const thead = document.getElementById('theadConsolidado');
  const tbody = document.getElementById('tbodyConsolidado');

  let totalGlobal = 0;

  if (mode === 'dia_galpon') {
    thead.innerHTML = `
      <tr>
        <th>Fecha</th>
        <th>Planta</th>
        <th>Galpón</th>
        <th>Código</th>
        <th class="text-right">Total Producido</th>
      </tr>`;

    tbody.innerHTML = rows.length === 0
      ? `<tr><td colspan="5" style="text-align:center;padding:20px;color:#64748b;">Sin registros en SQLite para el filtro seleccionado.</td></tr>`
      : rows.map((r) => {
          totalGlobal += Number(r.total_produccion || 0);
          return `
            <tr>
              <td><strong>${r.fecha}</strong></td>
              <td><span class="badge badge-${r.planta}">${r.planta}</span></td>
              <td>${escapeHtml(r.nombre_galpon)}</td>
              <td>${escapeHtml(r.codigo_galpon)}</td>
              <td class="text-right"><strong>${Number(r.total_produccion).toLocaleString()}</strong></td>
            </tr>`;
        }).join('');
    document.getElementById('footerTotalRegistros').textContent = `Total registros: ${rows.length}`;
  } else if (mode === 'dia_planta') {
    const map = new Map();
    for (const r of rows) {
      const k = `${r.fecha}|${r.planta}`;
      if (!map.has(k)) map.set(k, { fecha: r.fecha, planta: r.planta, total: 0, galpones: 0 });
      const it = map.get(k);
      it.total += Number(r.total_produccion || 0);
      if (Number(r.total_produccion || 0) > 0) it.galpones++;
    }
    const list = Array.from(map.values()).sort((a, b) => b.fecha.localeCompare(a.fecha) || a.planta.localeCompare(b.planta));
    thead.innerHTML = `
      <tr>
        <th>Fecha</th>
        <th>Planta</th>
        <th class="text-right">Galpones Activos</th>
        <th class="text-right">Total Producido</th>
      </tr>`;
    tbody.innerHTML = list.length === 0
      ? `<tr><td colspan="4" style="text-align:center;padding:20px;color:#64748b;">Sin registros en SQLite.</td></tr>`
      : list.map((x) => {
          totalGlobal += x.total;
          return `
            <tr>
              <td><strong>${x.fecha}</strong></td>
              <td><span class="badge badge-${x.planta}">${x.planta}</span></td>
              <td class="text-right">${x.galpones}</td>
              <td class="text-right"><strong>${x.total.toLocaleString()}</strong></td>
            </tr>`;
        }).join('');
    document.getElementById('footerTotalRegistros').textContent = `Total registros: ${list.length}`;
  } else {
    const grouped = aggregateByPeriod(rows, mode);
    thead.innerHTML = `
      <tr>
        <th>Período</th>
        <th class="text-right">ALKA 1</th>
        <th class="text-right">ALKA 2</th>
        <th class="text-right">ALKA PALMAS</th>
        <th class="text-right">Total Cauca</th>
      </tr>`;

    tbody.innerHTML = grouped.length === 0
      ? `<tr><td colspan="5" style="text-align:center;padding:20px;color:#64748b;">Sin registros en SQLite para el filtro seleccionado.</td></tr>`
      : grouped.map((g) => {
          totalGlobal += g.total;
          return `
            <tr>
              <td><strong>${escapeHtml(g.periodo)}</strong></td>
              <td class="text-right">${g.ALKA1.toLocaleString()}</td>
              <td class="text-right">${g.ALKA2.toLocaleString()}</td>
              <td class="text-right">${g.PALMAS.toLocaleString()}</td>
              <td class="text-right"><strong>${g.total.toLocaleString()}</strong></td>
            </tr>`;
        }).join('');
    document.getElementById('footerTotalRegistros').textContent = `Total períodos: ${grouped.length}`;
  }

  document.getElementById('footerTotalHuevos').textContent = `Total: ${totalGlobal.toLocaleString()} Huevos`;
  updateStackedChart(rows, mode);
}

function aggregateByPeriod(rows, mode) {
  const map = new Map();
  for (const r of rows) {
    let key = r.fecha;
    if (mode === 'mes') key = r.fecha.slice(0, 7);
    else if (mode === 'semana') key = getIsoWeekLabel(r.fecha);

    if (!map.has(key)) {
      map.set(key, { periodo: key, ALKA1: 0, ALKA2: 0, PALMAS: 0, total: 0 });
    }
    const item = map.get(key);
    const val = Number(r.total_produccion || 0);
    if (item[r.planta] !== undefined) item[r.planta] += val;
    item.total += val;
  }
  return Array.from(map.values()).sort((a, b) => b.periodo.localeCompare(a.periodo));
}

function getIsoWeekLabel(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((tmp - yearStart) / 86400000) + 1) / 7);
  return `${tmp.getUTCFullYear()}-S${String(weekNo).padStart(2, '0')}`;
}

function renderDetallePorGalpon() {
  const rows = State.filteredRows;
  const map = new Map();
  let grandTotal = 0;

  const plantsToShow = State.selectedPlant === 'TODAS' ? PLANTS : PLANTS.filter((p) => p.id === State.selectedPlant);
  for (const p of plantsToShow) {
    for (let n = p.minGalpon; n <= p.maxGalpon; n++) {
      map.set(`${p.id}_${n}`, {
        planta: p.id,
        numero: n,
        codigo: `GALPON${n}`,
        nombre: `Galpón ${n}`,
        total: 0,
        dias: 0,
        maxDia: 0,
        maxFecha: '--'
      });
    }
  }

  for (const r of rows) {
    const val = Number(r.total_produccion || 0);
    grandTotal += val;
    const key = `${r.planta}_${r.numero_galpon}`;
    const item = map.get(key) || {
      planta: r.planta,
      numero: Number(r.numero_galpon),
      codigo: r.codigo_galpon,
      nombre: r.nombre_galpon,
      total: 0,
      dias: 0,
      maxDia: 0,
      maxFecha: '--'
    };
    item.codigo = r.codigo_galpon;
    item.nombre = r.nombre_galpon;
    item.total += val;
    if (val > 0) item.dias++;
    if (val > item.maxDia) {
      item.maxDia = val;
      item.maxFecha = r.fecha;
    }
    map.set(key, item);
  }

  const tbody = document.getElementById('tbodyPorGalpon');
  tbody.innerHTML = Array.from(map.values())
    .sort((a, b) => a.planta.localeCompare(b.planta) || a.numero - b.numero)
    .map((g) => {
      const prom = g.dias > 0 ? Math.round(g.total / g.dias) : 0;
      const pct = grandTotal > 0 ? ((g.total / grandTotal) * 100).toFixed(1) : '0.0';
      return `
        <tr>
          <td><span class="badge badge-${g.planta}">${g.planta}</span></td>
          <td><strong>${escapeHtml(g.nombre)}</strong></td>
          <td>${escapeHtml(g.codigo)}</td>
          <td class="text-right"><strong>${g.total.toLocaleString()}</strong></td>
          <td class="text-right">${prom.toLocaleString()}</td>
          <td class="text-right">${g.dias}</td>
          <td class="text-right">${g.maxDia.toLocaleString()} (${g.maxFecha})</td>
          <td class="text-right">${pct}%</td>
        </tr>`;
    }).join('');
}

function renderSqliteControlTab(sizeKb, stats) {
  const metas = CaucaSQLite.getAllImportedMeta(State.selectedPlant);
  document.getElementById('sqliteSummaryGrid').innerHTML = `
    <div class="sqlite-stat"><span>Días únicos Cauca</span><strong>${stats.diasUnicos}</strong></div>
    <div class="sqlite-stat"><span>Registros Planta-Día</span><strong>${stats.totalRegistrosImportados}</strong></div>
    <div class="sqlite-stat"><span>Cerrados (omitidos en sync)</span><strong>${stats.registrosCerrados}</strong></div>
    <div class="sqlite-stat"><span>Tamaño DB SQLite</span><strong>${sizeKb} KB</strong></div>
  `;

  const tbody = document.getElementById('tbodySqliteFechas');
  tbody.innerHTML = metas.length === 0
    ? `<tr><td colspan="8" style="text-align:center;padding:20px;color:#64748b;">Sin registros en SQLite.</td></tr>`
    : metas.map((m) => `
      <tr>
        <td><span class="badge badge-${m.planta}">${m.planta}</span></td>
        <td><strong>${m.fecha}</strong></td>
        <td>${escapeHtml(m.file_name)}</td>
        <td>${m.cerrada === 1
          ? '<span class="badge badge-ok">Cerrada (En Caché)</span>'
          : '<span class="badge badge-live">En curso (Actualizable)</span>'}</td>
        <td class="text-right"><strong>${Number(m.total_planta || 0).toLocaleString()}</strong></td>
        <td>${m.modified_time ? new Date(m.modified_time).toLocaleString() : '--'}</td>
        <td>${new Date(m.fecha_importacion).toLocaleString()}</td>
        <td><button class="btn-filter btn-sm" onclick="window.reimportPlantDate('${m.planta}','${m.fecha}')">Reimportar</button></td>
      </tr>
    `).join('');
}

window.reimportPlantDate = (planta, fecha) => {
  syncCaucaFromDrive(false, planta, fecha);
};

// =============================================================================
// CHART.JS (BARRAS APILADAS POR PLANTA)
// =============================================================================
function initChart() {
  const ctx = document.getElementById('canvasChartConsolidado').getContext('2d');
  State.chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: [],
      datasets: [
        { label: 'ALKA 1', data: [], backgroundColor: '#2563eb', borderRadius: 3 },
        { label: 'ALKA 2', data: [], backgroundColor: '#f59e0b', borderRadius: 3 },
        { label: 'ALKA PALMAS', data: [], backgroundColor: '#2e9e22', borderRadius: 3 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'top' } },
      scales: {
        x: { stacked: true, grid: { display: false } },
        y: {
          stacked: true,
          beginAtZero: true,
          ticks: { callback: (v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : v) }
        }
      }
    }
  });
}

function updateStackedChart(rows, mode) {
  if (!State.chart) return;
  const chartMode = (mode === 'mes' || mode === 'semana') ? mode : 'dia';
  const grouped = aggregateByPeriod(rows, chartMode).reverse();
  document.getElementById('lblPeriodosAnalizados').textContent = grouped.length;

  State.chart.data.labels = grouped.map((g) => g.periodo);
  State.chart.data.datasets[0].data = grouped.map((g) => g.ALKA1);
  State.chart.data.datasets[1].data = grouped.map((g) => g.ALKA2);
  State.chart.data.datasets[2].data = grouped.map((g) => g.PALMAS);
  State.chart.update();
}

// =============================================================================
// EXPORTACIONES (HOY Y DISPONIBLES -> PLANO CSV Y EXCEL XLSX)
// =============================================================================
function exportPlainCsv(rows, filename) {
  if (!rows || rows.length === 0) {
    showToast('No hay datos para exportar.', 'error');
    return;
  }
  const sep = document.getElementById('selectSeparadorCsv').value || ',';
  const lines = [['Planta', 'Fecha', 'Galpon', 'Codigo_Galpon', 'Nombre_Galpon', 'Total_Produccion'].join(sep)];

  const byDate = new Map();
  for (const r of rows) {
    if (!byDate.has(r.fecha)) byDate.set(r.fecha, []);
    byDate.get(r.fecha).push(r);
  }

  for (const fecha of Array.from(byDate.keys()).sort()) {
    const dayRows = byDate.get(fecha).sort((a, b) => a.planta.localeCompare(b.planta) || a.numero_galpon - b.numero_galpon);
    let totalDiaCauca = 0;
    const subtotales = {};

    for (const r of dayRows) {
      const val = Number(r.total_produccion || 0);
      totalDiaCauca += val;
      subtotales[r.planta] = (subtotales[r.planta] || 0) + val;
      lines.push([r.planta, r.fecha, r.numero_galpon, r.codigo_galpon, r.nombre_galpon, val].join(sep));
    }

    for (const [planta, sub] of Object.entries(subtotales)) {
      lines.push([planta, fecha, 'SUBTOTAL', `TOTAL_${planta}`, `TOTAL ${planta}`, sub].join(sep));
    }
    lines.push(['CAUCA', fecha, 'TOTAL', 'TOTAL_CAUCA', 'TOTAL SECCIONAL CAUCA', totalDiaCauca].join(sep));
  }

  triggerDownload(new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' }), filename);
  showToast(`Archivo plano exportado: ${filename}`, 'success');
}

function exportExcelWorkbook(rows, filename) {
  if (!rows || rows.length === 0) {
    showToast('No hay datos para exportar.', 'error');
    return;
  }
  if (typeof XLSX === 'undefined') {
    showToast('Librería XLSX no disponible.', 'error');
    return;
  }

  const resumenCauca = aggregateByPeriod(rows, 'dia').map((g) => ({
    Fecha: g.periodo,
    ALKA_1: g.ALKA1,
    ALKA_2: g.ALKA2,
    ALKA_PALMAS: g.PALMAS,
    Total_Seccional_Cauca: g.total
  }));

  const detalle = rows
    .slice()
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.planta.localeCompare(b.planta) || a.numero_galpon - b.numero_galpon)
    .map((r) => ({
      Planta: r.planta,
      Fecha: r.fecha,
      Galpon: r.numero_galpon,
      Codigo: r.codigo_galpon,
      Nombre: r.nombre_galpon,
      Total_Produccion: Number(r.total_produccion || 0)
    }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumenCauca), 'Resumen_Cauca');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detalle), 'Detalle_Galpones');
  XLSX.writeFile(wb, filename);
  showToast(`Excel exportado: ${filename}`, 'success');
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// =============================================================================
// EVENTOS
// =============================================================================
function initEventListeners() {
  document.getElementById('btnGoogleLogin').addEventListener('click', loginWithGoogle);
  document.getElementById('btnAuthAction').addEventListener('click', () => {
    if (State.accessToken) logoutGoogle();
    else showLoginModal();
  });
  document.getElementById('btnLogoutGoogle').addEventListener('click', logoutGoogle);
  document.getElementById('btnSyncDrive').addEventListener('click', () => syncCaucaFromDrive(false));

  document.querySelectorAll('#plantPills .plant-pill').forEach((btn) => {
    btn.addEventListener('click', () => {
      State.selectedPlant = btn.dataset.planta;
      syncPlantPillsUI();
      populateGalponFilter();
      renderAllFromSqlite();
    });
  });

  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active-tab'));
      document.querySelectorAll('.tab-content').forEach((c) => c.classList.add('hidden'));
      btn.classList.add('active-tab');
      document.getElementById(btn.dataset.tab).classList.remove('hidden');
      if (btn.dataset.tab === 'tabConsolidado' && State.chart) State.chart.resize();
    });
  });

  document.querySelectorAll('.quick-buttons [data-preset]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.quick-buttons [data-preset]').forEach((b) => b.classList.remove('active-btn'));
      btn.classList.add('active-btn');
      applyPreset(btn.dataset.preset, true);
    });
  });

  document.getElementById('btnAplicarFiltro').addEventListener('click', renderAllFromSqlite);
  document.getElementById('filtroGalpon').addEventListener('change', renderAllFromSqlite);
  document.getElementById('selectAgrupar').addEventListener('change', renderConsolidado);
  document.getElementById('selectFechaMonitor').addEventListener('change', renderMonitorView);
  document.getElementById('btnToggleGrafica').addEventListener('click', () => {
    document.querySelector('#boxGrafica .chart-wrapper').classList.toggle('hidden');
  });

  // Selector de fuente del día actual (Auto / MQTT / Archivos SQLite)
  document.querySelectorAll('#hoySourceSeg .mseg-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      State.hoySource = btn.dataset.source;
      localStorage.setItem(CONFIG.STORAGE_KEYS.HOY_SOURCE, State.hoySource);
      syncHoySourceButtons();
      renderAllFromSqlite();
    });
  });

  // Exportaciones
  document.getElementById('btnExportHoyCsv').addEventListener('click', () => {
    const today = getLocalDateStr();
    exportPlainCsv(getEffectiveTodayRows(State.selectedPlant), `KIKES_CAUCA_Hoy_${State.selectedPlant}_${today}.csv`);
  });
  document.getElementById('btnExportHoyExcel').addEventListener('click', () => {
    const today = getLocalDateStr();
    exportExcelWorkbook(getEffectiveTodayRows(State.selectedPlant), `KIKES_CAUCA_Hoy_${State.selectedPlant}_${today}.xlsx`);
  });
  document.getElementById('btnExportDispCsv').addEventListener('click', () => {
    const rows = State.filteredRows.length > 0 ? State.filteredRows : getEffectiveProductionRows(State.selectedPlant);
    exportPlainCsv(rows, `KIKES_CAUCA_Disponibles_${State.selectedPlant}_${getLocalDateStr()}.csv`);
  });
  document.getElementById('btnExportDispExcel').addEventListener('click', () => {
    const rows = State.filteredRows.length > 0 ? State.filteredRows : getEffectiveProductionRows(State.selectedPlant);
    exportExcelWorkbook(rows, `KIKES_CAUCA_Disponibles_${State.selectedPlant}_${getLocalDateStr()}.xlsx`);
  });

  // SQLite
  document.getElementById('btnForzarReimportar').addEventListener('click', () => {
    if (confirm('¿Volver a descargar todos los archivos de las 3 plantas desde Google Drive?')) {
      syncCaucaFromDrive(true);
    }
  });
  document.getElementById('btnDescargarSqlite').addEventListener('click', () => {
    const bytes = CaucaSQLite.exportDatabaseBytes();
    if (bytes) triggerDownload(new Blob([bytes], { type: 'application/x-sqlite3' }), `kikes_cauca_${getLocalDateStr()}.sqlite`);
  });
  document.getElementById('btnLimpiarSqlite').addEventListener('click', async () => {
    if (confirm('¿Vaciar toda la base de datos SQLite local de Cauca?')) {
      await CaucaSQLite.clearDatabase();
      renderAllFromSqlite();
      showToast('Base de datos SQLite vaciada.', 'info');
    }
  });

  function saveMqttSettingsFromUi(reconnect = true) {
    State.mqttCfg = {
      enabled: document.getElementById('chkMqttEnabled')?.checked ?? true,
      brokerUrl: document.getElementById('inputMqttBroker')?.value.trim() || DEFAULT_MQTT_BROKER,
      topics: {
        PX1: document.getElementById('inputMqttTopicPx1')?.value.trim() || MQTT_TOPIC_DEFS[0].defaultTopic,
        PX2: document.getElementById('inputMqttTopicPx2')?.value.trim() || MQTT_TOPIC_DEFS[1].defaultTopic,
        PX3: document.getElementById('inputMqttTopicPx3')?.value.trim() || MQTT_TOPIC_DEFS[2].defaultTopic,
        PXPALMAS: document.getElementById('inputMqttTopicPalmas')?.value.trim() || MQTT_TOPIC_DEFS[3].defaultTopic
      }
    };
    localStorage.setItem(CONFIG.STORAGE_KEYS.MQTT_CFG, JSON.stringify(State.mqttCfg));
    if (reconnect) {
      connectMqttClient();
      renderAllFromSqlite();
    }
  }

  document.getElementById('btnGuardarMqtt')?.addEventListener('click', () => {
    saveMqttSettingsFromUi(true);
    showToast('Configuración MQTT guardada y reconectando.', 'success');
  });

  // Ajustes
  document.getElementById('btnGuardarAjustes').addEventListener('click', async () => {
    State.folders = {
      ALKA1: cleanFolderId(document.getElementById('inputFolderAlka1').value) || PLANTS[0].defaultFolderId,
      ALKA2: cleanFolderId(document.getElementById('inputFolderAlka2').value) || PLANTS[1].defaultFolderId,
      PALMAS: cleanFolderId(document.getElementById('inputFolderPalmas').value) || PLANTS[2].defaultFolderId
    };
    CaucaSQLite.updatePlantFolderId('ALKA1', State.folders.ALKA1);
    CaucaSQLite.updatePlantFolderId('ALKA2', State.folders.ALKA2);
    CaucaSQLite.updatePlantFolderId('PALMAS', State.folders.PALMAS);
    await CaucaSQLite.persist();
    const min = Math.max(0, parseInt(document.getElementById('inputAutoRefreshMin').value || '5', 10));
    State.autoRefreshMin = min;
    localStorage.setItem(CONFIG.STORAGE_KEYS.FOLDERS, JSON.stringify(State.folders));
    localStorage.setItem(CONFIG.STORAGE_KEYS.AUTO_REFRESH_MIN, String(min));
    saveMqttSettingsFromUi(true);
    restartAutoRefreshTimer();
    showToast('Ajustes de Seccional Cauca guardados.', 'success');
  });
}

function applyPreset(preset, rerender = true) {
  const hoy = new Date();
  const hoyStr = getLocalDateStr(hoy);
  let iniStr = hoyStr;
  let finStr = hoyStr;

  if (preset === 'ayer') {
    const ayer = new Date(hoy);
    ayer.setDate(ayer.getDate() - 1);
    iniStr = getLocalDateStr(ayer);
    finStr = iniStr;
  } else if (preset === '7d') {
    const d7 = new Date(hoy);
    d7.setDate(d7.getDate() - 6);
    iniStr = getLocalDateStr(d7);
  } else if (preset === 'mes') {
    iniStr = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-01`;
  } else if (preset === 'todo') {
    const bounds = CaucaSQLite.getAvailableDateBounds(State.selectedPlant);
    iniStr = bounds.minFecha || `${hoy.getFullYear()}-01-01`;
    finStr = bounds.maxFecha || hoyStr;
  }

  document.getElementById('filtroFechaInicio').value = iniStr;
  document.getElementById('filtroFechaFin').value = finStr;
  if (rerender) renderAllFromSqlite();
}

function restartAutoRefreshTimer() {
  if (State.autoRefreshTimer) {
    clearInterval(State.autoRefreshTimer);
    State.autoRefreshTimer = null;
  }
  if (State.autoRefreshMin > 0) {
    State.autoRefreshTimer = setInterval(() => {
      if (State.accessToken && Date.now() < State.tokenExpiry) {
        syncCaucaFromDrive(false);
      }
    }, State.autoRefreshMin * 60 * 1000);
  }
}

function showToast(msg, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 250);
  }, 3200);
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
