// In-memory data store with JSON file persistence
// Stores research items, fetch logs, and synthesis outputs
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const ITEMS_FILE = path.join(DATA_DIR, 'items.json');
const SYNTHESES_FILE = path.join(DATA_DIR, 'syntheses.json');
const FETCH_LOG_FILE = path.join(DATA_DIR, 'fetch-log.json');

// In-memory state
let items = [];
let syntheses = [];
let fetchLog = [];
let lastFullRefresh = null;

// Initialize — load from disk if available
function init() {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch {}

  try {
    if (fs.existsSync(ITEMS_FILE)) {
      items = JSON.parse(fs.readFileSync(ITEMS_FILE, 'utf8'));
    }
  } catch (err) {
    console.error('[Store] Failed to load items:', err.message);
    items = [];
  }

  try {
    if (fs.existsSync(SYNTHESES_FILE)) {
      syntheses = JSON.parse(fs.readFileSync(SYNTHESES_FILE, 'utf8'));
    }
  } catch (err) {
    console.error('[Store] Failed to load syntheses:', err.message);
    syntheses = [];
  }

  try {
    if (fs.existsSync(FETCH_LOG_FILE)) {
      fetchLog = JSON.parse(fs.readFileSync(FETCH_LOG_FILE, 'utf8'));
    }
  } catch (err) {
    fetchLog = [];
  }

  console.log(`[Store] Loaded ${items.length} items, ${syntheses.length} syntheses`);
}

// Persist to disk
function save() {
  try {
    fs.writeFileSync(ITEMS_FILE, JSON.stringify(items, null, 2));
    fs.writeFileSync(SYNTHESES_FILE, JSON.stringify(syntheses, null, 2));
    fs.writeFileSync(FETCH_LOG_FILE, JSON.stringify(fetchLog.slice(-500), null, 2));
  } catch (err) {
    console.error('[Store] Failed to save:', err.message);
  }
}

// Add items (dedup by id, update if exists)
function addItems(newItems) {
  const idMap = new Map(items.map(i => [i.id, i]));

  for (const item of newItems) {
    idMap.set(item.id, item);
  }

  items = [...idMap.values()];

  // Keep only last 7 days of items (prevent unbounded growth)
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  items = items.filter(i => {
    const t = i.retrieved_at ? new Date(i.retrieved_at).getTime() : Date.now();
    return t > cutoff;
  });

  // Deduplicate by normalized title (keep highest-scored version)
  const titleMap = new Map();
  for (const item of items) {
    const normTitle = (item.title || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 80);
    if (!normTitle || normTitle.length < 10) { titleMap.set(item.id, item); continue; }
    const existing = titleMap.get(normTitle);
    if (!existing || (item.scores?.composite || 0) > (existing.scores?.composite || 0)) {
      titleMap.set(normTitle, item);
    }
  }
  items = [...titleMap.values()];

  // Sort by recency
  items.sort((a, b) => {
    const da = a.published_at ? new Date(a.published_at).getTime() : 0;
    const db = b.published_at ? new Date(b.published_at).getTime() : 0;
    return db - da;
  });

  save();
  return items.length;
}

// Add synthesis outputs
function addSyntheses(newSyntheses) {
  const idMap = new Map(syntheses.map(s => [s.id, s]));
  for (const s of newSyntheses) {
    idMap.set(s.id, s);
  }
  syntheses = [...idMap.values()];

  // Keep only last 30 days
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  syntheses = syntheses.filter(s => {
    const t = s.created_at ? new Date(s.created_at).getTime() : Date.now();
    return t > cutoff;
  });

  syntheses.sort((a, b) => {
    const da = a.created_at ? new Date(a.created_at).getTime() : 0;
    const db = b.created_at ? new Date(b.created_at).getTime() : 0;
    return db - da;
  });

  save();
}

// Log fetch results
function logFetch(entries) {
  fetchLog.push(...entries);
  // Keep last 500 entries
  if (fetchLog.length > 500) fetchLog = fetchLog.slice(-500);
  lastFullRefresh = new Date().toISOString();
  save();
}

// Query items
function getItems({ theme, source, material, sector, channel, limit = 50, since } = {}) {
  let result = [...items];

  if (theme) result = result.filter(i => i.themes?.includes(theme));
  if (source) result = result.filter(i => i.source === source);
  if (material) result = result.filter(i => i.materials?.includes(material));
  if (sector) result = result.filter(i => i.sectors?.includes(sector));
  if (channel) result = result.filter(i => i.channels?.includes(channel));
  if (since) {
    const cutoff = new Date(since).getTime();
    result = result.filter(i => {
      const t = i.published_at ? new Date(i.published_at).getTime() : 0;
      return t >= cutoff;
    });
  }

  return result.slice(0, limit);
}

function getSyntheses({ limit = 20 } = {}) {
  return syntheses.slice(0, limit);
}

function getLatestSynthesis() {
  return syntheses[0] || null;
}

function getFetchLog({ limit = 50 } = {}) {
  return fetchLog.slice(-limit);
}

function getStats() {
  const sourceCounts = {};
  for (const item of items) {
    sourceCounts[item.source] = (sourceCounts[item.source] || 0) + 1;
  }

  const lastFetchBySource = {};
  for (const entry of fetchLog) {
    if (entry.success) {
      lastFetchBySource[entry.source] = entry.timestamp;
    }
  }

  return {
    totalItems: items.length,
    totalSyntheses: syntheses.length,
    sourceCounts,
    lastFetchBySource,
    lastFullRefresh,
    oldestItem: items.length > 0 ? items[items.length - 1].published_at : null,
    newestItem: items.length > 0 ? items[0].published_at : null
  };
}

function getGeoItems() {
  return items.filter(i => i.lat && i.lon).map(i => ({
    id: i.id,
    title: i.title,
    summary: i.summary,
    source: i.source,
    url: i.url,
    lat: i.lat,
    lon: i.lon,
    region: i.region,
    themes: i.themes,
    materials: i.materials,
    sectors: i.sectors,
    importance_score: i.importance_score,
    data_status: i.data_status,
    published_at: i.published_at
  }));
}

module.exports = {
  init, addItems, addSyntheses, logFetch,
  getItems, getSyntheses, getLatestSynthesis,
  getFetchLog, getStats, getGeoItems
};
