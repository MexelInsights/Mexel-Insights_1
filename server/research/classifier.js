// Thematic classifier — maps ingested items to Mexel themes, materials, sectors, channels
// Rule-based first pass; synthesis layer adds Claude-powered enrichment

const sourcesConfig = require('./sources.json');

// Keyword maps for classification
const THEME_KEYWORDS = {
  'geopolitics': ['sanction', 'conflict', 'war', 'geopolit', 'diplomacy', 'alliance', 'nato', 'brics', 'g7', 'bilateral', 'embargo', 'territory', 'military', 'defense', 'defence', 'missile', 'nuclear weapon', 'treaty'],
  'oil / gas / LNG': ['oil', 'petroleum', 'crude', 'brent', 'wti', 'opec', 'natural gas', 'lng', 'pipeline', 'refinery', 'gasoline', 'diesel', 'shale', 'fracking', 'drilling'],
  'shipping / chokepoints': ['shipping', 'maritime', 'freight', 'port', 'chokepoint', 'strait', 'canal', 'suez', 'hormuz', 'malacca', 'panama', 'bab el-mandeb', 'houthi', 'piracy', 'container', 'tanker', 'bulk carrier'],
  'critical minerals': ['mineral', 'lithium', 'cobalt', 'nickel', 'copper', 'graphite', 'rare earth', 'gallium', 'germanium', 'antimony', 'tungsten', 'tantalum', 'vanadium', 'tellurium', 'indium', 'uranium', 'manganese', 'chromium', 'bauxite', 'beryllium', 'fluorspar', 'titanium', 'zirconium', 'platinum group', 'pgm', 'palladium', 'mining', 'smelter', 'refining'],
  'critical chemicals': ['chemical', 'petrochemical', 'ammonia', 'urea', 'phosphate', 'potash', 'fertilizer', 'methanol', 'ethylene', 'polysilicon', 'semiconductor grade', 'precursor', 'reagent', 'pfas', 'fluorocarbon'],
  'ESG / sustainability policy': ['esg', 'sustainability', 'csrd', 'cbam', 'carbon border', 'taxonomy', 'green bond', 'disclosure', 'reporting', 'due diligence', 'scope 1', 'scope 2', 'scope 3', 'net zero', 'paris agreement', 'climate', 'emission'],
  'energy policy': ['energy policy', 'renewable', 'solar', 'wind', 'nuclear', 'hydrogen', 'grid', 'battery', 'storage', 'transmission', 'distribution', 'electrification', 'clean energy', 'power purchase', 'capacity', 'interconnect'],
  'industrial policy': ['industrial policy', 'ira', 'inflation reduction act', 'chips act', 'export control', 'entity list', 'tariff', 'quota', 'subsidy', 'localization', 'friend-shoring', 'near-shoring', 'reshoring', 'dpa', 'defense production act', 'critical raw materials act', 'crma', 'strategic reserve', 'stockpile'],
  'public equity implications': ['stock', 'equity', 'share price', 'market cap', 'earnings', 'ipo', 'index', 'etf', 'fund', 'portfolio', 'valuation', 'dividend', 'buyback', 'sector rotation'],
  'energy transition bottlenecks': ['bottleneck', 'constraint', 'shortage', 'lead time', 'backlog', 'permitting delay', 'interconnection queue', 'transformer shortage', 'grid congestion', 'supply gap', 'critical shortage']
};

const MATERIAL_KEYWORDS = {
  'lithium': ['lithium', 'spodumene', 'brine', 'li-ion'],
  'cobalt': ['cobalt'],
  'nickel': ['nickel', 'laterite'],
  'copper': ['copper'],
  'graphite': ['graphite', 'anode'],
  'rare earths': ['rare earth', 'ree', 'neodymium', 'dysprosium', 'praseodymium', 'lanthanum', 'cerium', 'terbium'],
  'gallium': ['gallium', 'gaas', 'gan'],
  'germanium': ['germanium'],
  'antimony': ['antimony'],
  'tungsten': ['tungsten', 'wolfram'],
  'tantalum': ['tantalum', 'coltan'],
  'vanadium': ['vanadium'],
  'tellurium': ['tellurium', 'cdte'],
  'indium': ['indium', 'ito'],
  'uranium': ['uranium', 'yellowcake', 'enrichment'],
  'platinum': ['platinum', 'pgm'],
  'palladium': ['palladium'],
  'manganese': ['manganese'],
  'silicon': ['silicon', 'polysilicon', 'ferrosilicon'],
  'fluorspar': ['fluorspar', 'fluorite'],
  'hafnium': ['hafnium'],
  'tin': ['tin', 'cassiterite'],
  'molybdenum': ['molybdenum']
};

