// IEA fetcher — International Energy Agency
// Scrapes IEA news page (RSS feed returns 404)
const { normalizeItem } = require('./normalize');

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

  try {
    const res = await fetch('https://www.iea.org/news', {
      signal: AbortSignal.timeout(15000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });

    if (!res.ok) {
      console.error(`[IEA] News page returned ${res.status}`);
      return items;
    }

    const html = await res.text();

    // Extract all <a> tags with href matching /news/ pattern
    const linkRegex = /<a\s[^>]*href="(\/news\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    const seen = new Set();
    const articles = [];
    let match;

    while ((match = linkRegex.exec(html)) !== null) {
      const href = match[1];
      // Skip pagination, category, and anchor links
      if (href === '/news' || href === '/news/' || href.includes('?') || href.includes('#')) continue;
      if (seen.has(href)) continue;
      seen.add(href);

      // Strip HTML tags from inner content to get title text
      const rawText = match[2].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
      if (!rawText) continue;

      articles.push({ href, rawText });
    }

    // Extract dates from nearby content using DD Month YYYY pattern
    const dateRegex = /(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/gi;
    const pageDates = [];
    let dateMatch;
    while ((dateMatch = dateRegex.exec(html)) !== null) {
      pageDates.push({
        index: dateMatch.index,
        dateStr: `${dateMatch[1]} ${dateMatch[2]} ${dateMatch[3]}`
      });
    }

    for (const article of articles.slice(0, 15)) {
      const title = article.rawText.slice(0, 300);
      const url = `https://www.iea.org${article.href}`;
      const themes = assignThemes(title);

      // Find the closest date that appears near this article's href in the HTML
      let publishedAt = null;
      const hrefIndex = html.indexOf(article.href);
      if (hrefIndex !== -1 && pageDates.length > 0) {
        let closestDate = null;
        let closestDist = Infinity;
        for (const pd of pageDates) {
          const dist = Math.abs(pd.index - hrefIndex);
          if (dist < closestDist) {
            closestDist = dist;
            closestDate = pd.dateStr;
          }
        }
        // Only use the date if it's reasonably close (within 2000 chars)
        if (closestDate && closestDist < 2000) {
          publishedAt = new Date(closestDate).toISOString();
        }
      }

      items.push(normalizeItem({
        source: 'IEA',
        sourceType: 'institutional',
        title,
        summary: '',
        url,
        publishedAt,
        region: 'Global',
        themes,
        dataStatus: 'periodic',
        importanceScore: 6
      }));
    }
  } catch (err) {
    console.error('[IEA] Scrape failed:', err.message);
  }

  return items;
}

module.exports = { fetchIea };
