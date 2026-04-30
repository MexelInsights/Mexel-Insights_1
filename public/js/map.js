// Mexel Risk Map — interactive intelligence map
// Clickable points → detail panel with KB cards and cross-product actions

(function initMap() {
  const mapEl = document.getElementById('intel-map');
  if (!mapEl || typeof L === 'undefined') return;

  const map = L.map('intel-map', {
    center: [25, 30], zoom: 2, minZoom: 2, maxZoom: 6,
    scrollWheelZoom: false, zoomControl: true, attributionControl: false,
  });

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png', { subdomains: 'abcd' }).addTo(map);
  L.control.attribution({ prefix: false, position: 'bottomright' })
    .addAttribution('&copy; <a href="https://carto.com" style="color:rgba(255,255,255,0.3)">CARTO</a>')
    .addTo(map);

  const riskColors = { critical: '#C04A28', elevated: '#C47E30', watch: '#0E7C6B', policy: '#3B82F6', live: '#10B981' };
  const riskLabels = { critical: 'Export Controlled', elevated: 'Elevated', watch: 'Watch', policy: 'Policy', live: 'LIVE SIGNAL' };

  function mkIcon(color, size, pulse) {
    size = size || 12;
    const anim = pulse ? ';animation:pulse-dot 2s infinite' : '';
    return L.divIcon({
      className: '',
      html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};box-shadow:0 0 8px ${color}80;border:2px solid rgba(255,255,255,0.25)${anim};"></div>`,
      iconSize: [size, size], iconAnchor: [size / 2, size / 2],
    });
  }

  function mkClusterIcon(color, count) {
    return L.divIcon({
      className: '',
      html: `<div style="width:22px;height:22px;border-radius:50%;background:${color};border:2px solid rgba(255,255,255,0.4);display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:#fff;box-shadow:0 0 12px ${color}80;">${count}</div>`,
      iconSize: [22, 22], iconAnchor: [11, 11],
    });
  }

  // Static curated points — each has themes + bottleneckCardIds for KB matching
  const staticPoints = [
    { id:'china-export', lat:35.86, lng:104.20, risk:'critical', title:'China — Export Controls',
      tagText:'Export Control', region:'East Asia',
      themes:['export-controls','semiconductors','minerals','defense'],
      materials:['Gallium','Germanium','Antimony','REEs','Tungsten','Tellurium'],
      sectors:['Semiconductors','Defence','Solar','Battery'],
      summary:'Export controls on 6+ critical minerals. China controls 98% of gallium refining, 60% germanium, 90% REE processing, 80% tungsten. Licensing regime expanded progressively since 2023.',
      bottleneckCardIds:['wf6','nf3','hf-electronic-grade','gecl4-preforms','acid-grade-fluorspar'],
      updated:'Ongoing — escalating' },
    { id:'tajikistan-antimony', lat:38.86, lng:71.28, risk:'critical', title:'Tajikistan — Antimony',
      tagText:'Supply Crisis', region:'Central Asia',
      themes:['minerals','defense','export-controls'],
      materials:['Antimony'], sectors:['Defence','Flame retardants','Semiconductors'],
      summary:'Second-largest antimony producer. Combined with China controls 80%+ of global supply. Defence-critical for hardeners, flame retardants, and semiconductor dopants.',
      bottleneckCardIds:[], updated:'Q1 2026' },
    { id:'drc-cobalt', lat:-4.04, lng:21.76, risk:'critical', title:'DRC — Cobalt & Tantalum',
      tagText:'Conflict Minerals', region:'Central Africa',
      themes:['minerals','batteries','conflict'],
      materials:['Cobalt','Tantalum'], sectors:['Battery','Electronics','Defence'],
      summary:'70% of global cobalt, 60%+ tantalum. Artisanal mining ESG risk. Cobalt refining SX circuits depend on phosphine-oxide extractants upstream of LiPF6 production.',
      bottleneckCardIds:['phosphine-extractants','lipf6'], updated:'Q1 2026' },
    { id:'indonesia-nickel', lat:-0.79, lng:113.92, risk:'elevated', title:'Indonesia — Nickel',
      tagText:'Concentration', region:'Southeast Asia',
      themes:['minerals','batteries'],
      materials:['Nickel'], sectors:['Battery','Stainless steel'],
      summary:'50%+ of global nickel supply. Processing dominance. Class 1 vs Class 2 split. HPAL processing relies on SX reagent circuits identical to cobalt refining.',
      bottleneckCardIds:['phosphine-extractants','lipf6'], updated:'Q1 2026' },
    { id:'south-africa-pgm', lat:-28.48, lng:24.68, risk:'elevated', title:'South Africa — PGMs & Manganese',
      tagText:'Concentration', region:'Southern Africa',
      themes:['minerals','energy'],
      materials:['Platinum','Manganese','Palladium'], sectors:['Hydrogen','Steel','Battery'],
      summary:'70%+ of global platinum. Major manganese producer. Eskom grid instability affects mine output. PGMs critical for PEM electrolyser catalysts.',
      bottleneckCardIds:[], updated:'Q1 2026' },
    { id:'chile-lithium', lat:-23.44, lng:-68.93, risk:'elevated', title:'Chile — Lithium & Copper',
      tagText:'Policy Shift', region:'South America',
      themes:['minerals','batteries','policy'],
      materials:['Lithium','Copper'], sectors:['Battery','Grid','Renewables'],
      summary:'State participation mandate on new lithium contracts. Copper structural deficit. Lithium brine SX and LiPF6 synthesis both depend on the fluorine/reagent chain.',
      bottleneckCardIds:['lipf6','phosphine-extractants'], updated:'Q2 2026' },
    { id:'bolivia-lithium', lat:-16.29, lng:-68.15, risk:'elevated', title:'Bolivia — Lithium',
      tagText:'Concentration', region:'South America',
      themes:['minerals','batteries'],
      materials:['Lithium'], sectors:['Battery'],
      summary:'Largest undeveloped lithium reserves. State-controlled extraction. Infrastructure and political risk.',
      bottleneckCardIds:['lipf6'], updated:'Q1 2026' },
    { id:'australia-hub', lat:-25.27, lng:133.78, risk:'elevated', title:'Australia — Diversification Hub',
      tagText:'Diversification', region:'Pacific',
      themes:['minerals','batteries','defense','policy'],
      materials:['Lithium','REEs','Manganese'], sectors:['Battery','Defence','Magnets'],
      summary:'Top lithium producer. Growing REE processing. Critical Minerals Strategy reshaping investment. REE separation requires Cyanex/Ionquest-class extractants.',
      bottleneckCardIds:['lipf6','phosphine-extractants'], updated:'Q2 2026' },
    { id:'gabon-manganese', lat:-1.24, lng:11.61, risk:'elevated', title:'Gabon — Manganese',
      tagText:'Logistics Risk', region:'West Africa',
      themes:['minerals'],
      materials:['Manganese'], sectors:['Steel','Battery'],
      summary:'Major manganese exporter. Political instability and transport bottlenecks affect supply reliability.',
      bottleneckCardIds:[], updated:'Q1 2026' },
    { id:'hormuz', lat:27.51, lng:56.27, risk:'elevated', title:'Hormuz Strait',
      tagText:'Chokepoint', region:'Middle East',
      themes:['energy','shipping','conflict'],
      materials:['Oil','LNG'], sectors:['Energy','Shipping','Insurance'],
      summary:'Insurance premiums +60% YoY. LNG rerouting underway. Chokepoint for 20% of global oil transit.',
      bottleneckCardIds:[], updated:'Ongoing' },
    { id:'canada-minerals', lat:62.0, lng:-135.0, risk:'watch', title:'Canada — Minerals Strategy',
      tagText:'Emerging', region:'North America',
      themes:['minerals','policy','defense'],
      materials:['Graphite','REEs','Nickel'], sectors:['Battery','Defence','Processing'],
      summary:'C$3.8B critical minerals plan. Graphite, REE, nickel processing buildout. HP quartz deposits in Quebec under assessment.',
      bottleneckCardIds:['phosphine-extractants','hp-quartz'], updated:'Q2 2026' },
    { id:'brazil-silicon', lat:-22.91, lng:-43.17, risk:'watch', title:'Brazil — Silicon & Niobium',
      tagText:'Emerging', region:'South America',
      themes:['minerals','semiconductors'],
      materials:['Silicon (HP)','Niobium','Graphite'], sectors:['Semiconductors','Steel','Battery'],
      summary:'90%+ of global niobium. HP silicon supplier for semiconductor wafers. HP quartz from Brazilian deposits is a candidate for crucible-grade material.',
      bottleneckCardIds:['hp-quartz'], updated:'Q1 2026' },
    { id:'gulf-hydrogen', lat:24.47, lng:54.37, risk:'watch', title:'Gulf — Green Hydrogen',
      tagText:'Transition', region:'Middle East',
      themes:['energy','chemicals','nuclear'],
      materials:['Ammonia','Hydrogen'], sectors:['Energy','Shipping','Chemicals'],
      summary:'NEOM-scale green hydrogen projects. Ammonia as hydrogen carrier. IMO 2030 marine fuel transition driver.',
      bottleneckCardIds:[], updated:'Q1 2026' },
    { id:'eu-cbam', lat:50.85, lng:4.35, risk:'policy', title:'EU — CBAM, CRMA & CSRD',
      tagText:'Regulation', region:'Europe',
      themes:['policy','minerals','batteries','energy','chemicals'],
      materials:['Steel','Aluminium','Cement','Hydrogen','Fertiliser'], sectors:['All importers','Manufacturing','Mining'],
      summary:'CBAM phase-in Q3 2026. CRMA: 60 strategic projects including fluorspar processing. CSRD Wave 2: 49,000 companies in scope.',
      bottleneckCardIds:['acid-grade-fluorspar','lipf6','uf6','hf-electronic-grade'], updated:'Active — Q3 2026 enforcement' },
    { id:'us-dpa', lat:38.91, lng:-77.04, risk:'policy', title:'US — DPA & Stockpiling',
      tagText:'Defence Policy', region:'North America',
      themes:['policy','defense','minerals','semiconductors','nuclear'],
      materials:['Antimony','REEs','Gallium','Germanium'], sectors:['Defence','Semiconductors','Mining'],
      summary:'$7.5B OBBB allocation. DoD stockpiling RFIs. DPA invocations. HALEU/SMR supply chain. WF6 and NF3 inside semiconductor supply chain focus.',
      bottleneckCardIds:['wf6','nf3','semi-neon','hf-electronic-grade','uf6'], updated:'Active — ongoing' },
    { id:'uk-due-diligence', lat:50.45, lng:-3.53, risk:'policy', title:'UK — Due Diligence',
      tagText:'Regulation', region:'Europe',
      themes:['policy'],
      materials:['Cross-material'], sectors:['All sectors with supply chain exposure'],
      summary:'Modern Slavery Act expansion. Critical minerals strategy. CBAM shadow alignment with EU. Supply chain transparency requirements expose extractant and reagent sourcing.',
      bottleneckCardIds:['phosphine-extractants'], updated:'Q1 2026' },
    { id:'japan-econ', lat:35.68, lng:139.69, risk:'policy', title:'Japan — Economic Security',
      tagText:'Strategic Policy', region:'East Asia',
      themes:['policy','semiconductors','minerals','defense'],
      materials:['REEs','Lithium','Cobalt'], sectors:['Semiconductors','Battery','Defence'],
      summary:'Critical mineral stockpiling. JSR strategic take-private for EUV resist sovereignty. Semiconductor reshoring across resist, substrate, and gas supply.',
      bottleneckCardIds:['euv-photoresists','abf-films','nf3','wf6'], updated:'Active' },
    { id:'south-korea-minerals', lat:36.5, lng:127.0, risk:'policy', title:'South Korea — Mineral Security',
      tagText:'Strategic Policy', region:'East Asia',
      themes:['policy','batteries','semiconductors','minerals'],
      materials:['Lithium','Cobalt','Nickel','Graphite'], sectors:['Battery','Semiconductors'],
      summary:'35 critical minerals list. SK Specialty, Hyosung, Foosung are key NF3 and LiPF6 producers — Korea is the chokepoint for these gases.',
      bottleneckCardIds:['nf3','lipf6','abf-films'], updated:'Active' },
    { id:'spruce-pine', lat:35.9, lng:-82.0, risk:'watch', title:'Spruce Pine, NC — UHP Quartz',
      tagText:'Physical Concentration', region:'North America',
      themes:['semiconductors','minerals'],
      materials:['Ultra-high-purity quartz'], sectors:['Semiconductors','Solar'],
      summary:'Two operators (Sibelco, The Quartz Corp) at one site supply the majority of crucible-grade natural HPQ globally. Hurricane Helene (2024) briefly disrupted operations. Single-geography concentration risk for the entire silicon wafer industry.',
      bottleneckCardIds:['hp-quartz'], updated:'Q1 2026' },
  ];

  // State
  window._mapMarkers = [];
  window._mapRef = map;
  window._allKbCards = [];
  window._activeRiskFilter = 'all';
  window._activeThemeFilter = 'all';

  // Fetch knowledge cards once for panel display
  fetch('/api/research/cards').then(r => r.json()).then(d => {
    window._allKbCards = d.cards || [];
  }).catch(() => {});

  // Render static markers
  staticPoints.forEach(p => {
    const marker = L.marker([p.lat, p.lng], { icon: mkIcon(riskColors[p.risk]) }).addTo(map);
    marker._pointData = p;
    marker._riskType = p.risk;
    marker._themes = p.themes || [];
    marker._isLive = false;
    marker.on('click', () => openMapPanel(p, null));
    window._mapMarkers.push(marker);
  });
})();

