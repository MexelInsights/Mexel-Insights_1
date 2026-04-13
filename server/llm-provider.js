/**
 * LLM Provider Abstraction Layer
 *
 * Supports:
 *   LLM_PROVIDER=anthropic  (default — production, uses Anthropic SDK)
 *   LLM_PROVIDER=ollama     (local dev — uses Ollama HTTP API, zero Anthropic calls)
 *
 * Env vars:
 *   LLM_PROVIDER   — "anthropic" or "ollama"
 *   LLM_BASE_URL   — Ollama server URL (default: http://localhost:11434)
 *   LLM_MODEL      — Model name for Ollama (default: qwen3.5:9b)
 *
 * When LLM_PROVIDER=ollama:
 *   - The Anthropic SDK is NEVER called, even if ANTHROPIC_API_KEY is set.
 *   - All generation goes through the Ollama /api/chat endpoint.
 *   - If Ollama is unreachable, a structured error is returned (no fallback).
 */

const PROVIDER = (process.env.LLM_PROVIDER || 'anthropic').toLowerCase();
const OLLAMA_BASE = process.env.LLM_BASE_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.LLM_MODEL || 'qwen3.5:9b';
const ANTHROPIC_MODEL = 'claude-sonnet-4-5-20250514';

// ─── Startup logging ──────────────────────────────────────────────
function logProviderConfig() {
  console.log('\n  ═══ LLM Provider Configuration ═══');
  console.log(`  Provider : ${PROVIDER.toUpperCase()}`);
  if (PROVIDER === 'ollama') {
    console.log(`  Model    : ${OLLAMA_MODEL}`);
    console.log(`  Base URL : ${OLLAMA_BASE}`);
    console.log(`  Mode     : LOCAL ONLY — zero Anthropic usage`);
    console.log(`  Note     : ANTHROPIC_API_KEY is IGNORED in ollama mode`);
  } else {
    console.log(`  Model    : ${ANTHROPIC_MODEL}`);
    console.log(`  API Key  : ${process.env.ANTHROPIC_API_KEY ? 'set (' + process.env.ANTHROPIC_API_KEY.slice(0, 8) + '...)' : '*** NOT SET ***'}`);
  }
  console.log('  ═══════════════════════════════════\n');
}

// ─── Robust JSON extraction ───────────────────────────────────────
function extractJSON(raw) {
  if (!raw || typeof raw !== 'string') return null;

  let text = raw.trim();

  // Strip markdown code fences
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');

  // Try direct parse first
  try { return JSON.parse(text); } catch {}

  // Try to find the outermost JSON object
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try { return JSON.parse(text.slice(firstBrace, lastBrace + 1)); } catch {}
  }

  // Try to find JSON array
  const firstBracket = text.indexOf('[');
  const lastBracket = text.lastIndexOf(']');
  if (firstBracket !== -1 && lastBracket > firstBracket) {
    try { return JSON.parse(text.slice(firstBracket, lastBracket + 1)); } catch {}
  }

  return null;
}

