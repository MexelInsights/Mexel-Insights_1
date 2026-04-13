(function initMap() {
  const mapEl = document.getElementById('intel-map');
  if (!mapEl || typeof L === 'undefined') return;

  const map = L.map('intel-map', {
    center: [25, 30],
    zoom: 2,
    minZoom: 2,
    maxZoom: 6,
    scrollWheelZoom: false,
    zoomControl: true,
    attributionControl: false,
  });

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png', {
    subdomains: 'abcd',
  }).addTo(map);

  L.control.attribution({ prefix: false, position: 'bottomright' })
    .addAttribution('&copy; <a href="https://carto.com" style="color:rgba(255,255,255,0.3)">CARTO</a>')
    .addTo(map);

  const riskColors = { critical: '#C04A28', elevated: '#C47E30', watch: '#0E7C6B', policy: '#3B82F6' };

  function mkIcon(color) {
    return L.divIcon({
      className: '',
      html: '<div style="width:12px;height:12px;border-radius:50%;background:' + color + ';box-shadow:0 0 8px ' + color + '80;border:2px solid rgba(255,255,255,0.25);"></div>',
      iconSize: [12, 12],
      iconAnchor: [6, 6],
    });
  }

  const points = [
    { lat: 35.86, lng: 104.20, risk: 'critical', title: 'China — Export Controls',
      tag: 'mpt-critical', tagText: 'Export Control',
      materials: 'Gallium, Germanium, Antimony, REEs, Tungsten, Tellurium',
      sectors: 'Semiconductors, Defence, Solar, Battery',
      desc: 'Export controls on 6+ critical minerals. 98% gallium, 60% germanium refining, 90% REE processing, 80% tungsten.' },
    { lat: 38.86, lng: 71.28, risk: 'critical', title: 'Tajikistan — Antimony',
      tag: 'mpt-critical', tagText: 'Supply Crisis',
      materials: 'Antimony',
      sectors: 'Defence, Flame retardants',
      desc: 'Second-largest antimony producer. Combined with China controls 80%+ of global supply. Defence-critical.' },
    { lat: -4.04, lng: 21.76, risk: 'critical', title: 'DRC — Cobalt & Tantalum',
      tag: 'mpt-critical', tagText: 'Conflict Minerals',
      materials: 'Cobalt, Tantalum',
      sectors: 'Battery, Electronics, Defence',
      desc: '70% of global cobalt, 60%+ tantalum. Artisanal mining ESG risk. Conflict mineral regulations apply.' },
    { lat: -0.79, lng: 113.92, risk: 'elevated', title: 'Indonesia — Nickel',
      tag: 'mpt-elevated', tagText: 'Concentration',
      materials: 'Nickel',
      sectors: 'Battery, Stainless steel',
      desc: '50%+ of global nickel supply. Processing dominance. Class 1 vs Class 2 split creating market friction.' },
    { lat: -28.48, lng: 24.68, risk: 'elevated', title: 'South Africa — PGMs & Manganese',
      tag: 'mpt-elevated', tagText: 'Concentration',
      materials: 'Platinum, Manganese, Palladium',
      sectors: 'Hydrogen, Steel, Battery',
      desc: '70%+ of global platinum. Major manganese producer. Eskom grid instability affects mine output.' },
    { lat: -23.44, lng: -68.93, risk: 'elevated', title: 'Chile — Lithium & Copper',
      tag: 'mpt-elevated', tagText: 'Policy Shift',
      materials: 'Lithium, Copper',
      sectors: 'Battery, Grid, Renewables',
      desc: 'State participation mandate on new lithium contracts. Copper structural deficit looming by 2027.' },
    { lat: -16.29, lng: -68.15, risk: 'elevated', title: 'Bolivia — Lithium',
      tag: 'mpt-elevated', tagText: 'Concentration',
      materials: 'Lithium',
      sectors: 'Battery',
      desc: 'Largest undeveloped lithium reserves. State-controlled extraction. Infrastructure and political risk.' },
    { lat: -25.27, lng: 133.78, risk: 'elevated', title: 'Australia — Diversification Hub',
      tag: 'mpt-elevated', tagText: 'Diversification',
      materials: 'Lithium, REEs, Manganese',
      sectors: 'Battery, Defence, Magnets',
      desc: 'Top lithium producer. Growing REE processing. Critical Minerals Strategy reshaping investment.' },
    { lat: -1.24, lng: 11.61, risk: 'elevated', title: 'Gabon — Manganese',
      tag: 'mpt-elevated', tagText: 'Logistics Risk',
      materials: 'Manganese',
      sectors: 'Steel, Battery',
      desc: 'Major manganese exporter. Political instability and transport bottlenecks affect supply reliability.' },
    { lat: 27.51, lng: 56.27, risk: 'elevated', title: 'Hormuz Strait',
      tag: 'mpt-elevated', tagText: 'Chokepoint',
      materials: 'Oil, LNG',
      sectors: 'Energy, Shipping, Insurance',
      desc: 'Insurance premiums +60% YoY. LNG rerouting underway. Chokepoint for 20% of global oil transit.' },
    { lat: 62.0, lng: -135.0, risk: 'watch', title: 'Canada — Minerals Strategy',
      tag: 'mpt-watch', tagText: 'Emerging',
      materials: 'Graphite, REEs, Nickel',
      sectors: 'Battery, Defence, Processing',
      desc: 'C$3.8B critical minerals plan. Graphite, REE, nickel processing buildout. US-Canada supply chain alignment.' },
    { lat: -22.91, lng: -43.17, risk: 'watch', title: 'Brazil — Silicon & Niobium',
      tag: 'mpt-watch', tagText: 'Emerging',
      materials: 'Silicon (HP), Niobium, Graphite',
      sectors: 'Semiconductors, Steel, Battery',
      desc: '90%+ of global niobium. Key HP silicon supplier for semiconductor wafers. Growing graphite output.' },
    { lat: 24.47, lng: 54.37, risk: 'watch', title: 'Gulf — Green Hydrogen',
      tag: 'mpt-watch', tagText: 'Transition',
      materials: 'Ammonia, Hydrogen',
      sectors: 'Energy, Shipping, Chemicals',
      desc: 'NEOM-scale green hydrogen projects. Ammonia as hydrogen carrier. IMO 2030 marine fuel transition driver.' },
    { lat: 50.85, lng: 4.35, risk: 'policy', title: 'EU — CBAM, CRMA & CSRD',
      tag: 'mpt-policy', tagText: 'Regulation',
      materials: 'Steel, Aluminium, Cement, Hydrogen, Fertiliser',
      sectors: 'All importers, Manufacturing, Mining',
      desc: 'CBAM phase-in Q3 2026. CRMA: 60 strategic projects. CSRD Wave 2: 49,000 companies in scope.' },
    { lat: 38.91, lng: -77.04, risk: 'policy', title: 'US — DPA & Stockpiling',
      tag: 'mpt-policy', tagText: 'Defence Policy',
      materials: 'Antimony, REEs, Gallium, Germanium',
      sectors: 'Defence, Semiconductors, Mining',
      desc: '$7.5B allocation. DoD stockpiling RFIs. Defence Production Act invocations. Permitting reform.' },
    { lat: 50.45, lng: -3.53, risk: 'policy', title: 'UK — Due Diligence',
      tag: 'mpt-policy', tagText: 'Regulation',
      materials: 'Cross-material',
      sectors: 'All sectors with supply chain exposure',
      desc: 'Modern Slavery Act expansion. Critical minerals strategy under review. CBAM shadow alignment with EU.' },
    { lat: 35.68, lng: 139.69, risk: 'policy', title: 'Japan — Economic Security',
      tag: 'mpt-policy', tagText: 'Strategic Policy',
      materials: 'REEs, Lithium, Cobalt',
      sectors: 'Semiconductors, Battery, Defence',
      desc: 'Critical mineral stockpiling. Joint ventures in Australia, Canada for REE and lithium. Semiconductor reshoring.' },
    { lat: 36.5, lng: 127.0, risk: 'policy', title: 'South Korea — Mineral Security',
      tag: 'mpt-policy', tagText: 'Strategic Policy',
      materials: 'Lithium, Cobalt, Nickel, Graphite',
      sectors: 'Battery, Semiconductors',
      desc: '35 critical minerals list. Overseas resource development push. Battery supply chain diversification.' },
  ];

  // Store markers for filtering
  window._mapMarkers = [];
  points.forEach(p => {
    const marker = L.marker([p.lat, p.lng], { icon: mkIcon(riskColors[p.risk]) }).addTo(map);
    marker.bindPopup(
      '<div class="map-popup-tag ' + p.tag + '">' + p.tagText + '</div>' +
      '<div style="margin-bottom:0.3rem;"><strong>' + p.title + '</strong></div>' +
      '<div style="color:rgba(255,255,255,0.6);font-size:0.8rem;line-height:1.55;margin-bottom:0.5rem;">' + p.desc + '</div>' +
      '<div style="font-family:var(--mono);font-size:0.48rem;color:var(--gold);letter-spacing:0.06em;margin-bottom:0.2rem;">MATERIALS: ' + p.materials + '</div>' +
      '<div style="font-family:var(--mono);font-size:0.48rem;color:rgba(255,255,255,0.4);letter-spacing:0.06em;">SECTORS: ' + p.sectors + '</div>',
      { maxWidth: 300 }
    );
    marker._riskType = p.risk;
    window._mapMarkers.push(marker);
  });

  window._mapRef = map;
})();