// ═══ PANEL ═══
function openMapPanel(point, liveItem) {
  const data = liveItem || point;
  const panel = document.getElementById('map-detail-panel');
  if (!panel) return;

  const riskColors = { critical: '#C04A28', elevated: '#C47E30', watch: '#0E7C6B', policy: '#3B82F6', live: '#10B981' };
  const risk = liveItem ? 'live' : (point.risk || 'watch');
  const color = riskColors[risk] || '#0E7C6B';

  const title = escHtml(data.title || liveItem?.title || '');
  const summary = escHtml(data.summary || liveItem?.summary || data.desc || '');
  const region = escHtml(data.region || liveItem?.region || '');
  const tagText = escHtml(liveItem ? ('LIVE — ' + (liveItem.source || '')) : (data.tagText || ''));
  const materials = liveItem ? (liveItem.materials || []) : (data.materials || []);
  const sectors = liveItem ? (liveItem.sectors || []) : (data.sectors || []);
  const themes = liveItem ? (liveItem.themes || []) : (data.themes || []);
  const updated = liveItem
    ? (liveItem.published_at ? 'Published ' + timeAgo(new Date(liveItem.published_at)) : 'Recent')
    : (data.updated || '');
  const url = liveItem?.url || null;

  // Resolve KB cards
  const cardIds = (liveItem ? matchLiveCards(liveItem) : (data.bottleneckCardIds || []));
  const kbCards = (window._allKbCards || []).filter(c => cardIds.includes(c.id));

  // Build prefill URLs for cross-product links
  const topicStr = encodeURIComponent(title.replace(/&amp;/g, '&'));
  const sectorStr = encodeURIComponent((sectors[0] || '').replace(/&amp;/g, '&'));
  const scenarioUrl = `/scenario-lab?topic=${topicStr}&sector=${sectorStr}`;
  const rrmUrl = `/scenario-lab?rrm=1&event=${topicStr}&sector=${sectorStr}`;

  let html = `
    <button class="map-panel-close" onclick="closeMapPanel()" title="Close">&times;</button>
    <div class="map-panel-tag" style="background:${color}22;color:${color};">${tagText}</div>
    <h3 class="map-panel-title">${title}</h3>
    ${region ? `<div class="map-panel-meta">${region}${updated ? ' · ' + escHtml(updated) : ''}</div>` : ''}
    <p class="map-panel-summary">${summary}</p>`;

  if (materials.length > 0) {
    html += `<div class="map-panel-row"><div class="map-panel-row-label">Materials</div><div class="map-panel-chips">${materials.map(m => `<span class="map-chip map-chip-gold">${escHtml(m)}</span>`).join('')}</div></div>`;
  }
  if (sectors.length > 0) {
    html += `<div class="map-panel-row"><div class="map-panel-row-label">Sectors</div><div class="map-panel-chips">${sectors.map(s => `<span class="map-chip">${escHtml(s)}</span>`).join('')}</div></div>`;
  }
  if (themes.length > 0) {
    html += `<div class="map-panel-row"><div class="map-panel-row-label">Themes</div><div class="map-panel-chips">${themes.map(t => `<span class="map-chip map-chip-dim">${escHtml(t)}</span>`).join('')}</div></div>`;
  }

  // Knowledge cards block
  if (kbCards.length > 0) {
    html += `<div class="map-panel-kb">
      <div class="map-panel-kb-label">Hidden Bottleneck Links</div>`;
    kbCards.forEach(c => {
      const isHigh = (c.chokepoint_or_sanctions_exposure || '').toLowerCase().includes('high');
      const dotColor = isHigh ? '#ff8877' : '#C47E30';
      const titleColor = isHigh ? '#ff8877' : '#fff';
      const why = c.why_it_matters || '';
      const failure = c.failure_mode || '';
      const whyText = why.length > 140 ? escHtml(why.slice(0, 140)) + '…' : escHtml(why);
      const failureText = failure.length > 120 ? escHtml(failure.slice(0, 120)) + '…' : escHtml(failure);
      html += `<div class="map-panel-kb-item">
        <div class="map-panel-kb-title" style="color:${titleColor};">
          <span style="width:6px;height:6px;border-radius:50%;background:${dotColor};display:inline-block;margin-right:0.35rem;flex-shrink:0;"></span>
          ${escHtml(c.title)}
        </div>
        ${why ? `<div class="map-panel-kb-text">${whyText}</div>` : ''}
        ${failure ? `<div class="map-panel-kb-failure">Failure: ${failureText}</div>` : ''}
        <a href="/materials-watch#bottleneck-cards" class="map-panel-kb-link">View full card →</a>
      </div>`;
    });
    html += `</div>`;
  }

  // Action buttons
  html += `<div class="map-panel-actions">
    <a href="${scenarioUrl}" class="map-action-btn map-action-primary">⚡ Generate Scenario</a>
    <a href="${rrmUrl}" class="map-action-btn">📋 Generate RRM</a>
    <a href="/materials-watch#bottleneck-cards" class="map-action-btn">🔬 View Materials</a>
    ${url ? `<a href="${escHtml(url)}" target="_blank" rel="noopener" class="map-action-btn">↗ Source</a>` : ''}
  </div>`;

  panel.innerHTML = html;
  panel.classList.add('open');
}