// ─── Ollama implementation ────────────────────────────────────────
async function ollamaGenerate(systemPrompt, userPrompt, maxTokens) {
  const url = `${OLLAMA_BASE}/api/chat`;

  const body = {
    model: OLLAMA_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    stream: false,
    think: false,  // Disable thinking mode (Qwen3.5, DeepSeek, etc.)
    options: {
      num_predict: maxTokens || 2000,
      temperature: 0.7,
    }
  };

  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(180000), // 3 min timeout for local models
    });
  } catch (netErr) {
    const msg = netErr.message || '';
    if (msg.includes('ECONNREFUSED') || msg.includes('fetch failed')) {
      throw Object.assign(new Error(
        `Ollama unreachable at ${OLLAMA_BASE}. Is it running? Start with: ollama serve`
      ), { code: 'OLLAMA_UNREACHABLE', status: 503 });
    }
    if (msg.includes('timeout') || msg.includes('abort')) {
      throw Object.assign(new Error(
        `Ollama request timed out (180s). Model "${OLLAMA_MODEL}" may be too slow or still loading.`
      ), { code: 'OLLAMA_TIMEOUT', status: 504 });
    }
    throw Object.assign(new Error(`Ollama network error: ${msg}`), { code: 'OLLAMA_NETWORK', status: 502 });
  }

  if (!res.ok) {
    let errBody = '';
    try { errBody = await res.text(); } catch {}
    if (res.status === 404 || errBody.includes('not found')) {
      throw Object.assign(new Error(
        `Ollama model "${OLLAMA_MODEL}" not found. Pull it with: ollama pull ${OLLAMA_MODEL}`
      ), { code: 'OLLAMA_MODEL_NOT_FOUND', status: 404 });
    }
    throw Object.assign(new Error(
      `Ollama returned ${res.status}: ${errBody.slice(0, 200)}`
    ), { code: 'OLLAMA_ERROR', status: res.status });
  }

  const data = await res.json();
  let text = data?.message?.content || '';

  // Strip <think>...</think> blocks (Qwen3.5 thinking mode output)
  text = text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

  // Fallback: if content is empty but thinking has content, extract from thinking
  if (!text && data?.message?.thinking) {
    console.log('[Ollama] Content empty, checking thinking field for JSON...');
    const thinkText = data.message.thinking || '';
    // Try to find JSON in the thinking block
    const jsonInThink = extractJSON(thinkText);
    if (jsonInThink) {
      text = JSON.stringify(jsonInThink);
    }
  }

  if (!text) {
    const debugInfo = JSON.stringify({
      hasContent: !!(data?.message?.content),
      contentLen: (data?.message?.content || '').length,
      hasThinking: !!(data?.message?.thinking),
      thinkingLen: (data?.message?.thinking || '').length,
      done: data?.done,
      doneReason: data?.done_reason,
    });
    throw Object.assign(new Error('Ollama returned empty response. Debug: ' + debugInfo), { code: 'OLLAMA_EMPTY', status: 502 });
  }
  return text;
}

// ─── Ollama JSON generation with retry ────────────────────────────
async function ollamaGenerateJSON(systemPrompt, userPrompt, maxTokens) {
  // First attempt
  const raw = await ollamaGenerate(systemPrompt, userPrompt, maxTokens);
  const parsed = extractJSON(raw);
  if (parsed) return { text: raw, parsed };

  // Retry with a simpler prompt
  console.log('[Ollama] JSON parse failed on first attempt, retrying with simplified prompt...');
  const retryPrompt = userPrompt + '\n\nIMPORTANT: Your response must be ONLY a valid JSON object. No explanation, no markdown, no text before or after. Start with { and end with }.';
  const raw2 = await ollamaGenerate(systemPrompt, retryPrompt, maxTokens);
  const parsed2 = extractJSON(raw2);
  if (parsed2) return { text: raw2, parsed: parsed2 };

  // Both attempts failed
  throw Object.assign(new Error(
    `Ollama model returned unparseable JSON after 2 attempts. Raw (first 300 chars): ${raw.slice(0, 300)}`
  ), { code: 'OLLAMA_PARSE_ERROR', status: 502 });
}

// ─── Anthropic implementation ─────────────────────────────────────
async function anthropicGenerate(anthropicClient, systemPrompt, userPrompt, maxTokens) {
  if (PROVIDER === 'ollama') {
    // SAFEGUARD: never call Anthropic in ollama mode
    throw Object.assign(new Error('Anthropic calls are blocked in ollama mode'), { code: 'PROVIDER_BLOCKED', status: 500 });
  }

  const response = await anthropicClient.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: maxTokens || 2000,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const text = response.content.filter(b => b.type === 'text').map(b => b.text).join('');
  return text;
}

