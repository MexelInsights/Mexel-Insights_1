// Mexel knowledge layer — canonical bottleneck cards, categories, relationships.
// Loaded once at startup; queryable by text / themes / materials for synthesis context injection.
const fs = require('fs');
const path = require('path');

let _cards = [];
let _categories = [];
let _relationships = [];
let _loaded = false;

function load() {
  if (_loaded) return;
  try {
    _cards = JSON.parse(fs.readFileSync(path.join(__dirname, 'cards.json'), 'utf8'));
    _categories = JSON.parse(fs.readFileSync(path.join(__dirname, 'categories.json'), 'utf8'));
    _relationships = JSON.parse(fs.readFileSync(path.join(__dirname, 'relationships.json'), 'utf8'));
    _loaded = true;
    console.log(`[Knowledge] Loaded ${_cards.length} cards, ${_categories.length} categories, ${_relationships.length} relationships`);
  } catch (err) {
    console.error('[Knowledge] Failed to load:', err.message);
    _cards = []; _categories = []; _relationships = [];
  }
}

function getAllCards() { load(); return _cards; }
function getCategories() { load(); return _categories; }
function getRelationships() { load(); return _relationships; }
function getCard(id) { load(); return _cards.find(c => c.id === id) || null; }

// Build a searchable text blob per card
function _cardText(c) {
  return [
    c.title, (c.aliases || []).join(' '), c.what_it_is, c.exact_process_role,
    c.why_it_matters, c.why_it_is_underappreciated,
    (c.related_entities || []).join(' '), (c.related_policies || []).join(' '),
    (c.downstream_sectors_exposed || []).join(' '), (c.upstream_dependencies || []).join(' ')
  ].filter(Boolean).join(' ').toLowerCase();
}

// Score a card's relevance to a query built from free text + themes + materials
function findRelevantCards({ text = '', themes = [], materials = [], sectors = [], limit = 5 } = {}) {
  load();
  const q = (text + ' ' + themes.join(' ') + ' ' + materials.join(' ') + ' ' + sectors.join(' ')).toLowerCase();
  if (!q.trim()) return [];

  // Simple keyword-overlap scoring; cheap and deterministic.
  const tokens = [...new Set(q.split(/[^a-z0-9]+/).filter(t => t.length >= 4))];
  if (tokens.length === 0) return [];

  const scored = _cards.map(c => {
    const blob = _cardText(c);
    let score = 0;
    for (const t of tokens) {
      if (blob.includes(t)) score += 1;
    }
    // Strong boost for direct alias/title hits
    const titleLow = (c.title || '').toLowerCase();
    if (tokens.some(t => titleLow.includes(t))) score += 3;
    for (const a of (c.aliases || [])) {
      if (q.includes(a.toLowerCase())) score += 4;
    }
    return { card: c, score };
  }).filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(s => s.card);

  return scored;
}

function searchCards(query) {
  load();
  const q = (query || '').toLowerCase().trim();
  if (!q) return _cards;
  return _cards.filter(c => _cardText(c).includes(q));
}

// Compact card summary for synthesis prompt injection
function cardAsContext(c) {
  return `• ${c.title} [${c.category}] — ${c.what_it_is} ` +
    `Why it matters: ${c.why_it_matters} ` +
    `Triggers: ${(c.triggers_to_watch || []).slice(0, 3).join('; ')}. ` +
    `Exposure: ${(c.public_equity_relevance || '').slice(0, 200)}`;
}

function buildContextBlock(cards) {
  if (!cards || cards.length === 0) return '';
  return 'MEXEL KNOWLEDGE CONTEXT — relevant canonical bottleneck cards:\n' +
    cards.map(cardAsContext).join('\n') +
    '\nUse these as analytical scaffolding where relevant. Do not fabricate details beyond what is in the cards and the signals.';
}

module.exports = {
  load, getAllCards, getCategories, getRelationships, getCard,
  findRelevantCards, searchCards, cardAsContext, buildContextBlock
};