function closeMapPanel() {
  const panel = document.getElementById('map-detail-panel');
  if (panel) panel.classList.remove('open');
}

// Match live points to knowledge cards by material/theme text
function matchLiveCards(item) {
  const cards = window._allKbCards || [];
  if (!cards.length) return [];
  const text = [
    item.title, item.summary,
    (item.materials || []).join(' '),
    (item.themes || []).join(' ')
  ].join(' ').toLowerCase();

  return cards.filter(c => {
    const cardText = [c.title, ...(c.aliases || []), (c.downstream_sectors_exposed || []).join(' ')].join(' ').toLowerCase();
    return (c.aliases || []).some(a => text.includes(a.toLowerCase())) ||
      text.includes(c.title.toLowerCase().split('/')[0].trim().slice(0, 8));
  }).map(c => c.id);
}

// ═══ FILTERING ═══
function filterMap(filter, btn, type) {
  type = type || 'risk';
  if (type === 'risk') {
    window._activeRiskFilter = filter;
    document.querySelectorAll('.map-filter-btn.risk-filter').forEach(b => b.classList.remove('active'));
  } else {
    window._activeThemeFilter = filter;
    document.querySelectorAll('.map-filter-btn.theme-filter').forEach(b => b.classList.remove('active'));
  }
  if (btn) btn.classList.add('active');
  applyMapFilter();
}

