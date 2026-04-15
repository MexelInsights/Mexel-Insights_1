// USGS Minerals fetcher — U.S. Geological Survey mineral commodity data
// Fetches from USGS Publications Warehouse API
const { normalizeItem } = require('./normalize');

const API_BASE = 'https://pubs.er.usgs.gov/pubs-services/publication';

const QUERIES = [
  {
    q: 'minerals critical',
    themes: ['critical minerals'],
    channels: ['supply chain', 'stockpiling']
  },
  {
    q: 'energy lithium cobalt',
    themes: ['critical minerals', 'energy transition'],
    channels: ['supply chain', 'battery supply']
  }
];

// Material extraction from USGS content
const MINERAL_MAP = {
  'lithium': ['lithium', 'li-ion', 'spodumene'],
  'cobalt': ['cobalt'],
  'nickel': ['nickel'],
  'copper': ['copper'],
  'graphite': ['graphite'],
  'rare earths': ['rare earth', 'ree', 'neodymium', 'dysprosium', 'praseodymium', 'lanthanum', 'cerium'],
  'gallium': ['gallium'],
  'germanium': ['germanium'],
  'antimony': ['antimony'],
  'tungsten': ['tungsten'],
  'tantalum': ['tantalum', 'coltan'],
  'vanadium': ['vanadium'],
  'tellurium': ['tellurium'],
  'indium': ['indium'],
  'uranium': ['uranium'],
  'platinum': ['platinum', 'pgm'],
  'palladium': ['palladium'],
  'manganese': ['manganese'],
  'chromium': ['chromium', 'chrome'],
  'tin': ['tin', 'cassiterite'],
  'fluorspar': ['fluorspar', 'fluorite'],
  'bauxite': ['bauxite', 'aluminium', 'aluminum'],
  'titanium': ['titanium', 'ilmenite', 'rutile'],
  'zirconium': ['zirconium', 'zircon'],
  'beryllium': ['beryllium'],
  'silicon': ['silicon', 'ferrosilicon']
};

function extractMinerals(text) {
  const lower = text.toLowerCase();
  const found = [];
  for (const [mineral, keywords] of Object.entries(MINERAL_MAP)) {
    if (keywords.some(kw => lower.includes(kw))) found.push(mineral);
  }
  return found;
}

async function fetchUsgs() {
  const items = [];
  const seenIds = new Set();

  for (const query of QUERIES) {
    try {
      const url = `${API_BASE}?q=${encodeURIComponent(query.q)}&pageSize=10&orderBy=lastModifiedDate+desc`;
      const res = await fetch(url, {
        signal: AbortSignal.timeout(15000),
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'MexelInsights/1.0 (research aggregator)'
        }
      });

      if (!res.ok) {
        console.error(`[USGS] API query "${query.q}" returned ${res.status}`);
        continue;
      }

      const data = await res.json();
      const records = data.records || [];

      for (const rec of records) {
        if (seenIds.has(rec.id)) continue;
        seenIds.add(rec.id);

        const title = rec.title || '';
        const summary = rec.text || title;
        const pubYear = rec.publicationYear || '';
        const pubType = rec.publicationType?.text || '';
        const pubDate = rec.lastModifiedDate || null;

        // Find first available link URL
        let link = '';
        if (Array.isArray(rec.links) && rec.links.length > 0) {
          link = rec.links[0].url || '';
        }
        if (!link) {
          link = `https://pubs.er.usgs.gov/publication/${rec.id}`;
        }

        const fullText = title + ' ' + summary;
        const materials = extractMinerals(fullText);

        items.push(normalizeItem({
          source: 'USGS',
          sourceType: 'official',
          title: title.slice(0, 300),
          summary: summary.slice(0, 800),
          url: link,
          publishedAt: pubDate,
          region: 'US / Global',
          themes: query.themes,
          materials,
          channels: query.channels,
          dataStatus: 'periodic',
          importanceScore: materials.length > 0 ? 7 : 5,
          rawPayload: { queryTerm: query.q, publicationType: pubType, publicationYear: pubYear }
        }));
      }
    } catch (err) {
      console.error(`[USGS] API query "${query.q}" failed:`, err.message);
    }
  }

  // If no items fetched, provide static fallback
  if (items.length === 0) {
    items.push(normalizeItem({
      source: 'USGS',
      sourceType: 'official',
      title: 'USGS Mineral Commodity Summaries 2025',
      summary: 'Annual reference for US mineral production, consumption, trade, and reserves. Covers 90+ mineral commodities. Updated annually in January.',
      url: 'https://pubs.usgs.gov/periodicals/mcs2025/',
      region: 'US / Global',
      themes: ['critical minerals'],
      materials: Object.keys(MINERAL_MAP),
      channels: ['supply chain', 'stockpiling'],
      dataStatus: 'static',
      importanceScore: 7
    }));
  }

  // Cap at 10 items total
  return items.slice(0, 10);
}

module.exports = { fetchUsgs };
