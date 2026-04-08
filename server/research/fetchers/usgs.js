// USGS Minerals fetcher — U.S. Geological Survey mineral commodity data
// Fetches from USGS NMIC news/publications RSS
const { normalizeItem } = require('./normalize');
const { parseStringPromise } = require('xml2js');

const FEEDS = [
  {
    url: 'https://www.usgs.gov/centers/national-minerals-information-center/science/rss.xml',
    label: 'USGS Minerals',
    themes: ['critical minerals'],
    channels: ['supply chain', 'stockpiling']
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

  for (const feed of FEEDS) {
    try {
      const res = await fetch(feed.url, {
        signal: AbortSignal.timeout(15000),
        headers: { 'Accept': 'application/rss+xml, application/xml, text/xml' }
      });

      if (!res.ok) {
        // Fallback: provide static reference to MCS
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
        continue;
      }

      const xml = await res.text();
      const parsed = await parseStringPromise(xml, { explicitArray: false });

      let rssItems = [];
      if (parsed?.rss?.channel?.item) {
        const raw = parsed.rss.channel.item;
        rssItems = Array.isArray(raw) ? raw : [raw];
      } else if (parsed?.feed?.entry) {
        const raw = parsed.feed.entry;
        rssItems = (Array.isArray(raw) ? raw : [raw]).map(e => ({
          title: e.title?._ || e.title || '',
          description: e.summary?._ || e.summary || '',
          link: e.link?.$.href || e.id || '',
          pubDate: e.published || e.updated || null
        }));
      }

      for (const item of rssItems.slice(0, 10)) {
        const title = (typeof item.title === 'object' ? item.title._ : item.title) || '';
        const description = ((typeof item.description === 'object' ? item.description._ : item.description) || '').replace(/<[^>]*>/g, '');
        const link = item.link || '';
        const pubDate = item.pubDate || null;
        const fullText = title + ' ' + description;
        const materials = extractMinerals(fullText);

        items.push(normalizeItem({
          source: 'USGS',
          sourceType: 'official',
          title: title.slice(0, 300),
          summary: description.slice(0, 800),
          url: link,
          publishedAt: pubDate,
          region: 'US / Global',
          themes: feed.themes,
          materials,
          channels: feed.channels,
          dataStatus: 'periodic',
          importanceScore: materials.length > 0 ? 7 : 5,
          rawPayload: { feedLabel: feed.label }
        }));
      }
    } catch (err) {
      console.error(`[USGS] Feed "${feed.label}" failed:`, err.message);
    }
  }

  return items;
}

module.exports = { fetchUsgs };
