// DOE fetcher — U.S. Department of Energy newsroom
// Uses DOE RSS feed for energy policy, grid, nuclear, renewables, critical minerals
const { normalizeItem } = require('./normalize');
const { parseStringPromise } = require('xml2js');

const FEEDS = [
  {
    url: 'https://www.energy.gov/rss.xml',
    label: 'DOE Articles',
    themes: ['energy policy', 'critical minerals', 'industrial policy'],
    channels: ['trade policy', 'power demand', 'permitting']
  }
];

const MATERIAL_KEYWORDS = {
  'lithium': ['lithium'], 'cobalt': ['cobalt'], 'nickel': ['nickel'],
  'copper': ['copper'], 'rare earth': ['rare earth', 'ree'], 'uranium': ['uranium', 'nuclear fuel'],
  'gallium': ['gallium'], 'germanium': ['germanium'], 'graphite': ['graphite'],
  'hydrogen': ['hydrogen', 'h2'], 'silicon': ['silicon', 'polysilicon']
};

const SECTOR_KEYWORDS = {
  'nuclear': ['nuclear', 'reactor', 'fission', 'fusion'],
  'solar': ['solar', 'photovoltaic', 'pv'],
  'wind': ['wind', 'offshore wind'],
  'battery': ['battery', 'storage', 'energy storage'],
  'data centers': ['data center', 'hyperscale', 'compute'],
  'automotive / EV': ['electric vehicle', 'ev', 'charging'],
  'utilities': ['grid', 'utility', 'transmission', 'distribution']
};

function extractTags(text) {
  const lower = text.toLowerCase();
  const materials = [];
  const sectors = [];

  for (const [mat, keywords] of Object.entries(MATERIAL_KEYWORDS)) {
    if (keywords.some(kw => lower.includes(kw))) materials.push(mat);
  }
  for (const [sec, keywords] of Object.entries(SECTOR_KEYWORDS)) {
    if (keywords.some(kw => lower.includes(kw))) sectors.push(sec);
  }

  return { materials, sectors };
}

async function fetchDoe() {
  const items = [];

  for (const feed of FEEDS) {
    try {
      const res = await fetch(feed.url, {
        signal: AbortSignal.timeout(15000),
        headers: { 'Accept': 'application/rss+xml, application/xml, text/xml' }
      });

      if (!res.ok) {
        // Fallback: try alternate URL
        continue;
      }

      const xml = await res.text();
      const parsed = await parseStringPromise(xml, { explicitArray: false });

      const channel = parsed?.rss?.channel;
      if (!channel) continue;

      const rssItems = Array.isArray(channel.item) ? channel.item : (channel.item ? [channel.item] : []);

      for (const item of rssItems.slice(0, 10)) {
        const title = item.title || '';
        const description = (item.description || '').replace(/<[^>]*>/g, '');
        const link = item.link || '';
        const pubDate = item.pubDate || null;
        const fullText = title + ' ' + description;
        const { materials, sectors } = extractTags(fullText);

        items.push(normalizeItem({
          source: 'DOE',
          sourceType: 'official',
          title: title.slice(0, 300),
          summary: description.slice(0, 800),
          url: link,
          publishedAt: pubDate,
          region: 'US',
          themes: feed.themes,
          materials,
          sectors,
          channels: feed.channels,
          dataStatus: 'periodic',
          importanceScore: 6,
          rawPayload: { feedLabel: feed.label }
        }));
      }
    } catch (err) {
      console.error(`[DOE] Feed "${feed.label}" failed:`, err.message);
    }
  }

  return items;
}

module.exports = { fetchDoe };
