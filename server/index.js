/**
 * MEXEL INSIGHTS â€” Backend API Server
 * Proxies requests to Anthropic Claude Opus API
 * Keeps API key secure on the server side
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const Anthropic = require('@anthropic-ai/sdk');
const path = require('path');

// Research pipeline
const store = require('./research/store');
const { startScheduler, runFullPipeline, refreshSource, setAnthropicClient } = require('./research/scheduler');

const app = express();
const PORT = process.env.PORT || 3000;

// â”€â”€ ANTHROPIC CLIENT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Initialize research pipeline
store.init();
setAnthropicClient(anthropic);

// â”€â”€ MIDDLEWARE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.use(express.json());
app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || 'http://localhost:3000',
  methods: ['GET', 'POST'],
}));

// Rate limiting: 30 AI requests per minute per IP
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Too many requests. Please wait a moment.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Serve static files from /public
app.use(express.static(path.join(__dirname, '../public')));

// Error classifier for Anthropic API errors
function classifyApiError(err) {
  const msg = err.message || '';
  const status = err.status || err.statusCode || 500;

  if (!process.env.ANTHROPIC_API_KEY) {
    return { code: 'CONFIG_ERROR', message: 'API key not configured. Set ANTHROPIC_API_KEY environment variable.', status: 503 };
  }
  if (status === 401 || msg.includes('auth') || msg.includes('API key')) {
    return { code: 'AUTH_ERROR', message: 'API authentication failed. Check ANTHROPIC_API_KEY.', status: 401 };
  }
  if (status === 404 || msg.includes('model') || msg.includes('not found')) {
    return { code: 'MODEL_ERROR', message: 'Model not available. ' + msg, status: 502 };
  }
  if (status === 429 || msg.includes('rate') || msg.includes('limit') || msg.includes('quota')) {
    return { code: 'RATE_LIMIT', message: 'Rate limit reached. Please wait a moment and retry.', status: 429 };
  }
  if (status === 529 || msg.includes('overloaded')) {
    return { code: 'OVERLOADED', message: 'AI service is temporarily overloaded. Please retry in a few seconds.', status: 503 };
  }
  if (msg.includes('timeout') || msg.includes('ETIMEDOUT') || msg.includes('ECONNREFUSED')) {
    return { code: 'TIMEOUT', message: 'Request timed out. The AI service may be slow — please retry.', status: 504 };
  }
  if (msg.includes('JSON') || msg.includes('parse') || msg.includes('Unexpected token')) {
    return { code: 'PARSE_ERROR', message: 'AI returned an unparseable response. Please retry.', status: 502 };
  }
  return { code: 'INTERNAL', message: 'Generation failed: ' + msg.slice(0, 150), status: 500 };
}

// â”€â”€ SYSTEM PROMPT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const MEXEL_SYSTEM_PROMPT = `You are the lead intelligence analyst at Mexel Insights â€” an independent geopolitical intelligence firm specialising in energy transition, critical minerals, regulatory pressure, and geopolitical risk.

Your identity:
- Firm: Mexel Insights ("Decision-Grade Intelligence for the Energy Transition")
- Output style: Always structured, always sourced, always actionable
- Voice: Analytical, direct, evidence-led â€” not sensational, not vague
- Framework: Every output follows Context â†’ Signals â†’ Moves â†’ Uncertainty Flags

Your products:
1. RRM (Rapid Response Memos): 48-72h event-driven briefs
2. Scenario Briefings: 3-scenario structured analysis (Base/Stress/Tail)
3. PPI (Policy Pressure Index): Sector Ã— Jurisdiction scoring (0-5)
4. MMR (Minerals & Metals Radar): Weekly signal tape across 10 materials
5. AI Energy Demand Radar: Compute-to-power intelligence
6. Procurement Playbooks: Commercial guidance and clause libraries

Core rules:
- Every quantitative claim must reference a real or plausible source
- Confidence levels: High (multiple primary sources), Medium (single primary), Low (inference)
- Risk bands: 1=Low, 2=Guarded, 3=Elevated, 4=High, 5=Critical
- Moves are time-bounded: Action + Owner + Timeframe + Confidence
- Always flag key assumptions and data gaps
- Disclaimer: "For informational purposes only. Not legal, financial, or investment advice. Mexel Insights Ltd."

Output format: Return clean JSON unless the user asks for prose. No markdown backticks around JSON.`;

// â”€â”€ API ROUTES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * POST /api/generate
 * General-purpose intelligence generation
 * Body: { prompt, outputType, context }
 */
