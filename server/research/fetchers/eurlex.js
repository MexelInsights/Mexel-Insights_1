// EUR-Lex fetcher — EU legislation and regulatory publications
// Uses EU Publications Office SPARQL endpoint
const { normalizeItem } = require('./normalize');

const SPARQL_ENDPOINT = 'https://publications.europa.eu/webapi/rdf/sparql';

const CONCEPT_QUERIES = [
  {
    conceptId: '2281',
    label: 'Energy policy',
    themes: ['energy policy', 'ESG / sustainability policy'],
    channels: ['ESG compliance', 'energy transition']
  },
  {
    conceptId: '5765',
    label: 'Raw materials / minerals',
    themes: ['critical minerals', 'industrial policy'],
    channels: ['supply chain', 'trade policy']
  },
  {
    conceptId: '3730',
    label: 'Environmental policy',
    themes: ['ESG / sustainability policy', 'energy transition'],
    channels: ['ESG compliance', 'climate policy']
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
  const text = (title + ' ' + (summary || '')).toLowerCase();
  return RELEVANCE_KEYWORDS.some(kw => text.includes(kw));
}

function buildSparqlQuery(conceptId) {
  return `
PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>
SELECT ?work ?title ?date WHERE {
  ?work cdm:work_date_document ?date .
  ?work cdm:work_is_about_concept_eurovoc <http://eurovoc.europa.eu/${conceptId}> .
  ?exp cdm:expression_belongs_to_work ?work .
  ?exp cdm:expression_title ?title .
  FILTER(lang(?title) = "en")
}
ORDER BY DESC(?date) LIMIT 10`.trim();
}

function workUriToEurLexUrl(workUri) {
  // Extract CELEX number from URI like http://publications.europa.eu/resource/cellar/...
  // or build a generic link
  const celexMatch = workUri.match(/\/celex\/(\w+)/i);
  if (celexMatch) {
    return `https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:${celexMatch[1]}`;
  }
  return `https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=${encodeURIComponent(workUri)}`;
}

async function fetchEurLex() {
  const items = [];
  const seenUris = new Set();

  for (const concept of CONCEPT_QUERIES) {
    try {
      const query = buildSparqlQuery(concept.conceptId);
      const params = new URLSearchParams({ query });

      const res = await fetch(SPARQL_ENDPOINT, {
        method: 'POST',
        signal: AbortSignal.timeout(20000),
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'MexelInsights/1.0 (research aggregator)'
        },
        body: params.toString()
      });

      if (!res.ok) {
        console.error(`[EUR-Lex] SPARQL query for concept ${concept.conceptId} (${concept.label}) returned ${res.status}`);
        continue;
      }

      const data = await res.json();
      const bindings = data?.results?.bindings || [];

      for (const binding of bindings) {
        const workUri = binding.work?.value || '';
        if (!workUri || seenUris.has(workUri)) continue;
        seenUris.add(workUri);

        const title = binding.title?.value || '';
        const dateStr = binding.date?.value || null;

        // Filter for relevance
        if (!isRelevant(title, '')) continue;

        const url = workUriToEurLexUrl(workUri);

        items.push(normalizeItem({
          source: 'EUR-Lex',
          sourceType: 'official',
          title: title.slice(0, 300),
          summary: '',
          url,
          publishedAt: dateStr,
          region: 'EU',
          themes: concept.themes,
          channels: concept.channels,
          dataStatus: 'periodic',
          importanceScore: 6,
          rawPayload: { conceptId: concept.conceptId, conceptLabel: concept.label, workUri }
        }));
      }
    } catch (err) {
      console.error(`[EUR-Lex] SPARQL query for concept ${concept.conceptId} (${concept.label}) failed:`, err.message);
    }
  }

  // Fallback if no items were fetched
  if (items.length === 0) {
    items.push(normalizeItem({
      source: 'EUR-Lex',
      sourceType: 'official',
      title: 'EU Critical Raw Materials Act (CRMA)',
      summary: 'Regulation establishing a framework to ensure a secure and sustainable supply of critical raw materials in the EU.',
      url: 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32024R1252',
      region: 'EU',
      themes: ['critical minerals', 'industrial policy'],
      channels: ['supply chain', 'trade policy'],
      dataStatus: 'static',
      importanceScore: 6
    }));
  }

  // Cap at 15 items total
  return items.slice(0, 15);
}

module.exports = { fetchEurLex };