// Map filter function
function filterMap(filter, btn) {
  document.querySelectorAll('.map-filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  if (!window._mapMarkers || !window._mapRef) return;
  window._mapMarkers.forEach(m => {
    if (filter === 'all' || m._riskType === filter) {
      if (!window._mapRef.hasLayer(m)) window._mapRef.addLayer(m);
    } else {
      window._mapRef.removeLayer(m);
    }
  });
}

async function loadLiveMapPoints() {
  try {
    const res = await fetch('/api/research/map');
    if (!res.ok) return;
    const data = await res.json();
    if (!data.points || data.points.length === 0) return;
    if (!window._mapRef) return;

    const riskColors = { critical: '#C04A28', elevated: '#C47E30', watch: '#0E7C6B', policy: '#3B82F6', live: '#10B981' };

    function mkLiveIcon(color) {
      return L.divIcon({
        className: '',
        html: '<div style="width:10px;height:10px;border-radius:50%;background:' + color + ';box-shadow:0 0 12px ' + color + ';border:2px solid rgba(255,255,255,0.4);animation:pulse-dot 2s infinite;"></div>',
        iconSize: [10, 10],
        iconAnchor: [5, 5],
      });
    }

    data.points.forEach(p => {
      const color = riskColors.live;
      const marker = L.marker([p.lat, p.lon], { icon: mkLiveIcon(color) }).addTo(window._mapRef);
      const matStr = (p.materials || []).join(', ') || 'N/A';
      const secStr = (p.sectors || []).join(', ') || 'N/A';
      marker.bindPopup(
        '<div class="map-popup-tag" style="background:rgba(16,185,129,0.15);color:#10B981;">LIVE — ' + escHtml(p.source) + '</div>' +
        '<div style="margin-bottom:0.3rem;"><strong>' + escHtml(p.title) + '</strong></div>' +
        '<div style="color:rgba(255,255,255,0.6);font-size:0.8rem;line-height:1.55;margin-bottom:0.5rem;">' + escHtml(p.summary).slice(0, 200) + '</div>' +
        (matStr !== 'N/A' ? '<div style="font-family:var(--mono);font-size:0.48rem;color:var(--gold);letter-spacing:0.06em;margin-bottom:0.2rem;">MATERIALS: ' + escHtml(matStr) + '</div>' : '') +
        (secStr !== 'N/A' ? '<div style="font-family:var(--mono);font-size:0.48rem;color:rgba(255,255,255,0.4);letter-spacing:0.06em;">SECTORS: ' + escHtml(secStr) + '</div>' : '') +
        '<div style="font-family:var(--mono);font-size:0.36rem;color:rgba(255,255,255,0.3);margin-top:0.4rem;">Live · ' + (p.published_at ? timeAgo(new Date(p.published_at)) : 'Recent') + '</div>',
        { maxWidth: 300 }
      );
      marker._riskType = 'live';
      if (window._mapMarkers) window._mapMarkers.push(marker);
    });
  } catch (err) {
    // Fail silently — static map points remain
  }
}