function applyMapFilter() {
  const rf = window._activeRiskFilter || 'all';
  const tf = window._activeThemeFilter || 'all';
  if (!window._mapMarkers || !window._mapRef) return;

  window._mapMarkers.forEach(m => {
    const riskMatch = rf === 'all' || m._riskType === rf || (rf === 'live' && m._isLive);
    const themeMatch = tf === 'all' || (m._themes || []).includes(tf);
    const show = riskMatch && themeMatch;
    if (show) { if (!window._mapRef.hasLayer(m)) window._mapRef.addLayer(m); }
    else { window._mapRef.removeLayer(m); }
  });
}

// ═══ LIVE POINTS ═══
async function loadLiveMapPoints() {
  try {
    const res = await fetch('/api/research/map');
    if (!res.ok) return;
    const data = await res.json();
    if (!data.points || !data.points.length || !window._mapRef) return;

    const color = '#10B981';
    const clusterRadius = 4; // degrees lat/lon

    // Remove old live markers
    (window._liveMarkers || []).forEach(m => { try { window._mapRef.removeLayer(m); } catch(e){} });
    window._liveMarkers = [];

    // Geographic clustering
    const clusters = [];
    data.points.forEach(p => {
      const existing = clusters.find(c =>
        Math.abs(c.lat - p.lat) < clusterRadius && Math.abs(c.lon - p.lon) < clusterRadius
      );
      if (existing) { existing.items.push(p); }
      else { clusters.push({ lat: p.lat, lon: p.lon, items: [p] }); }
    });

    clusters.forEach(cl => {
      const isCluster = cl.items.length > 1;
      const primary = cl.items.reduce((a, b) =>
        (b.importance_score || b.scores?.urgency || 0) > (a.importance_score || a.scores?.urgency || 0) ? b : a
      , cl.items[0]);

      const icon = isCluster
        ? L.divIcon({
            className: '',
            html: `<div style="width:22px;height:22px;border-radius:50%;background:${color};border:2px solid rgba(255,255,255,0.4);display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:#fff;box-shadow:0 0 12px ${color}80;animation:pulse-dot 2s infinite;">${cl.items.length}</div>`,
            iconSize: [22, 22], iconAnchor: [11, 11],
          })
        : L.divIcon({
            className: '',
            html: `<div style="width:10px;height:10px;border-radius:50%;background:${color};box-shadow:0 0 12px ${color};border:2px solid rgba(255,255,255,0.4);animation:pulse-dot 2s infinite;"></div>`,
            iconSize: [10, 10], iconAnchor: [5, 5],
          });

      const marker = L.marker([cl.lat, cl.lon], { icon }).addTo(window._mapRef);
      marker._riskType = 'live';
      marker._isLive = true;
      marker._themes = primary.themes || [];

      if (isCluster) {
        // Cluster: panel shows all items
        const clusterPoint = {
          title: `${cl.items.length} live signals — ${primary.region || primary.source || ''}`,
          summary: cl.items.slice(0, 3).map(i => '• ' + (i.title || '').slice(0, 80)).join('\n'),
          region: primary.region || '',
          materials: [...new Set(cl.items.flatMap(i => i.materials || []))].slice(0, 6),
          sectors: [...new Set(cl.items.flatMap(i => i.sectors || []))].slice(0, 4),
          themes: [...new Set(cl.items.flatMap(i => i.themes || []))],
          updated: primary.published_at ? 'Latest ' + timeAgo(new Date(primary.published_at)) : 'Recent',
          url: primary.url || null,
          isCluster: true,
          clusterItems: cl.items,
        };
        marker.on('click', () => openClusterPanel(clusterPoint));
      } else {
        marker.on('click', () => openMapPanel(null, primary));
      }

      window._liveMarkers.push(marker);
      window._mapMarkers.push(marker);
    });

    // Update live count badge
    const badge = document.getElementById('map-live-count');
    if (badge) badge.textContent = data.points.length + ' live signals';

    applyMapFilter();
  } catch (err) {
    // Fail silently
  }
}

