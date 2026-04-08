// Federal Register API fetcher
// Official US government regulations, executive orders, and agency rules
const { normalizeItem } = require('./normalize');

const SEARCH_TERMS = [
  {
    query: 'critical minerals',
    themes: ['critical minerals', 'industrial policy'],
    channels: ['trade policy', 'stockpiling', 'permitting']
  },
  {
    query: 'export controls',
    themes: ['geopolitics', 'industrial policy'],
    channels: ['export controls', 'sanctions']
  },
  {
    query: 'energy policy',
    themes: ['energy policy', 'ESG / sustainability policy'],
    channels: ['trade policy', 'ESG compliance']
  },
  {
    query: 'sanctions',
    themes: ['geopolitics', 'industrial policy'],
    channels: ['sanctions', 'trade policy']
  },
  {
    query: 'environmental regulation emissions',
    themes: ['ESG / sustainability policy', 'energy transition bottlenecks'],
    channels: ['ESG compliance']
  }
];

async function fetchFederalRegister() {
  const items = [];

  for (const search of SEARCH_TERMS) {
    try {
      const params = new URLSearchParams({
        'conditions[term]': search.query,
        'per_page': '5',
        'order': 'newest'
      });

      const url = `https://www.federalregister.gov/api/v1/documents.json?${params}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!res.ok) continue;

      const data = await res.json();
      const results = data?.results || [];

      for (const doc of results) {
        const docType = doc.type || 'Document';
        const agencies = (doc.agencies || []).map(a => a.name || a.raw_name).filter(Boolean);

        items.push(normalizeItem({
          source: 'Federal Register',
          sourceType: 'official',
          title: doc.title || 'Untitled',
          summary: doc.abstract || doc.excerpt || `${docType} published ${doc.publication_date || 'recently'} by ${agencies.join(', ') || 'US Government'}.`,
          url: doc.html_url || doc.pdf_url || '',
          publishedAt: doc.publication_date || null,
          region: 'US',
          themes: search.themes,
          channels: search.channels,
          entities: agencies,
          dataStatus: 'periodic',
          importanceScore: docType === 'Presidential Document' ? 8 : docType === 'Rule' ? 7 : 5,
          rawPayload: {
            type: docType,
            document_number: doc.document_number,
            agencies,
            docket_ids: doc.docket_ids || []
          }
        }));
      }
    } catch (err) {
      console.error(`[FedRegister] Search "${search.query}" failed:`, err.message);
    }
  }

  return items;
}

module.exports = { fetchFederalRegister };
