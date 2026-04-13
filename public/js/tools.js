// ═══ CHAT ═══
let chatHistory = [];

async function sendChat() {
  const inp = document.getElementById('chat-in');
  if (!inp) return;
  const msg = inp.value.trim();
  if (!msg) return;
  inp.value = '';

  const msgs = document.getElementById('chat-msgs');
  msgs.innerHTML += `<div class="msg msg-user">${msg}</div>`;
  msgs.innerHTML += `<div class="msg-typing" id="typing"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>`;
  msgs.scrollTop = msgs.scrollHeight;

  chatHistory.push({ role: 'user', content: msg });

  try {
    const data = await callAPI('chat', { messages: chatHistory });
    document.getElementById('typing')?.remove();
    const reply = data.reply;
    chatHistory.push({ role: 'assistant', content: reply });
    msgs.innerHTML += `<div class="msg msg-ai">${reply.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>')}</div>`;
    msgs.scrollTop = msgs.scrollHeight;
  } catch(e) {
    document.getElementById('typing')?.remove();
    msgs.innerHTML += `<div class="msg msg-ai" style="color:var(--rust)">Error: ${e.message}</div>`;
  }
}

// ═══ RRM GENERATOR ═══
async function runRRM() {
  const event = document.getElementById('rrm-event')?.value.trim();
  const sector = document.getElementById('rrm-sector')?.value.trim();
  const region = document.getElementById('rrm-region')?.value.trim();
  if (!event) { showError('rrm-result', 'Please describe an event.'); return; }

  setLoading('rrm-btn', 'rrm-icon', true);
  document.getElementById('rrm-result').innerHTML = '';

  try {
    const data = await callAPI('rrm', { event, sector, region });
    const r = data.rrm;
    const confColor = r.confidence === 'High' ? 'var(--green-bright)' : r.confidence === 'Medium' ? 'var(--gold)' : 'var(--text-muted)';

    let html = `<div class="result-box">
      <div class="rb-label">Mexel Insights \u2014 Rapid Response Memo</div>
      ${riskChip(r.riskBand)}
      <div class="rb-headline">${r.headline}</div>
      <div style="font-family:var(--mono);font-size:0.48rem;color:${confColor};margin-bottom:1rem;display:flex;align-items:center;gap:0.5rem;">
        <span style="border:1px solid ${confColor};padding:0.18rem 0.55rem;">${r.confidence} confidence</span>
        <span style="color:var(--text-faint);">${r.confidenceReason}</span>
      </div>`;

    if (r.bullets) {
      html += `<div class="rb-sec">
        <div class="rb-sec-title">3-Bullet Summary</div>
        <div class="rb-text">\uD83D\uDCCC ${r.bullets.what}</div>
        <div class="rb-text">\uD83D\uDCCA ${r.bullets.why}</div>
        <div class="rb-text" style="color:var(--gold);">\u26A1 ${r.bullets.do}</div>
      </div>`;
    }

    if (r.context) {
      html += `<div class="rb-sec"><div class="rb-sec-title">Context</div><div class="rb-text">${r.context}</div></div>`;
    }

    if (r.signals?.length) {
      html += `<div class="rb-sec"><div class="rb-sec-title">Signals</div>`;
      r.signals.forEach(s => { html += `<div class="rb-text" style="margin-bottom:0.3rem;">\u2014 ${s.text}</div>`; });
      html += `</div>`;
    }

    if (r.moves?.length) {
      html += `<div class="rb-sec"><div class="rb-sec-title">Moves</div>`;
      r.moves.forEach(m => {
        html += `<div class="move-item">${m.action}<div class="move-meta">Timeframe: ${m.timeframe} \u00B7 Owner: ${m.owner} \u00B7 Confidence: ${m.confidence}</div></div>`;
      });
      html += `</div>`;
    }

    if (r.uncertaintyFlags?.length) {
      html += `<div class="rb-sec"><div class="rb-sec-title">Uncertainty Flags</div>`;
      r.uncertaintyFlags.forEach(u => { html += `<div class="unc-item">${u.assumption} \u2192 ${u.wouldChange}</div>`; });
      html += `</div>`;
    }

    if (r.sources?.length) {
      html += `<div style="font-family:var(--mono);font-size:0.46rem;color:var(--text-faint);margin-top:1rem;border-top:1px solid var(--border-subtle);padding-top:0.7rem;">Sources: ${r.sources.join(' | ')}</div>`;
    }

    html += `<div style="font-family:var(--mono);font-size:0.44rem;color:var(--text-faint);margin-top:0.5rem;font-style:italic;">For informational purposes only. Not legal, financial, or investment advice. Mexel Insights Ltd.</div>`;
    html += `</div>`;

    document.getElementById('rrm-result').innerHTML = html;
  } catch(e) {
    showError('rrm-result', e.message);
  } finally {
    setLoading('rrm-btn', 'rrm-icon', false);
  }
}