app.post('/api/generate', aiLimiter, async (req, res) => {
  const { prompt, outputType = 'text', context = '' } = req.body;

  if (!prompt || prompt.trim().length < 5) {
    return res.status(400).json({ error: 'Prompt is required.' });
  }

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250514',
      max_tokens: 2000,
      system: MEXEL_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: context
            ? `Context: ${context}\n\n${prompt}`
            : prompt,
        },
      ],
    });

    const text = response.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('\n');

    res.json({ result: text, outputType });
  } catch (err) {
    console.error('Generate error:', err.message, err.status || '');
    const classified = classifyApiError(err);
    res.status(classified.status).json({ error: classified.message, code: classified.code });
  }
});

/**
 * POST /api/rrm
 * Generate a Rapid Response Memo
 * Body: { event, sector, region }
 */
app.post('/api/rrm', aiLimiter, async (req, res) => {
  const { event, sector = 'Energy', region = 'Global' } = req.body;

  if (!event) return res.status(400).json({ error: 'Event description required.' });

  const prompt = `Generate a Rapid Response Memo (RRM) for the following event.

Event: ${event}
Sector: ${sector}
Region: ${region}

Return ONLY valid JSON in this exact structure (no markdown, no backticks):
{
  "headline": "One sentence â€” what happened and why it matters",
  "confidence": "High|Medium|Low",
  "confidenceReason": "Brief reason",
  "bullets": {
    "what": "One sentence factual summary",
    "why": "One sentence analytical summary",
    "do": "One sentence actionable summary"
  },
  "context": "2-3 paragraphs of factual context",
  "signals": [
    { "text": "Signal description", "type": "observation|implication|precedent" }
  ],
  "moves": [
    { "action": "What to do", "timeframe": "By when", "owner": "Which function", "confidence": "High|Medium|Low" }
  ],
  "uncertaintyFlags": [
    { "assumption": "Key assumption", "wouldChange": "What would change if this assumption is wrong" }
  ],
  "riskBand": 1-5,
  "sources": ["Source 1", "Source 2", "Source 3"]
}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250514',
      max_tokens: 2000,
      system: MEXEL_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content.filter(b => b.type === 'text').map(b => b.text).join('');
    const clean = text.replace(/```json|```/g, '').trim();
    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch (parseErr) {
      console.error('RRM JSON parse error. Raw response:', clean.slice(0, 500));
      return res.status(502).json({ error: 'AI returned invalid JSON. Please retry.', code: 'PARSE_ERROR' });
    }
    res.json({ rrm: parsed });
  } catch (err) {
    console.error('RRM error:', err.message, err.status || '');
    const classified = classifyApiError(err);
    res.status(classified.status).json({ error: classified.message, code: classified.code });
  }
});

/**
 * POST /api/scenario
 * Generate a Scenario Briefing
 * Body: { topic, sector, timeframe }
 */
app.post('/api/scenario', aiLimiter, async (req, res) => {
  const { topic, sector = 'Energy', timeframe = '12 months' } = req.body;

  if (!topic) return res.status(400).json({ error: 'Topic required.' });

  const prompt = `Generate a Scenario Briefing for the following topic.

Topic: ${topic}
Sector: ${sector}
Timeframe: ${timeframe}

For each scenario, include best/worst relative sectors, commodity & material implications, time-horizon views (1 week, 1 month, 3 months), and invalidation conditions.

Return ONLY valid JSON (no markdown):
{
  "framingQuestion": "The core question this briefing answers",
  "whatChanged": "1-2 sentence summary of the triggering event",
  "whyItMatters": "1-2 sentence summary of significance",
  "transmissionMechanism": "How the event transmits through commodity, energy, and financial channels",
  "signals": [
    { "signal": "Current signal", "source": "Source reference", "implication": "What it means" }
  ],
  "scenarios": {
    "base": {
      "title": "Scenario title",
      "probability": "X%",
      "description": "What happens",
      "triggers": ["Trigger 1", "Trigger 2"],
      "best_sectors": ["Sector that benefits"],
      "worst_sectors": ["Sector most exposed"],
      "commodity_implications": ["Material/commodity impact"],
      "time_horizons": { "1w": "Near-term view", "1m": "Medium-term view", "3m": "Longer-term view" },
      "invalidation_conditions": ["What would make this scenario no longer valid"],
      "moves": [{ "action": "What to do", "timeframe": "By when", "owner": "Function" }]
    },
    "stress": {
      "title": "Scenario title",
      "probability": "X%",
      "description": "What happens",
      "triggers": ["What tips it from base to stress"],
      "best_sectors": ["Sector that benefits"],
      "worst_sectors": ["Sector most exposed"],
      "commodity_implications": ["Material/commodity impact"],
      "time_horizons": { "1w": "Near-term view", "1m": "Medium-term view", "3m": "Longer-term view" },
      "invalidation_conditions": ["What would invalidate"],
      "moves": [{ "action": "What to do", "timeframe": "By when", "owner": "Function" }]
    },
    "tail": {
      "title": "Scenario title",
      "probability": "X%",
      "description": "Low-probability, high-impact",
      "triggers": ["What to watch"],
      "best_sectors": ["Sector that benefits"],
      "worst_sectors": ["Sector most exposed"],
      "commodity_implications": ["Material/commodity impact"],
      "time_horizons": { "1w": "Near-term view", "1m": "Medium-term view", "3m": "Longer-term view" },
      "invalidation_conditions": ["What would invalidate"],
      "moves": [{ "action": "Hedge action", "timeframe": "By when", "owner": "Function" }]
    }
  },
  "confidence": "High|Medium|Low",
  "leadingIndicators": ["Indicator 1", "Indicator 2", "Indicator 3"],
  "keyAssumptions": ["Assumption 1", "Assumption 2"],
  "disclaimer": "For informational purposes only. Not investment advice. Mexel Insights Ltd."
}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250514',
      max_tokens: 4000,
      system: MEXEL_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content.filter(b => b.type === 'text').map(b => b.text).join('');
    const clean = text.replace(/```json|```/g, '').trim();
    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch (parseErr) {
      console.error('Scenario JSON parse error. Raw response:', clean.slice(0, 500));
      return res.status(502).json({ error: 'AI returned invalid JSON. Please retry.', code: 'PARSE_ERROR' });
    }
    res.json({ scenario: parsed });
  } catch (err) {
    console.error('Scenario error:', err.message, err.status || '');
    const classified = classifyApiError(err);
    res.status(classified.status).json({ error: classified.message, code: classified.code });
  }
});

