// GDELT fetcher — Global event monitoring
// Uses GDELT DOC 2.0 API for geopolitical event discovery
const { normalizeItem } = require('./normalize');

const QUERIES = [
  {
    query: 'critical minerals export controls',
    themes: ['critical minerals', 'geopolitics', 'industrial policy'],
    materials: ['gallium', 'germanium', 'rare earths', 'antimony', 'lithium', 'cobalt'],
    channels: ['export controls', 'sanctions']
  },
  {
    query: 'oil supply disruption OPEC',
    themes: ['oil / gas / LNG', 'geopolitics'],
    channels: ['supply chain', 'inflation']
  },
  {
    query: 'shipping chokepoint strait canal blockade',
    themes: ['shipping / chokepoints', 'geopolitics'],
    channels: ['freight', 'supply chain']
  },
  {
    query: 'energy transition policy renewable',
    themes: ['energy policy', 'ESG / sustainability policy', 'energy transition bottlenecks'],
    channels: ['trade policy']
  },
  {
    query: 'sanctions trade war tariff industrial policy',
    themes: ['industrial policy', 'geopolitics', 'public equity implications'],
    channels: ['sanctions', 'trade policy']
  },
  {
    query: 'chemical export ban regulation hazardous',
    themes: ['critical chemicals', 'industrial policy'],
    channels: ['export controls', 'ESG compliance']
  }
];

function extractGeo(article) {
  // GDELT sometimes returns rough geo — extract if available
  if (article.seendate) {
    // Try common country patterns from title/context
    const geoPatterns = {
      'China': { lat: 35.86, lon: 104.2, region: 'China' },
      'Russia': { lat: 61.52, lon: 105.3, region: 'Russia' },
      'Taiwan': { lat: 23.69, lon: 120.96, region: 'Taiwan' },
      'Ukraine': { lat: 48.38, lon: 31.17, region: 'Ukraine' },
      'Iran': { lat: 32.43, lon: 53.69, region: 'Iran' },
      'Saudi': { lat: 23.89, lon: 45.08, region: 'Saudi Arabia' },
      'Congo': { lat: -4.04, lon: 21.76, region: 'DRC' },
      'Chile': { lat: -35.68, lon: -71.54, region: 'Chile' },
      'Australia': { lat: -25.27, lon: 133.78, region: 'Australia' },
      'Indonesia': { lat: -0.79, lon: 113.92, region: 'Indonesia' },
      'Suez': { lat: 30.46, lon: 32.35, region: 'Suez Canal' },
      'Strait of Hormuz': { lat: 26.56, lon: 56.25, region: 'Strait of Hormuz' },
      'Panama': { lat: 8.54, lon: -80.78, region: 'Panama Canal' },
      'Malacca': { lat: 2.5, lon: 101.8, region: 'Strait of Malacca' }
    };
    const title = (article.title || '') + ' ' + (article.seendate || '');
    for (const [key, geo] of Object.entries(geoPatterns)) {
      if (title.includes(key)) return geo;
    }
  }
  return { lat: null, lon: null, region: '' };
}

async function fetchGdelt() {
  const items = [];

  for (const q of QUERIES) {
    try {
      const encoded = encodeURIComponent(q.query);
      const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encoded}&mode=ArtList&maxrecords=10&format=json&timespan=24h`;

      const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
      if (!res.ok) continue;

      const data = await res.json();
      const articles = data?.articles || [];

      for (const article of articles.slice(0, 5)) {
        const geo = extractGeo(article);

        items.push(normalizeItem({
          source: 'GDELT',
          sourceType: 'aggregator',
          title: article.title || 'Untitled',
          summary: (article.title || '').slice(0, 500),
          url: article.url || '',
          publishedAt: article.seendate ? parseDateStr(article.seendate) : null,
          region: geo.region,
          themes: q.themes,
          materials: q.materials || [],
          channels: q.channels || [],
          dataStatus: 'live',
          importanceScore: 5,
          lat: geo.lat,
          lon: geo.lon,
          rawPayload: { domain: article.domain, language: article.language, socialimage: article.socialimage }
        }));
      }
    } catch (err) {
      // Log but don't break the pipeline
      console.error(`[GDELT] Query "${q.query}" failed:`, err.message);
    }
  }

  return items;
}

function parseDateStr(str) {
  // GDELT dates: "20240315T120000Z" format
  if (!str) return null;
  try {
    if (str.length === 14 || str.includes('T')) {
      const clean = str.replace(/(\d{4})(\d{2})(\d{2})T?(\d{2})(\d{2})(\d{2})Z?/, '$1-$2-$3T$4:$5:$6Z');
      return new Date(clean);
    }
    return new Date(str);
  } catch {
    return null;
  }
}

module.exports = { fetchGdelt };
