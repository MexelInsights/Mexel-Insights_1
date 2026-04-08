// IEA fetcher — International Energy Agency
// Fetches IEA news and publications via RSS
const { normalizeItem } = require('./normalize');
const { parseStringPromise } = require('xml2js');

const FEEDS = [
  {
    url: 'https://www.iea.org/rss/news.xml',
    label: 'IEA News',
    themes: ['oil / gas / LNG', 'energy policy', 'ESG / sustainability policy'],
    channels: ['supply chain', 'trade policy', 'power demand']
  }
];

// IEA content is almost always relevant — just tag it
const THEME_KEYWORDS = {
  'oil / gas / LNG': ['oil', 'gas', 'lng', 'petroleum', 'opec', 'crude', 'natural gas'],
  'energy policy': ['policy', 'outlook', 'forecast', 'investment', 'grid', 'electricity'],
  'ESG / sustainability policy': ['climate', 'emission', 'net zero', 'clean energy', 'renewable'],
  'energy transition bottlenecks': ['bottleneck', 'constraint', 'shortage', 'infrastructure'],
  'critical minerals': ['mineral', 'lithium', 'cobalt', 'copper', 'rare earth', 'critical']
};

function assignThemes(text) {
  const lower = text.toLowerCase();
  const themes = new Set();
  for (const [theme, keywords] of Object.entries(THEME_KEYWORDS)) {
    if (keywords.some(kw => lower.includes(kw))) themes.add(theme);
  }
  if (themes.size === 0) themes.add('energy policy');
  return [...themes];
}

async function fetchIea() {
  const items = [];

  for (const feed of FEEDS) {
    try {
      const res = await fetch(feed.url, {
        signal: AbortSignal.timeout(15000),
        headers: { 'Accept': 'application/rss+xml, application/xml, text/xml' }
      });

      if (!res.ok) {
        // IEA may not have a public RSS — fallback to static entry
        items.push(normalizeItem({
          source: 'IEA',
          sourceType: 'institutional',
          title: 'IEA — Feed unavailable',
          summary: 'IEA RSS feed is not currently accessible. Monitoring will resume when available.',
          url: 'https://www.iea.org/news',
          region: 'Global',
          themes: feed.themes,
          dataStatus: 'static',
          importanceScore: 2
        }));
        continue;
      }

      const xml = await res.text();
      const parsed = await parseStringPromise(xml, { explicitArray: false });

      // Handle both RSS 2.0 and Atom formats
      let rssItems = [];
      if (parsed?.rss?.channel?.item) {
        const raw = parsed.rss.channel.item;
        rssItems = Array.isArray(raw) ? raw : [raw];
      } else if (parsed?.feed?.entry) {
        const raw = parsed.feed.entry;
        rssItems = (Array.isArray(raw) ? raw : [raw]).map(e => ({
          title: e.title?._ || e.title || '',
          description: e.summary?._ || e.summary || e.content?._ || '',
          link: e.link?.$.href || e.link || '',
          pubDate: e.published || e.updated || null
        }));
      }

      for (const item of rssItems.slice(0, 10)) {
        const title = (typeof item.title === 'object' ? item.title._ : item.title) || '';
        const description = ((typeof item.description === 'object' ? item.description._ : item.description) || '').replace(/<[^>]*>/g, '');
        const link = item.link || '';
        const pubDate = item.pubDate || null;
        const themes = assignThemes(title + ' ' + description);

        items.push(normalizeItem({
          source: 'IEA',
          sourceType: 'institutional',
          title: title.slice(0, 300),
          summary: description.slice(0, 800),
          url: link,
          publishedAt: pubDate,
          region: 'Global',
          themes,
          channels: feed.channels,
          dataStatus: 'periodic',
          importanceScore: 6,
          rawPayload: { feedLabel: feed.label }
        }));
      }
    } catch (err) {
      console.error(`[IEA] Feed "${feed.label}" failed:`, err.message);
    }
  }

  return items;
}

module.exports = { fetchIea };
