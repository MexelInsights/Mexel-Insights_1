// Scoring engine — urgency, relevance, and confidence scores
// Factors: recency, corroboration, official-source presence, strategic-material relevance,
// sanctions/export-control/chokepoint involvement

const HIGH_PRIORITY_MATERIALS = new Set([
  'gallium', 'germanium', 'antimony', 'rare earths', 'cobalt', 'lithium',
  'tungsten', 'tantalum', 'uranium', 'tellurium', 'indium', 'copper'
]);

const ESCALATION_CHANNELS = new Set([
  'sanctions', 'export controls', 'supply chain'
]);

const OFFICIAL_SOURCES = new Set([
  'EIA', 'Federal Register', 'EUR-Lex', 'DOE', 'USGS'
]);

function scoreItem(item, allItems = []) {
  let urgency = 0;
  let relevance = 0;
  let confidence = 0;

  // --- URGENCY ---
  // Recency: items from last 6h = +3, 24h = +2, 48h = +1
  if (item.published_at) {
    const ageHours = (Date.now() - new Date(item.published_at).getTime()) / (1000 * 60 * 60);
    if (ageHours < 6) urgency += 3;
    else if (ageHours < 24) urgency += 2;
    else if (ageHours < 48) urgency += 1;
  }

  // Escalation channels
  const itemChannels = new Set(item.channels || []);
  for (const ch of ESCALATION_CHANNELS) {
    if (itemChannels.has(ch)) urgency += 1.5;
  }

  // Chokepoint/shipping involvement
  if ((item.themes || []).includes('shipping / chokepoints')) urgency += 1;

  // Cap at 10
  urgency = Math.min(10, Math.round(urgency * 10) / 10);

  // --- RELEVANCE ---
  // Strategic material involvement
  const mats = item.materials || [];
  const strategicCount = mats.filter(m => HIGH_PRIORITY_MATERIALS.has(m)).length;
  relevance += Math.min(3, strategicCount);

  // Multi-theme items are more relevant
  relevance += Math.min(2, (item.themes || []).length * 0.5);

  // Sector breadth
  relevance += Math.min(2, (item.sectors || []).length * 0.4);

  // Base importance from fetcher
  relevance += (item.importance_score || 0) * 0.3;

  // Cap at 10
  relevance = Math.min(10, Math.round(relevance * 10) / 10);

  // --- CONFIDENCE ---
  // Official source: +3
  if (OFFICIAL_SOURCES.has(item.source)) confidence += 3;
  else if (item.source_type === 'institutional') confidence += 2;
  else confidence += 1;

  // Corroboration: how many other items from different sources cover similar themes?
  if (allItems.length > 0) {
    const itemThemes = new Set(item.themes || []);
    let corroborating = 0;
    const seenSources = new Set();
    for (const other of allItems) {
      if (other.id === item.id) continue;
      if (seenSources.has(other.source)) continue;
      const overlap = (other.themes || []).some(t => itemThemes.has(t));
      if (overlap) {
        corroborating++;
        seenSources.add(other.source);
      }
    }
    confidence += Math.min(3, corroborating * 0.75);
  }

  // Has a URL (verifiable)
  if (item.url) confidence += 1;

  // Has a published date
  if (item.published_at) confidence += 0.5;

  // Cap at 10
  confidence = Math.min(10, Math.round(confidence * 10) / 10);

  return {
    ...item,
    scores: {
      urgency,
      relevance,
      confidence,
      composite: Math.round(((urgency * 0.35) + (relevance * 0.4) + (confidence * 0.25)) * 10) / 10
    }
  };
}

function scoreAll(items) {
  return items.map(item => scoreItem(item, items));
}

module.exports = { scoreItem, scoreAll };
