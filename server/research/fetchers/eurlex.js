// EUR-Lex fetcher — EU legislation and regulatory publications
// Uses EUR-Lex RSS/Atom feeds for CBAM, CSRD, CRMA, energy directives
const { normalizeItem } = require('./normalize');
const { parseStringPromise } = require('xml2js');

const FEEDS = [
  {
    url: 'https://eur-lex.europa.eu/EN/display-feed.html?rssId=LegSec&domain=eurlex&locale=en',
    label: 'EU Legislation',
    themes: ['ESG / sustainability policy', 'industrial policy', 'energy policy'],
    channels: ['ESG compliance', 'trade policy']
  }
];

// Keywords that signal relevance to Mexel themes
const RELEVANCE_KEYWORDS = [
  'cbam', 'carbon border', 'csrd', 'sustainability reporting', 'critical raw materials',
  'crma', 'energy', 'mineral', 'battery', 'emission', 'renewable', 'hydrogen',
  'chemical', 'export', 'import', 'trade', 'sanction', 'regulation', 'climate',
  'esg', 'taxonomy', 'green deal', 'due diligence', 'supply chain'
];

function isRelevant(title, summary) {
  const text = (title + ' ' + summary).toLowerCase();
  return RELEVANCE_KEYWORDS.some(kw => text.includes(kw));
}

async function fetchEurLex() {
  const items = [];

  for (const feed of FEEDS) {
    try {
      const res = await fetch(feed.url, {
        signal: AbortSignal.timeout(15000),
        headers: { 'Accept': 'application/rss+xml, application/xml, text/xml' }
      });
      if (!res.ok) continue;

      const xml = await res.text();
      const parsed = await parseStringPromise(xml, { explicitArray: false });

      // Handle RSS 2.0 format
      const channel = parsed?.rss?.channel;
      if (!channel) continue;

      const rssItems = Array.isArray(channel.item) ? channel.item : (channel.item ? [channel.item] : []);

      for (const item of rssItems.slice(0, 15)) {
        const title = item.title || '';
        const description = item.description || '';
        const link = item.link || '';
        const pubDate = item.pubDate || null;

        // Filter for relevance
        if (!isRelevant(title, description)) continue;

        items.push(normalizeItem({
          source: 'EUR-Lex',
          sourceType: 'official',
          title: title.slice(0, 300),
          summary: description.replace(/<[^>]*>/g, '').slice(0, 800),
          url: link,
          publishedAt: pubDate,
          region: 'EU',
          themes: feed.themes,
          channels: feed.channels,
          dataStatus: 'periodic',
          importanceScore: 6,
          rawPayload: { feedLabel: feed.label }
        }));
      }
    } catch (err) {
      console.error(`[EUR-Lex] Feed "${feed.label}" failed:`, err.message);
    }
  }

  return items;
}

module.exports = { fetchEurLex };
