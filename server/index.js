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

const app = express();
const PORT = process.env.PORT || 3000;

// â”€â”€ ANTHROPIC CLIENT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

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
      model: 'claude-opus-4-5',
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
    console.error('Anthropic API error:', err.message);
    res.status(500).json({ error: 'Intelligence generation failed. Please try again.' });
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
      model: 'claude-opus-4-5',
      max_tokens: 2000,
      system: MEXEL_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content.filter(b => b.type === 'text').map(b => b.text).join('');
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    res.json({ rrm: parsed });
  } catch (err) {
    console.error('RRM error:', err.message);
    res.status(500).json({ error: 'Failed to generate RRM. Try again.' });
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

Return ONLY valid JSON (no markdown):
{
  "framingQuestion": "The core question this briefing answers",
  "signals": [
    { "signal": "Current signal", "source": "Source reference", "implication": "What it means" }
  ],
  "scenarios": {
    "base": {
      "title": "Scenario title",
      "probability": "X%",
      "description": "What happens",
      "triggers": ["Trigger 1", "Trigger 2"],
      "moves": [{ "action": "What to do", "timeframe": "By when", "owner": "Function" }]
    },
    "stress": {
      "title": "Scenario title",
      "probability": "X%",
      "description": "What happens",
      "triggers": ["What tips it from base to stress"],
      "moves": [{ "action": "What to do", "timeframe": "By when", "owner": "Function" }]
    },
    "tail": {
      "title": "Scenario title",
      "probability": "X%",
      "description": "Low-probability, high-impact",
      "triggers": ["What to watch"],
      "moves": [{ "action": "Hedge action", "timeframe": "By when", "owner": "Function" }]
    }
  },
  "leadingIndicators": ["Indicator 1", "Indicator 2", "Indicator 3"],
  "keyAssumptions": ["Assumption 1", "Assumption 2"],
  "disclaimer": "For informational purposes only. Not investment advice. Mexel Insights Ltd."
}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 2500,
      system: MEXEL_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content.filter(b => b.type === 'text').map(b => b.text).join('');
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    res.json({ scenario: parsed });
  } catch (err) {
    console.error('Scenario error:', err.message);
    res.status(500).json({ error: 'Failed to generate scenario. Try again.' });
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
      model: 'claude-opus-4-5',
      max_tokens: 1000,
      system: MEXEL_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content.filter(b => b.type === 'text').map(b => b.text).join('');
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    res.json({ signal: parsed });
  } catch (err) {
    console.error('MMR error:', err.message);
    res.status(500).json({ error: 'Failed to analyse signal. Try again.' });
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
      model: 'claude-opus-4-5',
      max_tokens: 1000,
      system: MEXEL_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content.filter(b => b.type === 'text').map(b => b.text).join('');
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    res.json({ ppi: parsed });
  } catch (err) {
    console.error('PPI error:', err.message);
    res.status(500).json({ error: 'Failed to generate PPI score. Try again.' });
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
      model: 'claude-opus-4-5',
      max_tokens: 1500,
      system: MEXEL_SYSTEM_PROMPT + '\n\nYou are responding in a chat interface. Be concise but substantive. Use the Mexel Insights voice and always end with a specific recommended action if relevant.',
      messages: messages.slice(-10), // last 10 messages for context
    });

    const text = response.content.filter(b => b.type === 'text').map(b => b.text).join('');
    res.json({ reply: text });
  } catch (err) {
    console.error('Chat error:', err.message);
    res.status(500).json({ error: 'Chat failed. Please try again.' });
  }
});

// ── COMMODITY TICKER ─────────────────────────────────────────
const TICKER_SYMBOLS = {
  'BZ=F':  { name: 'BRENT',    unit: '',     decimals: 2 },
  'GC=F':  { name: 'GOLD',     unit: '/oz',  decimals: 0 },
  'HG=F':  { name: 'COPPER',   unit: '/lb',  decimals: 2 },
  'SI=F':  { name: 'SILVER',   unit: '/oz',  decimals: 2 },
  'PL=F':  { name: 'PLATINUM', unit: '/oz',  decimals: 0 },
};

let tickerCache = null;
let tickerCacheTime = 0;
const TICKER_TTL = 15 * 60 * 1000; // 15 minutes

async function fetchTickerData() {
  const now = Date.now();
  if (tickerCache && now - tickerCacheTime < TICKER_TTL) return tickerCache;

  const results = {};
  const symbols = Object.keys(TICKER_SYMBOLS);

  await Promise.all(symbols.map(async (sym) => {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=2d&interval=1d`;
      const resp = await fetch(url, {
        headers: { 'User-Agent': 'MexelInsights/1.0' },
      });
      if (!resp.ok) return;
      const data = await resp.json();
      const meta = data.chart?.result?.[0]?.meta;
      if (!meta) return;

      const price = meta.regularMarketPrice;
      const prevClose = meta.chartPreviousClose ?? meta.previousClose;
      const info = TICKER_SYMBOLS[sym];
      const change = prevClose ? ((price - prevClose) / prevClose * 100) : 0;

      results[info.name] = {
        price: price.toFixed(info.decimals),
        change: change.toFixed(1),
        unit: info.unit,
      };
    } catch (e) {
      console.error(`Ticker fetch failed for ${sym}:`, e.message);
    }
  }));

  if (Object.keys(results).length > 0) {
    tickerCache = results;
    tickerCacheTime = now;
  }
  return results;
}

app.get('/api/ticker', async (req, res) => {
  try {
    const data = await fetchTickerData();
    res.json({ prices: data, cached: Date.now() - tickerCacheTime < 1000 ? false : true });
  } catch (err) {
    console.error('Ticker error:', err.message);
    res.status(500).json({ error: 'Failed to fetch commodity prices.' });
  }
});

// â”€â”€ HEALTH CHECK â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.get('/api/health', (req, res) => {
  res.json({
    status: 'operational',
    model: 'claude-opus-4-5',
    firm: 'Mexel Insights',
    timestamp: new Date().toISOString(),
  });
});

// â”€â”€ SERVE FRONTEND â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// â”€â”€ START â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.listen(PORT, () => {
  console.log(`\n  â•”â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•—`);
  console.log(`  â•‘  MEXEL INSIGHTS â€” Intelligence API   â•‘`);
  console.log(`  â•‘  http://localhost:${PORT}               â•‘`);
  console.log(`  â•‘  Model: claude-opus-4-5            â•‘`);
  console.log(`  â•šâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•\n`);
});
