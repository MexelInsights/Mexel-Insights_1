// ═══ RESEARCH PIPELINE INTEGRATION ═══
let _feedItems = [];
let _feedFilter = 'all';

async function loadSignalFeed() {
  try {
    const res = await fetch('/api/research/feed?limit=30');
    if (!res.ok) throw new Error('Feed unavailable');
    const data = await res.json();
    _feedItems = data.items || [];

    // Update status indicator
    const dot = document.getElementById('sf-status-dot');
    const statusText = document.getElementById('sf-status-text');
    const lastUpdated = document.getElementById('sf-last-updated');

    if (_feedItems.length > 0) {
      dot.className = 'sf-status-dot';
      statusText.textContent = `${_feedItems.length} signals`;
      if (data.last_updated) {
        const ago = timeAgo(new Date(data.last_updated));
        lastUpdated.textContent = `Updated ${ago}`;
      }
    } else {
      dot.className = 'sf-status-dot stale';
      statusText.textContent = 'Warming up';
      lastUpdated.textContent = 'Pipeline initializing...';
    }

    renderFeed();
    renderTrustFooter(data);
  } catch (err) {
    const dot = document.getElementById('sf-status-dot');
    const statusText = document.getElementById('sf-status-text');
    if (dot) dot.className = 'sf-status-dot offline';
    if (statusText) statusText.textContent = 'Offline';
    document.getElementById('sf-grid').innerHTML = '<div class="sf-empty">Signal feed is initializing. Research pipeline will populate on next server refresh.</div>';
  }
}

function renderFeed() {
  const grid = document.getElementById('sf-grid');
  if (!grid) return;

  let items = _feedItems;
  if (_feedFilter !== 'all') {
    items = items.filter(i => (i.themes || []).some(t => t.toLowerCase().includes(_feedFilter.toLowerCase())));
  }

  if (items.length === 0) {
    grid.innerHTML = '<div class="sf-empty">No signals matching this filter. Try "All" or wait for the next pipeline refresh.</div>';
    return;
  }

  grid.innerHTML = items.slice(0, 20).map(item => {
    const source = item.source || 'Unknown';
    const title = escHtml(item.title || 'Untitled');
    const summary = escHtml((item.summary || '').slice(0, 200));
    const url = item.url || '#';
    const published = item.published_at ? timeAgo(new Date(item.published_at)) : '';
    const status = item.data_status || 'periodic';
    const scores = item.scores || {};
    const urgency = scores.urgency || 0;
    const relevance = scores.relevance || 0;
    const confidence = scores.confidence || 0;

    const themeTags = (item.themes || []).slice(0, 2).map(t =>
      `<span class="sf-tag">${escHtml(t)}</span>`
    ).join('');
    const matTags = (item.materials || []).slice(0, 3).map(m =>
      `<span class="sf-tag sf-tag-material">${escHtml(m)}</span>`
    ).join('');
    const secTags = (item.sectors || []).slice(0, 2).map(s =>
      `<span class="sf-tag sf-tag-sector">${escHtml(s)}</span>`
    ).join('');

    const urgencyColor = urgency >= 7 ? 'var(--rust)' : urgency >= 4 ? 'var(--amber)' : 'var(--teal)';

    return `<div class="sf-card">
      <div class="sf-card-source">${escHtml(source)}</div>
      <div class="sf-card-body">
        <div class="sf-card-title"><a href="${escHtml(url)}" target="_blank" rel="noopener">${title}</a></div>
        <div class="sf-card-summary">${summary}</div>
        <div class="sf-card-tags">${themeTags}${matTags}${secTags}</div>
      </div>
      <div class="sf-card-meta">
        <span>${published}</span>
        <span style="text-transform:uppercase;font-size:0.36rem;opacity:0.6;">${status}</span>
        <div class="sf-score">
          <span style="color:${urgencyColor}">U:${urgency.toFixed(1)}</span>
          <div class="sf-score-bar"><div class="sf-score-fill" style="width:${urgency*10}%;background:${urgencyColor}"></div></div>
        </div>
        <div class="sf-score">
          <span>R:${relevance.toFixed(1)}</span>
          <div class="sf-score-bar"><div class="sf-score-fill" style="width:${relevance*10}%;background:var(--navy)"></div></div>
        </div>
      </div>
    </div>`;
  }).join('');
}

function renderTrustFooter(data) {
  const el = document.getElementById('sf-trust');
  if (!el) return;
  const count = (data.items || []).length;
  const sources = [...new Set((data.items || []).map(i => i.source))];
  const statuses = [...new Set((data.items || []).map(i => i.data_status))];
  el.innerHTML = `<span>Sources: ${sources.join(' · ') || 'None'}</span><span>Items: ${count}</span><span>Data: ${statuses.join(' / ') || 'N/A'}</span><span>${data.last_updated ? 'Last refresh: ' + new Date(data.last_updated).toLocaleTimeString() : 'Awaiting first refresh'}</span>`;
}

function filterFeed(filter, btn) {
  _feedFilter = filter;
  document.querySelectorAll('.sf-filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderFeed();
}

// Load synthesis for "What Matters Now" dynamic update
async function loadLatestSynthesis() {
  try {
    const res = await fetch('/api/research/latest');
    if (!res.ok) return;
    const data = await res.json();
    if (!data.synthesis) return;

    const s = data.synthesis;
    const wmGrid = document.querySelector('.wmn-grid');
    if (!wmGrid) return;

    // Only update if synthesis is newer than hardcoded content
    if (s.what_changed && s.why_it_matters) {
      const liveNote = '<div style="font-family:var(--mono);font-size:0.38rem;color:var(--gold);letter-spacing:0.08em;text-transform:uppercase;margin-bottom:0.4rem;">LIVE — Pipeline synthesis</div>';

      // Update first two cards with live synthesis
      const cards = wmGrid.querySelectorAll('.wmn-card');
      if (cards[0]) {
        cards[0].querySelector('.wmn-text').innerHTML = liveNote + '<strong>' + escHtml(s.what_changed) + '</strong>';
      }
      if (cards[1]) {
        cards[1].querySelector('.wmn-text').innerHTML = liveNote + escHtml(s.why_it_matters);
      }
    }

    // Update disclaimer with live timestamp
    const disc = document.querySelector('.wmn-disclaimer');
    if (disc && s.created_at) {
      disc.textContent = `Mexel Insights live synthesis. Sources: ${(s.sources || []).join(', ')}. Generated ${new Date(s.created_at).toLocaleString()}. Not investment advice.`;
    }
  } catch (err) {
    // Fail silently — hardcoded content remains
  }
}