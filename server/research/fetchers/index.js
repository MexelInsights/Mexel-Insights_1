// Fetcher orchestrator — runs all fetchers and returns combined results
const { fetchEia } = require('./eia');
const { fetchGdelt } = require('./gdelt');
const { fetchFederalRegister } = require('./federalRegister');
const { fetchEurLex } = require('./eurlex');
const { fetchDoe } = require('./doe');
const { fetchIea } = require('./iea');
const { fetchUsgs } = require('./usgs');

const FETCHERS = {
  eia: { fn: fetchEia, name: 'EIA' },
  gdelt: { fn: fetchGdelt, name: 'GDELT' },
  'federal-register': { fn: fetchFederalRegister, name: 'Federal Register' },
  eurlex: { fn: fetchEurLex, name: 'EUR-Lex' },
  doe: { fn: fetchDoe, name: 'DOE' },
  iea: { fn: fetchIea, name: 'IEA' },
  usgs: { fn: fetchUsgs, name: 'USGS' }
};

async function runFetcher(id) {
  const fetcher = FETCHERS[id];
  if (!fetcher) throw new Error(`Unknown fetcher: ${id}`);

  const start = Date.now();
  try {
    const items = await fetcher.fn();
    const elapsed = Date.now() - start;
    console.log(`[Fetcher] ${fetcher.name}: ${items.length} items in ${elapsed}ms`);
    return { source: id, success: true, items, elapsed, error: null };
  } catch (err) {
    const elapsed = Date.now() - start;
    console.error(`[Fetcher] ${fetcher.name} FAILED in ${elapsed}ms:`, err.message);
    return { source: id, success: false, items: [], elapsed, error: err.message };
  }
}

async function runAllFetchers() {
  const results = await Promise.allSettled(
    Object.keys(FETCHERS).map(id => runFetcher(id))
  );

  const combined = {
    items: [],
    fetchLog: [],
    timestamp: new Date().toISOString()
  };

  for (const result of results) {
    if (result.status === 'fulfilled') {
      const r = result.value;
      combined.items.push(...r.items);
      combined.fetchLog.push({
        source: r.source,
        success: r.success,
        count: r.items.length,
        elapsed: r.elapsed,
        error: r.error,
        timestamp: new Date().toISOString()
      });
    }
  }

  // Deduplicate by id
  const seen = new Set();
  combined.items = combined.items.filter(item => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });

  // Sort by published_at (newest first), then importance
  combined.items.sort((a, b) => {
    const dateA = a.published_at ? new Date(a.published_at).getTime() : 0;
    const dateB = b.published_at ? new Date(b.published_at).getTime() : 0;
    if (dateB !== dateA) return dateB - dateA;
    return (b.importance_score || 0) - (a.importance_score || 0);
  });

  return combined;
}

module.exports = { runFetcher, runAllFetchers, FETCHERS };