// ═══ SCENARIO GENERATOR ═══
async function runScenario() {
  const topic = document.getElementById('sc-topic')?.value.trim();
  const sector = document.getElementById('sc-sector')?.value.trim();
  const timeframe = document.getElementById('sc-tf')?.value.trim();
  if (!topic) { showError('sc-result', 'Please enter a topic.'); return; }

  setLoading('sc-btn', 'sc-icon', true);
  document.getElementById('sc-result').innerHTML = '';

  try {
    const data = await callAPI('scenario', { topic, sector, timeframe });
    const s = data.scenario;

    let html = `<div class="sc-result">
      <div class="rb-label">Mexel Insights \u2014 Scenario Briefing</div>
      <div style="font-size:0.9rem;color:var(--text-secondary);font-weight:300;line-height:1.65;margin-bottom:1.2rem;font-style:italic;">${s.framingQuestion}</div>`;

    if (s.signals?.length) {
      html += `<div class="rb-sec"><div class="rb-sec-title">Current Signals</div>`;
      s.signals.slice(0, 3).forEach(sg => { html += `<div class="rb-text" style="margin-bottom:0.35rem;">\u2014 <strong style="color:var(--text-primary);font-weight:500;">${sg.signal}</strong> <span style="color:var(--text-faint);">(${sg.source})</span></div>`; });
      html += `</div>`;
    }

    const scens = [
      { key: 'base', title: 'Base Case', cls: 'sc-base-t', borderCol: 'var(--teal)' },
      { key: 'stress', title: 'Stress Case', cls: 'sc-stress-t', borderCol: 'var(--amber)' },
      { key: 'tail', title: 'Tail Risk', cls: 'sc-tail-t', borderCol: 'var(--rust)' },
    ];

    scens.forEach(({ key, title, cls, borderCol }) => {
      const sc = s.scenarios?.[key];
      if (!sc) return;
      html += `<div class="sc-box" style="border-left:3px solid ${borderCol};">
        <div class="sc-box-title">
          <span class="${cls}">${title}</span>
          <span class="sc-prob">${sc.probability}</span>
        </div>
        <div class="sc-desc-t">${sc.description}</div>`;
      if (sc.moves?.length) {
        sc.moves.forEach(m => {
          html += `<div class="sc-move">\u26A1 ${m.action} <span style="color:var(--text-faint);">[${m.timeframe} \u00B7 ${m.owner}]</span></div>`;
        });
      }
      html += `</div>`;
    });

    if (s.leadingIndicators?.length) {
      html += `<div class="rb-sec"><div class="rb-sec-title">Leading Indicators to Watch</div>`;
      s.leadingIndicators.forEach(i => { html += `<div class="rb-text" style="margin-bottom:0.25rem;">\u2014 ${i}</div>`; });
      html += `</div>`;
    }

    html += `<div style="font-family:var(--mono);font-size:0.44rem;color:var(--text-faint);margin-top:1rem;border-top:1px solid var(--border-subtle);padding-top:0.7rem;">Not investment advice. Mexel Insights Ltd.</div>`;
    html += `</div>`;

    document.getElementById('sc-result').innerHTML = html;
  } catch(e) {
    showError('sc-result', e.message);
  } finally {
    setLoading('sc-btn', 'sc-icon', false);
  }
}

// ═══ MMR ANALYSER ═══
async function runMMR() {
  const signal = document.getElementById('mmr-sig')?.value.trim();
  const material = document.getElementById('mmr-mat')?.value.trim();
  if (!signal) { showError('mmr-result', 'Please describe a signal.'); return; }

  setLoading('mmr-btn', 'mmr-icon', true);
  document.getElementById('mmr-result').innerHTML = '';

  try {
    const data = await callAPI('mmr-signal', { signal, material });
    const r = data.signal;

    const tagClass = (t) => t.includes('Policy') || t.includes('Trade') ? 'sp-pol' : t.includes('Supply') ? 'sp-sup' : t.includes('Finance') ? 'sp-mrk' : 'sp-prm';
    const matClass = (m) => m.toLowerCase().includes('lith') ? 'bl' : m.toLowerCase().includes('graphite') ? 'bg' : m.toLowerCase().includes('copper') ? 'br' : 'bp';

    const html = `<div class="mmr-result">
      <div class="rb-label">MMR Signal Analysis \u00B7 Week ${new Date().toLocaleDateString('en', { month: 'short', year: 'numeric' })}</div>
      <div class="mmr-r-head">
        <div class="mmr-badges">
          <span class="mat-b ${matClass(r.material)}">${r.material}</span>
          <span class="sig-b ${tagClass(r.tag)}">${r.tag}</span>
        </div>
        <div style="display:flex;align-items:center;gap:0.5rem;">
          ${riskChip(r.riskBand)}
          <span class="conf-b">Conf: ${r.confidence}</span>
        </div>
      </div>
      <div class="mmr-sum">${r.summary}</div>
      <div class="mmr-move">${r.move}
        <div class="mmr-move-meta">
          <span>Timeframe: ${r.moveTimeframe}</span>
          <span>Owner: ${r.moveOwner}</span>
          ${r.confidenceNote ? `<span style="color:var(--text-faint);">${r.confidenceNote}</span>` : ''}
        </div>
      </div>
      ${r.watchTriggers?.length ? `<div style="margin-top:1rem;"><div class="rb-sec-title">Watch triggers</div>${r.watchTriggers.map(t => `<div style="font-size:0.8rem;color:var(--text-muted);font-weight:300;margin-bottom:0.25rem;">\u2014 ${t}</div>`).join('')}</div>` : ''}
      <div style="font-family:var(--mono);font-size:0.44rem;color:var(--text-faint);margin-top:1rem;">Not financial advice. Mexel Insights Ltd.</div>
    </div>`;

    document.getElementById('mmr-result').innerHTML = html;
  } catch(e) {
    showError('mmr-result', e.message);
  } finally {
    setLoading('mmr-btn', 'mmr-icon', false);
  }
}

