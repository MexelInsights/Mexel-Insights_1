// Research pipeline scheduler — cron-based automated refresh
const cron = require('node-cron');
const { runFetcher, runAllFetchers } = require('./fetchers');
const { classifyAll } = require('./classifier');
const { scoreAll } = require('./scorer');
const { synthesize } = require('./synthesizer');
const store = require('./store');
const { logFetchResult, logSynthesisResult } = require('./logger');

let anthropicClient = null;
let isRunning = false;
let scheduledJobs = [];

function setAnthropicClient(client) {
  anthropicClient = client;
}

// Run a single source refresh
async function refreshSource(sourceId) {
  const result = await runFetcher(sourceId);
  if (result.items.length > 0) {
    const classified = classifyAll(result.items);
    const scored = scoreAll(classified);
    store.addItems(scored);
  }
  store.logFetch([{
    source: sourceId,
    success: result.success,
    count: result.items.length,
    elapsed: result.elapsed,
    error: result.error,
    timestamp: new Date().toISOString()
  }]);
  logFetchResult(sourceId, result.success, result.items.length, result.elapsed, result.error);
  return result;
}

// Full pipeline: fetch all → classify → score → synthesize
async function runFullPipeline() {
  if (isRunning) {
    console.log('[Scheduler] Pipeline already running, skipping');
    return;
  }

  isRunning = true;
  const start = Date.now();
  console.log('[Scheduler] Starting full pipeline...');

  try {
    // Step 1: Fetch all sources
    const fetchResult = await runAllFetchers();
    store.logFetch(fetchResult.fetchLog);

    // Step 2: Classify
    const classified = classifyAll(fetchResult.items);

    // Step 3: Score
    const scored = scoreAll(classified);

    // Step 4: Store items
    const totalStored = store.addItems(scored);
    console.log(`[Scheduler] Stored ${totalStored} total items`);

    // Step 5: Synthesize top items (only if we have enough and a client)
    if (anthropicClient && scored.length >= 3) {
      const topItems = scored
        .sort((a, b) => (b.scores?.composite || 0) - (a.scores?.composite || 0))
        .slice(0, 30);

      const synthStart = Date.now();
      const syntheses = await synthesize(topItems, anthropicClient);
      if (syntheses.length > 0) {
        store.addSyntheses(syntheses);
        logSynthesisResult(topItems.length, syntheses.length, Date.now() - synthStart);
      }
    }

    const elapsed = Date.now() - start;
    console.log(`[Scheduler] Full pipeline complete in ${elapsed}ms`);
  } catch (err) {
    console.error('[Scheduler] Pipeline error:', err.message);
  } finally {
    isRunning = false;
  }
}

// Start all scheduled jobs
function startScheduler() {
  // Stop any existing jobs
  stopScheduler();

  console.log('[Scheduler] Starting scheduled jobs...');

  // GDELT: every 15 minutes (most frequent — real-time geopolitical events)
  scheduledJobs.push(cron.schedule('*/15 * * * *', () => {
    console.log('[Cron] GDELT refresh');
    refreshSource('gdelt');
  }));

  // EIA: every hour at :00
  scheduledJobs.push(cron.schedule('0 * * * *', () => {
    console.log('[Cron] EIA refresh');
    refreshSource('eia');
  }));

  // DOE: every hour at :30
  scheduledJobs.push(cron.schedule('30 * * * *', () => {
    console.log('[Cron] DOE refresh');
    refreshSource('doe');
  }));

  // IEA: every hour at :15
  scheduledJobs.push(cron.schedule('15 * * * *', () => {
    console.log('[Cron] IEA refresh');
    refreshSource('iea');
  }));

  // Federal Register: every 2 hours
  scheduledJobs.push(cron.schedule('0 */2 * * *', () => {
    console.log('[Cron] Federal Register refresh');
    refreshSource('federal-register');
  }));

  // EUR-Lex: every 3 hours
  scheduledJobs.push(cron.schedule('0 */3 * * *', () => {
    console.log('[Cron] EUR-Lex refresh');
    refreshSource('eurlex');
  }));

  // USGS: daily at 06:00 UTC
  scheduledJobs.push(cron.schedule('0 6 * * *', () => {
    console.log('[Cron] USGS refresh');
    refreshSource('usgs');
  }));

  // Full synthesis run: every 4 hours
  scheduledJobs.push(cron.schedule('0 */4 * * *', () => {
    console.log('[Cron] Full synthesis run');
    runFullPipeline();
  }));

  console.log('[Scheduler] All jobs scheduled');
}

function stopScheduler() {
  for (const job of scheduledJobs) {
    job.stop();
  }
  scheduledJobs = [];
}

module.exports = {
  startScheduler, stopScheduler, runFullPipeline, refreshSource, setAnthropicClient
};