/**
 * POST /api/mmr-signal
 * Analyse a raw signal for MMR inclusion
 * Body: { signal, material }
 */
app.post('/api/mmr-signal', aiLimiter, async (req, res) => {
  const { signal, material = 'Unspecified' } = req.body;

  if (!signal) return res.status(400).json({ error: 'Signal description required.' });

  const prompt = `Analyse this raw market signal for inclusion in the Minerals & Metals Radar (MMR).

Material: ${material}
Signal: ${signal}

Return ONLY valid JSON:
{
  "material": "${material}",
  "tag": "Policy/Trade|Supply Event|Permitting/Legal|Finance/Market|Logistics|ESG/Community|Technology/Process|Demand Driver",
  "summary": "1-2 sentence signal summary for MMR tape",
  "riskBand": 1-5,
  "confidence": "A|B|C",
  "confidenceNote": "Brief justification",
  "move": "Specific recommended action for procurement/supply chain teams",
  "moveTimeframe": "Immediate|1-2 weeks|1 month|3 months",
  "moveOwner": "Procurement|Legal|Strategy|Finance|Operations",
  "watchTriggers": ["What to monitor that would change the risk band"]
}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250514',
      max_tokens: 1000,
      system: MEXEL_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content.filter(b => b.type === 'text').map(b => b.text).join('');
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    res.json({ signal: parsed });
  } catch (err) {
    console.error('MMR error:', err.message, err.status || '');
    const classified = classifyApiError(err);
    res.status(classified.status).json({ error: classified.message, code: classified.code });
  }
});

/**
 * POST /api/ppi
 * Score a sector/jurisdiction combination
 * Body: { sector, jurisdiction }
 */
app.post('/api/ppi', aiLimiter, async (req, res) => {
  const { sector, jurisdiction } = req.body;

  if (!sector || !jurisdiction) {
    return res.status(400).json({ error: 'Sector and jurisdiction required.' });
  }

  const prompt = `Score the Policy Pressure Index (PPI) for this sector/jurisdiction combination as of early 2026.

Sector: ${sector}
Jurisdiction: ${jurisdiction}

Score each dimension 0.0â€“5.0 based on current regulatory environment.
Return ONLY valid JSON:
{
  "sector": "${sector}",
  "jurisdiction": "${jurisdiction}",
  "overallScore": 0.0-5.0,
  "dimensions": {
    "complianceCostPressure": { "score": 0.0-5.0, "rationale": "Brief reason" },
    "enforcementExposure": { "score": 0.0-5.0, "rationale": "Brief reason" },
    "crossBorderExposure": { "score": 0.0-5.0, "rationale": "CBAM/tariffs/export controls" },
    "timelineCertainty": { "score": 0.0-5.0, "rationale": "How clear are deadlines" },
    "dataEvidenceBurden": { "score": 0.0-5.0, "rationale": "Reporting/disclosure burden" }
  },
  "keyRegulations": ["Regulation 1", "Regulation 2"],
  "nextDeadline": "Next major deadline date and description",
  "trendDirection": "Increasing|Stable|Decreasing",
  "topMove": "Single most important action for a company in this sector/jurisdiction",
  "lastUpdated": "March 2026"
}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250514',
      max_tokens: 1000,
      system: MEXEL_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content.filter(b => b.type === 'text').map(b => b.text).join('');
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    res.json({ ppi: parsed });
  } catch (err) {
    console.error('PPI error:', err.message, err.status || '');
    const classified = classifyApiError(err);
    res.status(classified.status).json({ error: classified.message, code: classified.code });
  }
});

