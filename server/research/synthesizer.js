// Mexel Synthesis Layer — converts public-source inputs into original intelligence objects
// Uses LLM provider (Anthropic or Ollama) to produce original Mexel analysis from ingested research items
const crypto = require('crypto');
const knowledge = require('./knowledge');

const SYNTHESIS_SYSTEM_PROMPT = `You are the Mexel Insights synthesis engine. Your role is to transform raw public-source intelligence items into original, decision-grade analysis for institutional clients.

You receive batches of normalized research items (titles, summaries, sources, themes, materials, sectors). You must produce original Mexel synthesis — NOT summaries of the source text.

Output ONLY valid JSON. No markdown, no code fences.

For each synthesis object, produce:
{
  "what_changed": "One sentence: what shifted in the last 24-48 hours",
  "why_it_matters": "2-3 sentences: transmission mechanism to markets, portfolios, or procurement",
  "transmission_mechanism": "How this event propagates: e.g. 'export control → supply shortage → price spike → procurement cost'",
  "commodity_implications": ["Affected commodities with direction"],
  "materials_implications": ["Affected materials with supply/demand impact"],
  "sector_implications": ["Affected sectors with expected impact direction"],
  "policy_relevance": "Connection to active policy frameworks (CBAM, CSRD, IRA, CRMA, etc.)",
  "best_relative_expressions": ["Sectors/assets that benefit relatively"],
  "most_pressured_expressions": ["Sectors/assets under most pressure"],
  "time_horizons": {
    "1_week": "Immediate expected developments",
    "1_month": "Near-term trajectory",
    "3_months": "Medium-term structural implications"
  },
  "triggers": ["Specific events that would escalate this"],
  "invalidation": ["What would prove this assessment wrong"],
  "confidence": "High|Medium|Low",
  "confidence_reason": "Why this confidence level",
  "themes": ["primary themes"],
  "materials": ["affected materials"],
  "sectors": ["affected sectors"],
  "source_count": number,
  "sources": ["Source names used"]
}

Rules:
- Be specific, not generic. Name materials, jurisdictions, companies, and timelines.
- Every claim must trace to the input items. Do not hallucinate events.
- If inputs are thin, say so. Lower confidence accordingly.
- Prioritise actionable implications over description.
- Use Mexel's framework: Context → Signals → Transmission → Implication → Decision.
- When MEXEL KNOWLEDGE CONTEXT cards are provided, use them as canonical scaffolding on bottleneck mechanics, public-equity exposure, and transmission channels. Do not contradict them and do not fabricate detail beyond them.`;

// Group items into synthesis clusters by theme overlap
function clusterItems(items, maxPerCluster = 8) {
  if (items.length === 0) return [];

  const clusters = [];
  const used = new Set();

  // Sort by composite score descending
  const sorted = [...items].sort((a, b) =>
    (b.scores?.composite || 0) - (a.scores?.composite || 0)
  );

  for (const item of sorted) {
    if (used.has(item.id)) continue;

    const cluster = [item];
    used.add(item.id);

    const itemThemes = new Set(item.themes || []);
    const itemMaterials = new Set(item.materials || []);

    // Find related items
    for (const other of sorted) {
      if (used.has(other.id)) continue;
      if (cluster.length >= maxPerCluster) break;

      const themeOverlap = (other.themes || []).some(t => itemThemes.has(t));
      const materialOverlap = (other.materials || []).some(m => itemMaterials.has(m));

      if (themeOverlap || materialOverlap) {
        cluster.push(other);
        used.add(other.id);
      }
    }

    if (cluster.length >= 1) {
      clusters.push(cluster);
    }
  }

  return clusters.slice(0, 6); // Max 6 synthesis clusters
}

/**
 * Synthesize intelligence from clustered items using the LLM provider.
 * @param {Array} items - Scored research items
 * @param {object} llm - LLM provider instance from createLLM()
 * @returns {Array} synthesis objects
 */
async function synthesize(items, llm) {
  if (!llm) {
    console.error('[Synthesizer] No LLM provider available');
    return [];
  }

  const clusters = clusterItems(items);
  if (clusters.length === 0) return [];

  console.log(`[Synthesizer] Processing ${clusters.length} clusters from ${items.length} items`);
  const syntheses = [];

  for (const cluster of clusters) {
    try {
      // Prepare cluster summary for LLM
      const clusterSummary = cluster.map(item => ({
        title: item.title,
        summary: item.summary,
        source: item.source,
        themes: item.themes,
        materials: item.materials,
        sectors: item.sectors,
        channels: item.channels,
        region: item.region,
        published_at: item.published_at,
        scores: item.scores
      }));

      // Find relevant Mexel knowledge cards for this cluster
      const clusterText = cluster.map(i => `${i.title} ${i.summary || ''}`).join(' ');
      const clusterThemes = [...new Set(cluster.flatMap(i => i.themes || []))];
      const clusterMaterials = [...new Set(cluster.flatMap(i => i.materials || []))];
      const clusterSectors = [...new Set(cluster.flatMap(i => i.sectors || []))];
      const relevantCards = knowledge.findRelevantCards({
        text: clusterText, themes: clusterThemes, materials: clusterMaterials, sectors: clusterSectors, limit: 3
      });
      const contextBlock = knowledge.buildContextBlock(relevantCards);

      const userPrompt = `Synthesize these ${cluster.length} intelligence items into ONE Mexel synthesis object. Return a single JSON object (not an array).

${contextBlock ? contextBlock + '\n\n' : ''}Items:
${JSON.stringify(clusterSummary, null, 2)}`;

      const { parsed: synthesis } = await llm.generateJSON(SYNTHESIS_SYSTEM_PROMPT, userPrompt, 1500);

      if (!synthesis) {
        console.error('[Synthesizer] LLM returned no parseable synthesis');
        continue;
      }

      // Add metadata
      synthesis.id = crypto.createHash('md5')
        .update(cluster.map(i => i.id).join(':'))
        .digest('hex')
        .slice(0, 16);
      synthesis.created_at = new Date().toISOString();
      synthesis.source_items = cluster.map(i => i.id);
      synthesis.source_count = cluster.length;
      synthesis.sources = [...new Set(cluster.map(i => i.source))];
      synthesis.data_status = 'synthesized';
      synthesis.knowledge_cards = relevantCards.map(c => c.id);

      syntheses.push(synthesis);
      console.log(`[Synthesizer] Cluster synthesized: ${synthesis.what_changed?.slice(0, 80) || 'OK'}`);
    } catch (err) {
      console.error('[Synthesizer] Cluster synthesis failed:', err.message);
    }
  }

  return syntheses;
}

module.exports = { synthesize, clusterItems };