async function anthropicGenerateJSON(anthropicClient, systemPrompt, userPrompt, maxTokens) {
  const raw = await anthropicGenerate(anthropicClient, systemPrompt, userPrompt, maxTokens);
  const clean = raw.replace(/```json|```/g, '').trim();
  let parsed;
  try {
    parsed = JSON.parse(clean);
  } catch {
    parsed = extractJSON(raw);
    if (!parsed) {
      throw Object.assign(new Error('AI returned unparseable JSON'), { code: 'PARSE_ERROR', status: 502 });
    }
  }
  return { text: raw, parsed };
}

// ─── Unified API ──────────────────────────────────────────────────
function createLLM(anthropicClient) {
  const isOllama = PROVIDER === 'ollama';

  return {
    provider: PROVIDER,
    model: isOllama ? OLLAMA_MODEL : ANTHROPIC_MODEL,
    baseUrl: isOllama ? OLLAMA_BASE : 'https://api.anthropic.com',

    /** Generate raw text */
    async generate(systemPrompt, userPrompt, maxTokens) {
      if (isOllama) {
        return ollamaGenerate(systemPrompt, userPrompt, maxTokens);
      }
      return anthropicGenerate(anthropicClient, systemPrompt, userPrompt, maxTokens);
    },

    /** Generate and parse JSON (with retry for Ollama) */
    async generateJSON(systemPrompt, userPrompt, maxTokens) {
      if (isOllama) {
        return ollamaGenerateJSON(systemPrompt, userPrompt, maxTokens);
      }
      return anthropicGenerateJSON(anthropicClient, systemPrompt, userPrompt, maxTokens);
    },

    /** Health check — is the provider reachable? */
    async checkHealth() {
      if (isOllama) {
        try {
          const res = await fetch(`${OLLAMA_BASE}/api/tags`, { signal: AbortSignal.timeout(5000) });
          if (!res.ok) return { ok: false, error: `Ollama returned ${res.status}` };
          const data = await res.json();
          const models = (data.models || []).map(m => m.name);
          const hasModel = models.some(n => n.startsWith(OLLAMA_MODEL.split(':')[0]));
          return {
            ok: true,
            provider: 'ollama',
            model: OLLAMA_MODEL,
            baseUrl: OLLAMA_BASE,
            modelAvailable: hasModel,
            availableModels: models.slice(0, 10),
          };
        } catch (err) {
          return { ok: false, provider: 'ollama', error: `Ollama unreachable: ${err.message}`, baseUrl: OLLAMA_BASE };
        }
      } else {
        return {
          ok: !!process.env.ANTHROPIC_API_KEY,
          provider: 'anthropic',
          model: ANTHROPIC_MODEL,
          apiKeySet: !!process.env.ANTHROPIC_API_KEY,
        };
      }
    }
  };
}

// ─── Error classifier (provider-aware) ────────────────────────────
function classifyError(err) {
  const msg = err.message || '';
  const code = err.code || '';
  const status = err.status || err.statusCode || 500;

  // Ollama-specific errors
  if (code.startsWith('OLLAMA_')) {
    return { code, message: msg, status };
  }

  // Anthropic-specific errors
  if (PROVIDER === 'anthropic') {
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
  }

  if (msg.includes('timeout') || msg.includes('ETIMEDOUT') || msg.includes('ECONNREFUSED')) {
    return { code: 'TIMEOUT', message: 'Request timed out. The AI service may be slow — please retry.', status: 504 };
  }
  if (code === 'PARSE_ERROR' || msg.includes('JSON') || msg.includes('parse')) {
    return { code: 'PARSE_ERROR', message: 'AI returned an unparseable response. Please retry.', status: 502 };
  }
  return { code: code || 'INTERNAL', message: 'Generation failed: ' + msg.slice(0, 200), status };
}

module.exports = {
  PROVIDER, OLLAMA_BASE, OLLAMA_MODEL, ANTHROPIC_MODEL,
  createLLM, logProviderConfig, classifyError, extractJSON
};