/**
 * POST /api/chat
 * Conversational intelligence assistant
 * Body: { messages: [{role, content}] }
 */
app.post('/api/chat', aiLimiter, async (req, res) => {
  const { messages } = req.body;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Messages array required.' });
  }

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250514',
      max_tokens: 1500,
      system: MEXEL_SYSTEM_PROMPT + '\n\nYou are responding in a chat interface. Be concise but substantive. Use the Mexel Insights voice and always end with a specific recommended action if relevant.',
      messages: messages.slice(-10), // last 10 messages for context
    });

    const text = response.content.filter(b => b.type === 'text').map(b => b.text).join('');
    res.json({ reply: text });
  } catch (err) {
    console.error('Chat error:', err.message, err.status || '');
    const classified = classifyApiError(err);
    res.status(classified.status).json({ error: classified.message, code: classified.code });
  }
});

// ═══ RESEARCH PIPELINE API ═══════════════════════════════════════════

/**
 * GET /api/research/feed
 * Signal feed — latest research items with optional filters
 * Query: ?theme=...&source=...&material=...&sector=...&channel=...&limit=50&since=ISO
 */
app.get('/api/research/feed', (req, res) => {
  const { theme, source, material, sector, channel, limit, since } = req.query;
  const items = store.getItems({
    theme, source, material, sector, channel,
    limit: parseInt(limit) || 50,
    since
  });
  res.json({
    items,
    count: items.length,
    last_updated: store.getStats().lastFullRefresh,
    data_status: items.length > 0 ? 'live' : 'awaiting_first_fetch'
  });
});