function openClusterPanel(cluster) {
  const panel = document.getElementById('map-detail-panel');
  if (!panel) return;

  let html = `
    <button class="map-panel-close" onclick="closeMapPanel()">&times;</button>
    <div class="map-panel-tag" style="background:rgba(16,185,129,0.15);color:#10B981;">LIVE — ${cluster.clusterItems.length} signals</div>
    <h3 class="map-panel-title">${escHtml(cluster.title)}</h3>
    ${cluster.updated ? `<div class="map-panel-meta">${escHtml(cluster.updated)}</div>` : ''}
    <div style="margin-bottom:1rem;">`;

  cluster.clusterItems.slice(0, 8).forEach(item => {
    const ago = item.published_at ? timeAgo(new Date(item.published_at)) : '';
    html += `<div style="padding:0.55rem 0;border-bottom:1px solid rgba(255,255,255,0.07);cursor:pointer;" onclick='openMapPanel(null,${JSON.stringify({ title:item.title, summary:item.summary, region:item.region, materials:item.materials||[], sectors:item.sectors||[], themes:item.themes||[], published_at:item.published_at, url:item.url, source:item.source })})'>
      <div style="font-size:0.7rem;font-weight:600;color:#fff;line-height:1.4;">${escHtml((item.title || '').slice(0, 90))}</div>
      <div style="font-family:var(--mono);font-size:0.4rem;color:rgba(255,255,255,0.4);margin-top:0.2rem;">${escHtml(item.source || '')} ${ago ? '· ' + ago : ''}</div>
    </div>`;
  });

  html += `</div>
    <div class="map-panel-actions">
      <a href="/scenario-lab" class="map-action-btn map-action-primary">⚡ Scenario Lab</a>
      <a href="/materials-watch#bottleneck-cards" class="map-action-btn">🔬 View Materials</a>
    </div>`;

  panel.innerHTML = html;
  panel.classList.add('open');
}
