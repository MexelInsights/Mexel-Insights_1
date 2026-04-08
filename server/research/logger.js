// Reliability logger — tracks fetch success/failure, staleness, and parser errors
const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, 'data', 'reliability.log');

// Staleness thresholds by source cadence
const STALE_THRESHOLDS = {
  'gdelt': 30 * 60 * 1000,          // 30 min
  'eia': 2 * 60 * 60 * 1000,        // 2 hours
  'doe': 2 * 60 * 60 * 1000,        // 2 hours
  'iea': 2 * 60 * 60 * 1000,        // 2 hours
  'federal-register': 4 * 60 * 60 * 1000, // 4 hours
  'eurlex': 6 * 60 * 60 * 1000,     // 6 hours
  'usgs': 48 * 60 * 60 * 1000       // 48 hours
};

function log(level, source, message, meta = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level, // info, warn, error
    source,
    message,
    ...meta
  };

  const line = JSON.stringify(entry) + '\n';
  console.log(`[${level.toUpperCase()}] [${source}] ${message}`);

  try {
    fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
    fs.appendFileSync(LOG_FILE, line);

    // Rotate if over 1MB
    const stats = fs.statSync(LOG_FILE);
    if (stats.size > 1024 * 1024) {
      const backup = LOG_FILE + '.old';
      if (fs.existsSync(backup)) fs.unlinkSync(backup);
      fs.renameSync(LOG_FILE, backup);
    }
  } catch {}
}

function checkStaleness(sourceId, lastFetchTime) {
  const threshold = STALE_THRESHOLDS[sourceId] || 4 * 60 * 60 * 1000;
  const age = Date.now() - new Date(lastFetchTime).getTime();

  if (age > threshold * 2) {
    log('error', sourceId, `Source critically stale: ${Math.round(age / 60000)}min since last fetch (threshold: ${Math.round(threshold / 60000)}min)`);
    return 'critical';
  }
  if (age > threshold) {
    log('warn', sourceId, `Source stale: ${Math.round(age / 60000)}min since last fetch (threshold: ${Math.round(threshold / 60000)}min)`);
    return 'stale';
  }
  return 'fresh';
}

function logFetchResult(sourceId, success, count, elapsed, error = null) {
  if (success) {
    log('info', sourceId, `Fetched ${count} items in ${elapsed}ms`);
  } else {
    log('error', sourceId, `Fetch failed in ${elapsed}ms: ${error || 'Unknown error'}`, { error });
  }
}

function logParserError(sourceId, message, rawData = null) {
  log('error', sourceId, `Parser error: ${message}`, { rawDataPreview: rawData ? String(rawData).slice(0, 200) : null });
}

function logSynthesisResult(clusterCount, outputCount, elapsed) {
  log('info', 'synthesizer', `Synthesized ${outputCount} outputs from ${clusterCount} clusters in ${elapsed}ms`);
}

module.exports = { log, checkStaleness, logFetchResult, logParserError, logSynthesisResult, STALE_THRESHOLDS };