const SECTOR_KEYWORDS = {
  'airlines': ['airline', 'aviation', 'jet fuel'],
  'defense': ['defense', 'defence', 'military', 'arms', 'missile', 'munition'],
  'semiconductors': ['semiconductor', 'chip', 'wafer', 'foundry', 'fab', 'gaas', 'gan', 'tsmc', 'intel', 'samsung semi'],
  'chemicals': ['chemical', 'petrochemical', 'basf', 'dow chemical'],
  'utilities': ['utility', 'power generation', 'grid operator', 'transmission'],
  'miners': ['mining', 'miner', 'bhp', 'rio tinto', 'glencore', 'vale', 'freeport'],
  'automotive / EV': ['automotive', 'electric vehicle', 'ev', 'tesla', 'byd', 'catl', 'battery cell'],
  'oil & gas': ['oil major', 'exxon', 'chevron', 'shell', 'bp', 'totalenergies', 'aramco', 'upstream', 'downstream'],
  'steel': ['steel', 'iron ore', 'blast furnace', 'eaf'],
  'fertilizer': ['fertilizer', 'ammonia', 'urea', 'potash', 'phosphate'],
  'solar': ['solar', 'photovoltaic', 'pv module', 'inverter'],
  'wind': ['wind turbine', 'offshore wind', 'onshore wind'],
  'nuclear': ['nuclear', 'reactor', 'enrichment', 'smr'],
  'shipping': ['shipping', 'container line', 'dry bulk', 'tanker'],
  'data centers': ['data center', 'hyperscale', 'cloud', 'compute'],
  'battery': ['battery', 'cell manufacturer', 'cathode', 'anode', 'electrolyte']
};

const CHANNEL_KEYWORDS = {
  'inflation': ['inflation', 'cpi', 'price increase', 'cost pressure'],
  'freight': ['freight', 'shipping cost', 'container rate', 'dry bulk index', 'bdi'],
  'sanctions': ['sanction', 'blacklist', 'restricted', 'blocked'],
  'export controls': ['export control', 'entity list', 'licensing requirement', 'dual use'],
  'rates': ['interest rate', 'fed', 'ecb', 'monetary policy', 'yield'],
  'power demand': ['power demand', 'electricity consumption', 'load growth', 'peak demand'],
  'supply chain': ['supply chain', 'disruption', 'shortage', 'inventory', 'stockpile'],
  'trade policy': ['tariff', 'trade agreement', 'fta', 'quota', 'anti-dumping'],
  'ESG compliance': ['esg compliance', 'disclosure', 'reporting requirement', 'audit', 'assurance'],
  'procurement': ['procurement', 'sourcing', 'offtake', 'supply agreement', 'contract'],
  'stockpiling': ['stockpile', 'strategic reserve', 'national reserve', 'buffer stock'],
  'permitting': ['permit', 'license', 'approval', 'environmental review', 'eia', 'impact assessment']
};

function classifyItem(item) {
  const text = (
    (item.title || '') + ' ' + (item.summary || '') + ' ' + (item.region || '')
  ).toLowerCase();

  // Classify themes (merge with any existing)
  const existingThemes = new Set(item.themes || []);
  for (const [theme, keywords] of Object.entries(THEME_KEYWORDS)) {
    if (keywords.some(kw => text.includes(kw))) {
      existingThemes.add(theme);
    }
  }

  // Classify materials
  const existingMaterials = new Set(item.materials || []);
  for (const [material, keywords] of Object.entries(MATERIAL_KEYWORDS)) {
    if (keywords.some(kw => text.includes(kw))) {
      existingMaterials.add(material);
    }
  }

  // Classify sectors
  const existingSectors = new Set(item.sectors || []);
  for (const [sector, keywords] of Object.entries(SECTOR_KEYWORDS)) {
    if (keywords.some(kw => text.includes(kw))) {
      existingSectors.add(sector);
    }
  }

  // Classify channels
  const existingChannels = new Set(item.channels || []);
  for (const [channel, keywords] of Object.entries(CHANNEL_KEYWORDS)) {
    if (keywords.some(kw => text.includes(kw))) {
      existingChannels.add(channel);
    }
  }

  return {
    ...item,
    themes: [...existingThemes],
    materials: [...existingMaterials],
    sectors: [...existingSectors],
    channels: [...existingChannels]
  };
}

function classifyAll(items) {
  return items.map(classifyItem);
}

module.exports = { classifyItem, classifyAll };