/**
 * GET /api/research/synthesis
 * Latest Mexel synthesis objects
 * Query: ?limit=20
 */
app.get('/api/research/synthesis', (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  const syntheses = store.getSyntheses({ limit });
  res.json({
    syntheses,
    count: syntheses.length,
    data_status: syntheses.length > 0 ? 'synthesized' : 'awaiting_synthesis'
  });
});

/**
 * GET /api/research/latest
 * Most recent synthesis for “What Matters Now”
 */
app.get('/api/research/latest', (req, res) => {
  const latest = store.getLatestSynthesis();
  if (!latest) {
    return res.json({
      synthesis: null,
      data_status: 'awaiting_synthesis',
      message: 'No synthesis available yet. Pipeline is warming up.'
    });
  }
  res.json({ synthesis: latest, data_status: 'synthesized' });
});

/**
 * GET /api/research/map
 * Geo-tagged research items for the intelligence map
 */
app.get('/api/research/map', (req, res) => {
  const geoItems = store.getGeoItems();
  res.json({
    points: geoItems,
    count: geoItems.length,
    data_status: geoItems.length > 0 ? 'live' : 'awaiting_geo_data'
  });
});

/**
 * GET /api/research/stats
 * Pipeline status and health
 */
app.get('/api/research/stats', (req, res) => {
  const stats = store.getStats();
  const fetchLog = store.getFetchLog({ limit: 20 });

  // Build source health report
  const sourceHealth = {};
  for (const entry of fetchLog) {
    if (!sourceHealth[entry.source] || entry.timestamp > sourceHealth[entry.source].timestamp) {
      sourceHealth[entry.source] = {
        lastFetch: entry.timestamp,
        success: entry.success,
        count: entry.count,
        error: entry.error
      };
    }
  }

  res.json({
    ...stats,
    sourceHealth,
    pipeline_status: stats.totalItems > 0 ? 'active' : 'warming_up'
  });
});

/**
 * POST /api/research/refresh
 * Manual trigger for pipeline refresh (single source or all)
 * Body: { source?: string }
 */
app.post('/api/research/refresh', aiLimiter, async (req, res) => {
  const { source } = req.body;

  try {
    if (source) {
      const result = await refreshSource(source);
      res.json({ success: result.success, source, items: result.items.length, elapsed: result.elapsed });
    } else {
      // Async — don't wait for full pipeline
      runFullPipeline().catch(err => console.error('[Manual refresh] Error:', err.message));
      res.json({ success: true, message: 'Full pipeline refresh started' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/research/sources
 * Source registry metadata
 */
app.get('/api/research/sources', (req, res) => {
  const sources = require('./research/sources.json');
  const stats = store.getStats();

  const enriched = sources.sources.map(s => ({
    ...s,
    itemCount: stats.sourceCounts[s.shortName] || stats.sourceCounts[s.name] || 0,
    lastFetch: stats.lastFetchBySource[s.id] || null
  }));

  res.json({ sources: enriched, themes: sources.themes, materials: sources.materials, sectors: sources.sectors });
});

// â”€â”€ HEALTH CHECK â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.get('/api/health', (req, res) => {
  const stats = store.getStats();
  res.json({
    status: 'operational',
    model: 'claude-sonnet-4-5-20250514',
    firm: 'Mexel Insights',
    timestamp: new Date().toISOString(),
    research_pipeline: {
      status: stats.totalItems > 0 ? 'active' : 'warming_up',
      totalItems: stats.totalItems,
      totalSyntheses: stats.totalSyntheses,
      lastRefresh: stats.lastFullRefresh
    }
  });
});

// â”€â”€ SERVE FRONTEND â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// â”€â”€ START â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.listen(PORT, () => {
  console.log('MEXEL INSIGHTS - Intelligence API');
  console.log('http://localhost:' + PORT);
  console.log('Research Pipeline: Active');

  // Start research pipeline scheduler
  startScheduler();

  // Run initial pipeline fetch (non-blocking)
  console.log('[Startup] Running initial research pipeline...');
  runFullPipeline().catch(err => {
    console.error('[Startup] Initial pipeline error:', err.message);
  });
});
