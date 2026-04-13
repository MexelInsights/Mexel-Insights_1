// ═══ HAMBURGER MENU ═══
function toggleMenu() {
  document.getElementById('hamburger').classList.toggle('open');
  document.getElementById('mobile-nav').classList.toggle('open');
  document.body.style.overflow = document.getElementById('mobile-nav').classList.contains('open') ? 'hidden' : '';
}

// ═══ HEADER SCROLL ═══
const hdr = document.getElementById('header');
if (hdr) {
  window.addEventListener('scroll', () => {
    hdr.classList.toggle('scrolled', window.scrollY > 50);
  });
}

// ═══ SCROLL REVEAL ═══
const observer = new IntersectionObserver(
  entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('in'); }),
  { threshold: 0.05 }
);
document.querySelectorAll('.rv').forEach(el => observer.observe(el));

// ═══ ACTIVE NAV ═══
(function setActiveNav() {
  const path = window.location.pathname;
  document.querySelectorAll('nav a.hm, .mobile-nav a').forEach(a => {
    const href = a.getAttribute('href');
    if (href === path || (path === '/' && href === '/')) {
      a.classList.add('active');
    }
  });
})();

// ═══ TICKER DUPLICATE ═══
const ttk = document.getElementById('ttk');
if (ttk) { const cl = ttk.cloneNode(true); cl.id = ''; ttk.parentElement.appendChild(cl); }

// ═══ API ═══
async function callAPI(endpoint, body) {
  let res;
  try {
    res = await fetch('/api/' + endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (netErr) {
    throw new Error('Network error — check your connection or the server may be down.');
  }
  if (!res.ok) {
    let errData;
    try { errData = await res.json(); } catch { errData = {}; }
    const code = errData.code || 'UNKNOWN';
    const msg = errData.error || `Server error (${res.status})`;
    throw new Error(`[${code}] ${msg}`);
  }
  return res.json();
}

function setLoading(btnId, iconId, loading) {
  const btn = document.getElementById(btnId);
  const icon = document.getElementById(iconId);
  if (!btn || !icon) return;
  btn.disabled = loading;
  icon.textContent = loading ? '\u27F3' : '\u26A1';
  if (loading) icon.classList.add('spin'); else icon.classList.remove('spin');
}

function showError(containerId, msg) {
  const el = document.getElementById(containerId);
  if (el) el.innerHTML = `<div class="error-msg">\u26A0 ${msg}</div>`;
}

function riskChip(band) {
  const labels = { 1:'1/5 Low', 2:'2/5 Guarded', 3:'3/5 Elevated', 4:'4/5 High', 5:'5/5 Critical' };
  return `<div class="risk-chip chip-${band}">${labels[band] || band + '/5'}</div>`;
}

function escHtml(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}

function timeAgo(date) {
  const secs = Math.floor((Date.now() - date.getTime()) / 1000);
  if (secs < 60) return 'just now';
  if (secs < 3600) return Math.floor(secs / 60) + 'm ago';
  if (secs < 86400) return Math.floor(secs / 3600) + 'h ago';
  return Math.floor(secs / 86400) + 'd ago';
}

// Pipeline status badge in header
async function loadPipelineStatus() {
  try {
    const res = await fetch('/api/research/stats');
    if (!res.ok) return;
    const data = await res.json();
    const statusEl = document.querySelector('.nav-status');
    if (statusEl && data.totalItems > 0) {
      statusEl.innerHTML = '<span class="status-dot"></span>' + data.totalItems + ' SIGNALS ACTIVE';
    }
  } catch {}
}

// Load pipeline status on every page
loadPipelineStatus();