// ═══ PPI SCORER ═══
async function runPPI() {
  const sector = document.getElementById('ppi-sector')?.value;
  const jurisdiction = document.getElementById('ppi-jur')?.value;
  if (!sector) return;

  setLoading('ppi-btn', 'ppi-icon', true);
  document.getElementById('ppi-result').innerHTML = '';

  try {
    const data = await callAPI('ppi', { sector, jurisdiction });
    const r = data.ppi;

    const scoreColor = (s) => s >= 4 ? 'var(--rust)' : s >= 3 ? 'var(--amber)' : s >= 2 ? 'var(--gold)' : 'var(--teal)';
    const trendSymbol = r.trendDirection === 'Increasing' ? '<span class="trend-up">\u25B2 Increasing</span>' : r.trendDirection === 'Decreasing' ? '<span class="trend-dn">\u25BC Decreasing</span>' : '<span class="trend-st">\u2192 Stable</span>';

    const dims = r.dimensions || {};
    const dimList = [
      { key: 'complianceCostPressure', label: 'Compliance cost' },
      { key: 'enforcementExposure', label: 'Enforcement exposure' },
      { key: 'crossBorderExposure', label: 'Cross-border (CBAM)' },
      { key: 'timelineCertainty', label: 'Timeline certainty' },
      { key: 'dataEvidenceBurden', label: 'Data/evidence burden' },
    ];

    let html = `<div class="ppi-r">
      <div class="rb-label">Policy Pressure Index \u2014 ${sector} / ${jurisdiction}</div>
      <div class="ppi-score-big" style="color:${scoreColor(r.overallScore)}">${r.overallScore?.toFixed(1) || '\u2014'}<span style="font-size:1.2rem;color:var(--text-faint);"> / 5.0</span></div>
      <div style="font-family:var(--mono);font-size:0.5rem;color:var(--text-faint);margin-bottom:1.2rem;display:flex;align-items:center;gap:0.8rem;">
        ${trendSymbol} &nbsp;\u00B7&nbsp; Last updated: ${r.lastUpdated || 'March 2026'}
      </div>
      <div class="ppi-dims">`;

    dimList.forEach(({ key, label }) => {
      const d = dims[key];
      const sc = d?.score || 0;
      html += `<div class="ppi-dim-row">
        <span class="ppi-dim-name">${label}</span>
        <div class="ppi-dim-bar"><div class="ppi-dim-fill" style="width:${(sc / 5) * 100}%;background:${scoreColor(sc)};"></div></div>
        <span class="ppi-dim-val" style="color:${scoreColor(sc)}">${sc?.toFixed(1)}</span>
      </div>`;
      if (d?.rationale) html += `<div style="font-size:0.74rem;color:var(--text-faint);font-style:italic;margin:-0.2rem 0 0.6rem 168px;">${d.rationale}</div>`;
    });

    html += `</div>`;

    if (r.nextDeadline) {
      html += `<div class="move-item" style="margin-top:1rem;"><strong style="color:var(--rust);font-weight:500;">Next deadline:</strong> ${r.nextDeadline}</div>`;
    }
    if (r.topMove) {
      html += `<div class="move-item"><strong style="color:var(--gold);font-weight:500;">Top action:</strong> ${r.topMove}</div>`;
    }
    if (r.keyRegulations?.length) {
      html += `<div style="margin-top:1rem;font-family:var(--mono);font-size:0.46rem;color:var(--text-faint);">Key regulations: ${r.keyRegulations.join(' \u00B7 ')}</div>`;
    }

    html += `<div style="font-family:var(--mono);font-size:0.44rem;color:var(--text-faint);margin-top:1rem;border-top:1px solid var(--border-subtle);padding-top:0.7rem;">Not legal advice. Mexel Insights Ltd.</div>`;
    html += `</div>`;

    document.getElementById('ppi-result').innerHTML = html;
  } catch(e) {
    showError('ppi-result', e.message);
  } finally {
    setLoading('ppi-btn', 'ppi-icon', false);
  }
}
