// Shared normalization utilities for all fetchers
const crypto = require('crypto');

function makeId(source, uniqueKey) {
  return crypto.createHash('md5').update(`${source}:${uniqueKey}`).digest('hex').slice(0, 16);
}

function normalizeItem({
  source,
  sourceType,
  title,
  summary = '',
  url = '',
  publishedAt = null,
  region = '',
  themes = [],
  entities = [],
  dataStatus = 'periodic',
  importanceScore = 0,
  rawPayload = null,
  materials = [],
  sectors = [],
  channels = [],
  lat = null,
  lon = null
}) {
  return {
    id: makeId(source, url || title),
    source,
    source_type: sourceType,
    title: (title || '').trim(),
    summary: (summary || '').trim().slice(0, 1000),
    url: (url || '').trim(),
    published_at: publishedAt ? new Date(publishedAt).toISOString() : null,
    retrieved_at: new Date().toISOString(),
    region: region || '',
    themes,
    entities,
    materials,
    sectors,
    channels,
    data_status: dataStatus,
    importance_score: importanceScore,
    lat,
    lon,
    raw_payload: rawPayload
  };
}

module.exports = { normalizeItem, makeId };
