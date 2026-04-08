// EIA API fetcher — U.S. Energy Information Administration
// Fetches petroleum, natural gas, and electricity data
const { normalizeItem } = require('./normalize');

const SERIES = [
  { id: 'petroleum/summary', name: 'Petroleum Summary', region: 'US', themes: ['oil / gas / LNG', 'energy policy'] },
  { id: 'natural-gas/sum/lsum', name: 'Natural Gas Summary', region: 'US', themes: ['oil / gas / LNG'] },
  { id: 'electricity/retail-sales', name: 'Electricity Retail Sales', region: 'US', themes: ['energy policy', 'energy transition bottlenecks'] }
];

async function fetchEia() {
  const apiKey = process.env.EIA_API_KEY;
  const items = [];

  for (const series of SERIES) {
    try {
      const url = `https://api.eia.gov/v2/${series.id}/data/?api_key=${apiKey}&frequency=monthly&sort[0][column]=period&sort[0][direction]=desc&length=5&offset=0`;
      const res = await fetch(url, { signal: AbortSignal.timeout(15000) });

      if (!res.ok) {
        // If no API key or bad response, fetch the status endpoint instead
        if (!apiKey) {
          items.push(normalizeItem({
            source: 'EIA',
            sourceType: 'api',
            title: `${series.name} — API key required`,
            summary: `EIA ${series.name} data requires an API key. Set EIA_API_KEY environment variable. Free keys available at api.eia.gov.`,
            url: 'https://www.eia.gov/opendata/register.php',
            region: series.region,
            themes: series.themes,
            dataStatus: 'static',
            importanceScore: 2
          }));
        }
        continue;
      }

      const data = await res.json();
      const rows = data?.response?.data || [];

      for (const row of rows.slice(0, 3)) {
        const period = row.period || '';
        const value = row.value || row['value'] || '';
        const unit = row['unit'] || row['units'] || '';
        const desc = row['series-description'] || row['seriesDescription'] || series.name;

        items.push(normalizeItem({
          source: 'EIA',
          sourceType: 'api',
          title: `${desc} — ${period}`,
          summary: `${desc}: ${value} ${unit} (${period}). Source: EIA official data.`,
          url: `https://www.eia.gov/opendata/browser/${series.id}`,
          publishedAt: period ? new Date(period + '-01') : null,
          region: series.region,
          themes: series.themes,
          dataStatus: 'delayed',
          importanceScore: 4,
          rawPayload: row
        }));
      }
    } catch (err) {
      items.push(normalizeItem({
        source: 'EIA',
        sourceType: 'api',
        title: `${series.name} — fetch failed`,
        summary: `Failed to fetch ${series.name}: ${err.message}`,
        url: `https://www.eia.gov/opendata/browser/${series.id}`,
        region: series.region,
        themes: series.themes,
        dataStatus: 'static',
        importanceScore: 1
      }));
    }
  }

  return items;
}

module.exports = { fetchEia };
