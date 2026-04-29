/**
 * AstroQuest UAT — frozen pane with a 3-row scrollable grid of theme pills.
 *
 * Theme list & display rule come from /themes.json (the manifest you edit
 * directly or via uat/cli.py). Falls back to an embedded default if the
 * fetch fails — so existing static pages still work.
 *
 * Display rules (set in themes.json → display.mode):
 *   latest_n        keep only the newest max_show themes in the visible grid
 *                   (default: 25). Older themes go into the ARCHIVE strip
 *                   rendered above the grid — hidden by default,
 *                   reachable by scrolling the bar upward.
 *   exclude_oldest  drop the first N themes by createdAt (oldest first).
 *                   Dropped themes also go into the archive.
 *   all             show every theme in the grid, no archive.
 *
 * Layout:
 *   The visible 25 pills are laid out in a CSS grid of **3 rows** that
 *   auto-flows by column. Users scroll the grid HORIZONTALLY to reach
 *   pills off-screen. There is NO marquee animation — pills are static.
 *
 * Archive UX:
 *   The whole #aq-theme-bar is internally scrollable in Y. After mount we
 *   set scrollTop past the archive so the user only sees the 3-row grid by
 *   default. Scrolling the bar UPWARD reveals the archive of older themes;
 *   a small chevron hint at the top edge cues the affordance.
 *
 * Usage:
 *   <script>window.AQ_THEME = 'theme1';</script>
 *   <script src="/shared/theme-switcher.js"></script>
 */
(function () {
  // ---- Embedded fallback (kept in sync with themes.json by uat/generate.py) ----
  var FALLBACK = {
    display: { mode: 'latest_n', max_show: 25, exclude_oldest: 5, fallback_when_few: true },
    themes: [
      { id: 'theme1',  name: 'Sacred Saffron',    color: '#F4A52E', createdAt: '2025-04-22' },
      { id: 'theme2',  name: 'Midnight Cosmos',   color: '#D4AF37', createdAt: '2025-04-22' },
      { id: 'theme3',  name: 'Temple Marble',     color: '#8B6F47', createdAt: '2025-04-22' },
      { id: 'theme4',  name: 'Forest Sage',       color: '#4A7C59', createdAt: '2025-04-22' },
      { id: 'theme5',  name: 'Royal Maroon',      color: '#8B1A3A', createdAt: '2025-04-22' },
      { id: 'theme6',  name: 'Lotus Bloom',       color: '#D63384', createdAt: '2025-04-25' },
      { id: 'theme7',  name: 'Brass Temple',      color: '#A0673A', createdAt: '2025-04-25' },
      { id: 'theme8',  name: 'Monsoon Sky',       color: '#2B6CB0', createdAt: '2025-04-25' },
      { id: 'theme9',  name: 'Sunrise Tilak',     color: '#E85D2D', createdAt: '2025-04-25' },
      { id: 'theme10', name: 'Nakshatra Black',   color: '#9F00FF', createdAt: '2025-04-25' },
      { id: 'theme11', name: 'Pearl & Pearl',     color: '#9C8E6C', createdAt: '2025-04-25' },
      { id: 'theme12', name: 'Banaras Ghat',      color: '#B23C17', createdAt: '2025-04-25' },
      { id: 'theme13', name: 'Himalayan Snow',    color: '#1F6F8B', createdAt: '2025-04-25' },
      { id: 'theme14', name: 'Sandalwood Ivory',  color: '#7B5E3C', createdAt: '2025-04-25' },
      { id: 'theme15', name: 'Rajwada Ruby',      color: '#9B1B30', createdAt: '2025-04-25' },
    ],
  };

  var current = (window.AQ_THEME || '').toString();

  // ---- styles ----
  var css = `
#aq-theme-bar{
  position:sticky;top:0;z-index:60;
  background:linear-gradient(180deg,rgba(15,15,25,.98) 0%,rgba(15,15,25,.92) 100%);
  backdrop-filter:saturate(140%) blur(12px);
  -webkit-backdrop-filter:saturate(140%) blur(12px);
  border-bottom:1px solid rgba(255,255,255,.08);
  box-shadow:0 6px 20px rgba(0,0,0,.35);
  padding:0;
  /* The bar is internally scrollable in Y. The user-set height (--aq-tb-h)
     is set inline by JS — defaults to 182px (compact). When expanded mode is
     toggled, --aq-tb-h jumps to a larger value so all pills wrap into view. */
  height:var(--aq-tb-h, 182px);
  max-height:90vh;
  min-height:64px;
  overflow-y:auto;overflow-x:hidden;
  scroll-behavior:smooth;
  scrollbar-width:thin;
  scrollbar-color:rgba(255,255,255,.25) transparent;
  contain:layout paint;
  resize:none; /* we provide our own handle so the cursor is consistent */
  transition:height .22s cubic-bezier(.34,1.2,.64,1);
}
#aq-theme-bar::-webkit-scrollbar{width:6px;height:6px;}
#aq-theme-bar::-webkit-scrollbar-thumb{
  background:rgba(255,255,255,.22);border-radius:3px;
}
#aq-theme-bar::-webkit-scrollbar-track{background:transparent;}

/* --- Archive strip (older themes), rendered ABOVE the grid --- */
#aq-theme-bar .aq-tb-archive{
  background:linear-gradient(180deg,rgba(0,0,0,.55) 0%,rgba(0,0,0,.25) 100%);
  border-bottom:1px dashed rgba(255,255,255,.18);
  padding:10px 14px 12px;
}
#aq-theme-bar .aq-tb-archive-title{
  display:flex;align-items:center;gap:8px;
  color:#94a3b8;font:700 10px/1 system-ui,-apple-system,sans-serif;
  letter-spacing:.22em;text-transform:uppercase;margin-bottom:8px;
}
#aq-theme-bar .aq-tb-archive-title .aq-tb-arrow{
  font-size:14px;color:#cbd5e1;letter-spacing:0;
}
#aq-theme-bar .aq-tb-archive-list{
  display:flex;flex-wrap:wrap;gap:6px;
}
#aq-theme-bar .aq-tb-archive-list a.aq-tb-pill{opacity:.78;}
#aq-theme-bar .aq-tb-archive-list a.aq-tb-pill:hover{opacity:1;}

/* --- "Scroll up for older" hint, sits at the top edge of the grid --- */
#aq-theme-bar .aq-tb-archive-cue{
  position:sticky;top:0;z-index:2;
  display:flex;align-items:center;justify-content:center;gap:6px;
  height:14px;margin:-1px 0 -6px;
  pointer-events:none;
  color:#cbd5e1;font:600 9.5px/1 system-ui,-apple-system,sans-serif;
  letter-spacing:.18em;text-transform:uppercase;opacity:.55;
}
#aq-theme-bar .aq-tb-archive-cue .chev{font-size:11px;animation:aq-tb-bob 1.6s ease-in-out infinite;}
@keyframes aq-tb-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-2px)}}

/* --- Visible grid section --- */
#aq-theme-bar .aq-tb-pane{padding:8px 0 14px;}
#aq-theme-bar .aq-tb-title{
  display:flex;align-items:center;gap:8px;
  padding:0 14px 6px;
  color:#cbd5e1;font:700 10px/1 system-ui,-apple-system,sans-serif;
  letter-spacing:.22em;text-transform:uppercase;opacity:.7;
}
#aq-theme-bar .aq-tb-title .aq-tb-titlecopy{
  flex:1;min-width:0;display:inline-block;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}
#aq-theme-bar .aq-tb-title .aq-tb-dot-static{
  width:6px;height:6px;border-radius:50%;background:#22c55e;flex:0 0 6px;
  box-shadow:0 0 8px #22c55e88;animation:aq-tb-pulse 1.6s ease-in-out infinite;
}

/* --- Expand/collapse toggle (chevron) --- */
#aq-theme-bar .aq-tb-toggle{
  position:relative;flex:0 0 auto;
  display:inline-flex;align-items:center;justify-content:center;gap:5px;
  background:rgba(255,255,255,.06);
  color:#e2e8f0;
  border:1px solid rgba(255,255,255,.14);
  border-radius:999px;
  padding:5px 10px;
  font:700 10px/1 system-ui,-apple-system,sans-serif;
  letter-spacing:.06em;text-transform:uppercase;
  cursor:pointer;
  transition:background .18s ease,border-color .18s ease,transform .18s ease;
}
#aq-theme-bar .aq-tb-toggle:hover{
  background:rgba(255,255,255,.14);
  border-color:rgba(255,255,255,.25);
}
#aq-theme-bar .aq-tb-toggle .aq-tb-chev-i{
  display:inline-block;font-size:10px;line-height:1;
  transition:transform .22s cubic-bezier(.34,1.5,.64,1);
}
#aq-theme-bar.is-expanded .aq-tb-toggle .aq-tb-chev-i{transform:rotate(180deg);}

/* --- Grid layout: COMPACT (3 rows, scroll horizontally) --- */
#aq-theme-bar .aq-tb-scroller{
  overflow-x:auto;overflow-y:hidden;
  padding:4px 14px 6px;
  scrollbar-width:thin;
  scrollbar-color:rgba(255,255,255,.25) transparent;
  scroll-snap-type:x proximity;
  -webkit-overflow-scrolling:touch;
  /* soft fade at the right edge to hint there's more horizontally */
  mask-image:linear-gradient(90deg,#000 0,#000 calc(100% - 32px),transparent 100%);
  -webkit-mask-image:linear-gradient(90deg,#000 0,#000 calc(100% - 32px),transparent 100%);
}
#aq-theme-bar .aq-tb-grid{
  display:grid;
  grid-template-rows:repeat(3, auto);
  grid-auto-flow:column;
  grid-auto-columns:max-content;
  column-gap:8px;row-gap:6px;
  width:max-content;
}
#aq-theme-bar .aq-tb-grid > a.aq-tb-pill{scroll-snap-align:start;}

/* --- Grid layout: EXPANDED (wrap, full width, no horizontal scroll) --- */
#aq-theme-bar.is-expanded .aq-tb-scroller{
  overflow-x:hidden;overflow-y:visible;
  mask:none;-webkit-mask:none;
  padding:6px 14px 12px;
}
#aq-theme-bar.is-expanded .aq-tb-grid{
  display:flex;flex-wrap:wrap;gap:8px;
  width:100%;
}
#aq-theme-bar.is-expanded .aq-tb-grid > a.aq-tb-pill{scroll-snap-align:none;}

/* --- Bottom resize handle (drag to set custom height) --- */
#aq-theme-bar .aq-tb-resize{
  position:sticky;bottom:0;left:0;right:0;
  height:11px;margin-top:auto;
  display:flex;align-items:center;justify-content:center;
  cursor:ns-resize;user-select:none;
  background:linear-gradient(180deg,rgba(15,15,25,0) 0%,rgba(15,15,25,.85) 60%,rgba(15,15,25,1) 100%);
  z-index:3;
  transition:background .18s ease;
}
#aq-theme-bar .aq-tb-resize:hover{background:linear-gradient(180deg,rgba(15,15,25,.4) 0%,rgba(15,15,25,1) 100%);}
#aq-theme-bar .aq-tb-resize::before{
  content:"";display:block;width:36px;height:3px;border-radius:99px;
  background:rgba(255,255,255,.28);
  transition:background .18s ease,width .18s ease;
}
#aq-theme-bar .aq-tb-resize:hover::before,
#aq-theme-bar .aq-tb-resize.is-dragging::before{
  background:rgba(255,255,255,.55);
  width:54px;
}
#aq-theme-bar.is-resizing{transition:none;}
body.aq-tb-resizing,body.aq-tb-resizing *{
  cursor:ns-resize !important;user-select:none !important;
}


@keyframes aq-tb-pulse{0%,100%{opacity:1}50%{opacity:.35}}
@media (prefers-reduced-motion: reduce){
  #aq-theme-bar .aq-tb-title .aq-tb-dot-static,
  #aq-theme-bar .aq-tb-archive-cue .chev{animation:none!important;}
}

/* --- Pill (shared by archive & grid) --- */
#aq-theme-bar a.aq-tb-pill{
  flex:0 0 auto;
  display:inline-flex;align-items:center;gap:7px;
  text-decoration:none;font:600 12.5px/1 system-ui,-apple-system,sans-serif;
  padding:8px 14px;border-radius:999px;
  background:rgba(255,255,255,.06);color:#e2e8f0;
  border:1px solid rgba(255,255,255,.1);
  transition:transform .18s ease,background .18s ease,box-shadow .18s ease,opacity .18s ease;
  cursor:pointer;white-space:nowrap;
}
#aq-theme-bar a.aq-tb-pill:hover{
  background:rgba(255,255,255,.16);
  transform:translateY(-1px) scale(1.04);
  box-shadow:0 6px 18px rgba(0,0,0,.4);
}
#aq-theme-bar a.aq-tb-pill .aq-tb-dot{
  width:10px;height:10px;border-radius:50%;
  box-shadow:0 0 0 2px rgba(255,255,255,.18),0 0 8px currentColor;
}
#aq-theme-bar a.aq-tb-pill.active{
  background:#fff;color:#0f172a;font-weight:700;
  border-color:#fff;
  box-shadow:0 6px 18px rgba(255,255,255,.25),0 0 0 2px rgba(255,255,255,.4);
  transform:scale(1.05);
  opacity:1;
}
#aq-theme-bar a.aq-tb-pill.active .aq-tb-dot{box-shadow:0 0 0 2px #0f172a22;}
#aq-theme-bar .aq-tb-num{
  display:inline-block;min-width:14px;text-align:center;
  font-variant-numeric:tabular-nums;opacity:.6;font-size:11px;
}
#aq-theme-bar a.aq-tb-pill.active .aq-tb-num{opacity:.55;}

/* --- Like (heart) button — pinned at the right edge of the title row --- */
#aq-theme-bar .aq-tb-title{position:relative;}
#aq-theme-bar .aq-tb-like{
  position:absolute;right:14px;top:-2px;
  display:inline-flex;align-items:center;gap:6px;
  background:rgba(255,255,255,.06);
  color:#e2e8f0;
  border:1px solid rgba(255,255,255,.14);
  border-radius:999px;
  padding:5px 11px 5px 9px;
  font:700 11px/1 system-ui,-apple-system,sans-serif;
  letter-spacing:.06em;
  cursor:pointer;
  transition:transform .18s ease,background .18s ease,border-color .18s ease,box-shadow .18s ease;
}
#aq-theme-bar .aq-tb-like:hover{
  background:rgba(255,255,255,.14);
  transform:translateY(-1px);
  box-shadow:0 6px 16px rgba(0,0,0,.35);
}
#aq-theme-bar .aq-tb-like .aq-tb-heart{
  font-size:14px;line-height:1;
  filter:grayscale(60%);transition:filter .18s ease,transform .25s cubic-bezier(.34,1.56,.64,1);
}
#aq-theme-bar .aq-tb-like.is-liked{
  background:linear-gradient(135deg,#ff4d6d,#ff8fa3);
  color:#fff;border-color:#ff8fa3;
  box-shadow:0 6px 18px rgba(255,77,109,.35),0 0 0 2px rgba(255,143,163,.4);
}
#aq-theme-bar .aq-tb-like.is-liked .aq-tb-heart{filter:none;transform:scale(1.18);}
#aq-theme-bar .aq-tb-like .aq-tb-like-count{
  display:inline-block;min-width:14px;text-align:center;
  font-variant-numeric:tabular-nums;opacity:.85;
}
#aq-theme-bar .aq-tb-like[disabled]{opacity:.5;pointer-events:none;}
@keyframes aq-tb-pop{
  0%{transform:scale(1)}
  35%{transform:scale(1.5)}
  70%{transform:scale(.9)}
  100%{transform:scale(1.18)}
}
#aq-theme-bar .aq-tb-like.is-pop .aq-tb-heart{animation:aq-tb-pop .42s ease both;}

@media (max-width:520px){
  #aq-theme-bar .aq-tb-like{padding:4px 9px 4px 8px;font-size:10.5px;}
}

@media (max-width:520px){
  #aq-theme-bar{max-height:170px;}
  #aq-theme-bar a.aq-tb-pill{padding:7px 11px;font-size:12px;}
  #aq-theme-bar .aq-tb-scroller{padding:4px 10px 6px;}
}
`;
  var styleEl = document.createElement('style');
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  // ---- filter pipeline based on display rule ----
  // Returns { visible: [...newest in grid], archive: [...older hidden above] }
  function applyDisplayRule(themes, display) {
    var sorted = themes.slice().sort(function (a, b) {
      var ad = (a.createdAt || '');
      var bd = (b.createdAt || '');
      // Primary: createdAt asc; tiebreak: id (so theme1 < theme2 on same date)
      if (ad === bd) return (a.id || '').localeCompare(b.id || '', undefined, { numeric: true });
      return ad < bd ? -1 : 1;
    });

    var d = display || {};
    var mode = d.mode || 'latest_n';
    var fallback = d.fallback_when_few !== false;
    var visible = sorted;
    var archive = [];

    if (mode === 'all') {
      visible = sorted;
      archive = [];
    } else if (mode === 'exclude_oldest') {
      var k = d.exclude_oldest != null ? d.exclude_oldest : 5;
      if (fallback && sorted.length <= k) {
        visible = sorted;
        archive = [];
      } else {
        archive = sorted.slice(0, k);
        visible = sorted.slice(k);
      }
      if (d.max_show && visible.length > d.max_show) {
        var extra = visible.slice(0, visible.length - d.max_show);
        archive = archive.concat(extra);
        visible = visible.slice(visible.length - d.max_show);
      }
    } else {
      // latest_n (default)
      var n = d.max_show != null ? d.max_show : 25;
      if (sorted.length <= n) {
        visible = sorted;
        archive = [];
      } else {
        archive = sorted.slice(0, sorted.length - n);
        visible = sorted.slice(sorted.length - n);
      }
    }

    // Always include the currently-displayed theme in the visible grid.
    if (current && !visible.some(function (t) { return t.id === current; })) {
      var cur = sorted.find(function (t) { return t.id === current; });
      if (cur) {
        archive = archive.filter(function (t) { return t.id !== current; });
        visible = [cur].concat(visible);
      }
    }

    // Archive newest-first (closest in time to the visible grid feels intuitive)
    archive = archive.slice().reverse();

    return { visible: visible, archive: archive, total: sorted.length };
  }

  // ---- DOM helpers ----
  function makePill(t, idx, isArchive) {
    var a = document.createElement('a');
    a.className = 'aq-tb-pill' + (t.id === current ? ' active' : '');
    a.href = '/' + t.id + '/';
    a.setAttribute('aria-current', t.id === current ? 'page' : 'false');
    a.title = (idx + 1) + ' · ' + t.name +
              (t.createdAt ? ' · ' + t.createdAt : '') +
              (isArchive ? ' · archived' : '');
    a.innerHTML =
      '<span class="aq-tb-dot" style="background:' + t.color + ';color:' + t.color + '"></span>' +
      '<span class="aq-tb-num">' + (idx + 1) + '</span>' +
      '<span>' + t.name + '</span>';
    return a;
  }

  // ---- Bar size: persistent compact/expanded mode + custom drag-resize ----
  // Modes: 'compact' (≈182px, 3 horizontal rows) or 'expanded' (wraps, taller).
  var SIZE_KEY = 'aq_uat_bar_size_v1';
  var COMPACT_H = 182;
  var EXPANDED_H = 360;        // sensible default for ~25 pills wrapped
  var MIN_H = 64, MAX_H_VH = 0.85;

  function readSize() {
    try {
      var raw = window.localStorage && window.localStorage.getItem(SIZE_KEY);
      if (!raw) return { mode: 'compact', height: COMPACT_H };
      var p = JSON.parse(raw);
      return {
        mode: p.mode === 'expanded' ? 'expanded' : 'compact',
        height: typeof p.height === 'number' ? p.height : COMPACT_H,
      };
    } catch (e) { return { mode: 'compact', height: COMPACT_H }; }
  }
  function writeSize(state) {
    try {
      window.localStorage && window.localStorage.setItem(SIZE_KEY, JSON.stringify(state));
    } catch (e) { /* ignore */ }
  }
  function clampHeight(h) {
    var maxH = Math.floor(window.innerHeight * MAX_H_VH);
    return Math.max(MIN_H, Math.min(maxH, Math.round(h)));
  }
  function applySize(bar, state) {
    bar.style.setProperty('--aq-tb-h', state.height + 'px');
    bar.classList.toggle('is-expanded', state.mode === 'expanded');
  }

  function buildToggleButton() {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'aq-tb-toggle';
    btn.setAttribute('aria-label', 'Expand or collapse the theme bar');
    btn.title = 'Expand / collapse · drag the handle below to resize';
    btn.innerHTML = '<span class="aq-tb-chev-i" aria-hidden="true">▾</span><span>View</span>';
    btn.addEventListener('click', function () {
      var bar = document.getElementById('aq-theme-bar');
      if (!bar) return;
      var state = readSize();
      if (state.mode === 'expanded') {
        state.mode = 'compact';
        state.height = COMPACT_H;
      } else {
        state.mode = 'expanded';
        // Auto-fit: roughly enough rows to show every visible pill.
        var pills = bar.querySelectorAll('.aq-tb-grid > .aq-tb-pill').length;
        var per = window.innerWidth < 540 ? 3 : 6;
        var rows = Math.ceil(pills / per);
        state.height = clampHeight(72 + rows * 38 + 18);
      }
      applySize(bar, state);
      writeSize(state);
    });
    return btn;
  }

  function buildResizeHandle() {
    var grip = document.createElement('div');
    grip.className = 'aq-tb-resize';
    grip.setAttribute('role', 'separator');
    grip.setAttribute('aria-orientation', 'horizontal');
    grip.setAttribute('aria-label', 'Drag to resize the theme bar');
    grip.title = 'Drag to resize · double-click to reset';

    var dragging = false, startY = 0, startH = 0;

    function onMove(ev) {
      if (!dragging) return;
      var y = (ev.touches && ev.touches[0]) ? ev.touches[0].clientY : ev.clientY;
      var bar = document.getElementById('aq-theme-bar');
      if (!bar) return;
      var newH = clampHeight(startH + (y - startY));
      bar.style.setProperty('--aq-tb-h', newH + 'px');
      bar.classList.add('is-resizing');
    }
    function onEnd() {
      if (!dragging) return;
      dragging = false;
      grip.classList.remove('is-dragging');
      document.body.classList.remove('aq-tb-resizing');
      var bar = document.getElementById('aq-theme-bar');
      if (bar) bar.classList.remove('is-resizing');
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onEnd);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
      // Persist the new height; keep current mode.
      var state = readSize();
      var bar2 = document.getElementById('aq-theme-bar');
      if (bar2) {
        var rect = bar2.getBoundingClientRect();
        state.height = Math.round(rect.height);
        // Auto-switch to expanded when user drags clearly past compact baseline.
        if (state.height > COMPACT_H + 24) state.mode = 'expanded';
        else state.mode = 'compact';
        applySize(bar2, state);
      }
      writeSize(state);
    }
    function onStart(ev) {
      ev.preventDefault();
      var bar = document.getElementById('aq-theme-bar');
      if (!bar) return;
      var rect = bar.getBoundingClientRect();
      startH = rect.height;
      startY = (ev.touches && ev.touches[0]) ? ev.touches[0].clientY : ev.clientY;
      dragging = true;
      grip.classList.add('is-dragging');
      document.body.classList.add('aq-tb-resizing');
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onEnd);
      window.addEventListener('touchmove', onMove, { passive: false });
      window.addEventListener('touchend', onEnd);
    }
    grip.addEventListener('mousedown', onStart);
    grip.addEventListener('touchstart', onStart, { passive: false });

    // Double-click resets to compact baseline.
    grip.addEventListener('dblclick', function () {
      var bar = document.getElementById('aq-theme-bar');
      var state = { mode: 'compact', height: COMPACT_H };
      if (bar) applySize(bar, state);
      writeSize(state);
    });

    return grip;
  }

  function buildArchiveSection(archive) {
    var section = document.createElement('div');
    section.className = 'aq-tb-archive';
    var title = document.createElement('div');
    title.className = 'aq-tb-archive-title';
    title.innerHTML =
      '<span class="aq-tb-arrow">↑</span>' +
      '<span>Archive · ' + archive.length + ' older theme' +
        (archive.length === 1 ? '' : 's') + '</span>';
    section.appendChild(title);
    var list = document.createElement('div');
    list.className = 'aq-tb-archive-list';
    archive.forEach(function (t, i) { list.appendChild(makePill(t, i, true)); });
    section.appendChild(list);
    return section;
  }

  function buildVisibleGrid(visible) {
    // Wrapper handles horizontal scroll; inner grid lays pills in 3 rows
    // and auto-flows by column.
    var scroller = document.createElement('div');
    scroller.className = 'aq-tb-scroller';
    scroller.setAttribute('role', 'group');
    scroller.setAttribute('aria-label', 'Theme pills (scroll horizontally)');

    var grid = document.createElement('div');
    grid.className = 'aq-tb-grid';
    visible.forEach(function (t, i) { grid.appendChild(makePill(t, i)); });
    scroller.appendChild(grid);
    return scroller;
  }

  // ---- Like button (heart) -------------------------------------------------
  // Persists liked-state in localStorage so the same browser remembers what
  // it has already liked (the backend dedupes by IP+UA hash too). The button
  // updates the visible count optimistically and swaps to the server's
  // authoritative count once the POST returns.
  var LIKE_KEY = 'aq_uat_liked_themes_v1';
  function getLikedSet() {
    try {
      var raw = window.localStorage && window.localStorage.getItem(LIKE_KEY);
      return new Set(raw ? JSON.parse(raw) : []);
    } catch (e) { return new Set(); }
  }
  function saveLikedSet(set) {
    try {
      window.localStorage && window.localStorage.setItem(
        LIKE_KEY, JSON.stringify(Array.from(set))
      );
    } catch (e) { /* private mode etc. */ }
  }

  function buildLikeButton(themeId) {
    var liked = getLikedSet().has(themeId);
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'aq-tb-like' + (liked ? ' is-liked' : '');
    btn.setAttribute('aria-pressed', liked ? 'true' : 'false');
    btn.title = liked
      ? 'You liked this theme — tap to undo'
      : 'Tap the heart if this theme works for you';
    btn.innerHTML =
      '<span class="aq-tb-heart" aria-hidden="true">' + (liked ? '♥' : '♡') + '</span>' +
      '<span>Like</span>' +
      '<span class="aq-tb-like-count" data-aq-like-count>—</span>';

    // Fetch the current authoritative count for this theme on mount.
    fetch('/api/theme-likes/summary', { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (!data) return;
        var c = (data.totals && data.totals[themeId]) || 0;
        var el = btn.querySelector('[data-aq-like-count]');
        if (el) el.textContent = String(c);
      })
      .catch(function () { /* ignore */ });

    btn.addEventListener('click', function () {
      if (btn.hasAttribute('disabled')) return;
      btn.setAttribute('disabled', 'true');
      var wasLiked = btn.classList.contains('is-liked');
      // Optimistic UI flip
      btn.classList.toggle('is-liked');
      btn.classList.add('is-pop');
      setTimeout(function () { btn.classList.remove('is-pop'); }, 450);
      var heart = btn.querySelector('.aq-tb-heart');
      if (heart) heart.textContent = wasLiked ? '♡' : '♥';
      btn.setAttribute('aria-pressed', wasLiked ? 'false' : 'true');

      fetch('/api/theme-like', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          theme: themeId,
          action: 'toggle',
          ua: (navigator.userAgent || '').slice(0, 250),
        }),
      })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (data) {
          if (!data) throw new Error('bad response');
          // Reconcile to server truth
          var nowLiked = !!data.liked;
          btn.classList.toggle('is-liked', nowLiked);
          btn.setAttribute('aria-pressed', nowLiked ? 'true' : 'false');
          if (heart) heart.textContent = nowLiked ? '♥' : '♡';
          var el = btn.querySelector('[data-aq-like-count]');
          if (el) el.textContent = String(data.count || 0);
          var s = getLikedSet();
          if (nowLiked) s.add(themeId); else s.delete(themeId);
          saveLikedSet(s);
        })
        .catch(function () {
          // Roll back optimistic flip on failure
          btn.classList.toggle('is-liked');
          if (heart) heart.textContent = wasLiked ? '♥' : '♡';
          btn.setAttribute('aria-pressed', wasLiked ? 'true' : 'false');
        })
        .finally(function () {
          btn.removeAttribute('disabled');
        });
    });

    return btn;
  }


  function buildBar(visible, archive, totalCount) {
    var bar = document.createElement('nav');
    bar.id = 'aq-theme-bar';
    bar.setAttribute('aria-label', 'Theme picker');

    // Archive (older themes), rendered FIRST so it sits visually ABOVE
    // the grid inside the scrollable bar. Hidden by default by setting
    // scrollTop after mount.
    if (archive.length) {
      bar.appendChild(buildArchiveSection(archive));
    }

    // Visible pane (title + horizontally scrollable grid)
    var pane = document.createElement('div');
    pane.className = 'aq-tb-pane';

    if (archive.length) {
      var cue = document.createElement('div');
      cue.className = 'aq-tb-archive-cue';
      cue.setAttribute('aria-hidden', 'true');
      cue.innerHTML = '<span class="chev">▲</span><span>scroll up for ' + archive.length + ' older</span><span class="chev">▲</span>';
      pane.appendChild(cue);
    }

    var title = document.createElement('div');
    title.className = 'aq-tb-title';
    title.innerHTML =
      '<span class="aq-tb-dot-static"></span>' +
      '<span class="aq-tb-titlecopy">Pick a theme — tap any pill to switch · ' +
        visible.length + ' of ' + totalCount + ' candidates' +
        (archive.length ? ' · ' + archive.length + ' in archive ↑' : '') +
      '</span>';

    // Expand/collapse toggle
    title.appendChild(buildToggleButton());

    // The Like button — pinned to the right edge of the title row.
    if (current) {
      var like = buildLikeButton(current);
      title.appendChild(like);
    }
    pane.appendChild(title);

    if (visible.length === 0) {
      var empty = document.createElement('div');
      empty.style.cssText = 'padding:6px 14px;color:#94a3b8;font:500 12px system-ui';
      empty.textContent = 'No themes to display under the current display rule.';
      pane.appendChild(empty);
    } else {
      pane.appendChild(buildVisibleGrid(visible));
    }

    bar.appendChild(pane);

    // Bottom-edge drag-resize handle (sticky inside the scrollable bar).
    bar.appendChild(buildResizeHandle());
    return bar;
  }

  function mount(bar, hasArchive) {
    var existing = document.getElementById('aq-theme-bar');
    if (existing) existing.replaceWith(bar);
    else if (document.body.firstChild) document.body.insertBefore(bar, document.body.firstChild);
    else document.body.appendChild(bar);

    // Restore the user's saved size (compact/expanded + custom drag height).
    applySize(bar, readSize());

    // After mount, scroll PAST the archive so users see the grid by default.
    // Scrolling the bar upward then reveals the archive of older themes.
    if (hasArchive) {
      requestAnimationFrame(function () {
        var archiveEl = bar.querySelector('.aq-tb-archive');
        if (archiveEl) bar.scrollTop = archiveEl.offsetHeight;
      });
    }

    // Center the active pill horizontally inside the scroller so the user
    // immediately sees where they are in the lineup.
    requestAnimationFrame(function () {
      var scroller = bar.querySelector('.aq-tb-scroller');
      var active = bar.querySelector('.aq-tb-grid .aq-tb-pill.active');
      if (scroller && active) {
        var sLeft = scroller.scrollLeft;
        var sWidth = scroller.clientWidth;
        var aLeft = active.offsetLeft;
        var aWidth = active.offsetWidth;
        var target = aLeft - (sWidth / 2) + (aWidth / 2);
        scroller.scrollLeft = Math.max(0, target);
      }
    });
  }

  // ---- main: render fallback synchronously, then upgrade with manifest ----
  function renderFromData(data) {
    var result = applyDisplayRule(data.themes || [], data.display);
    mount(buildBar(result.visible, result.archive, result.total), result.archive.length > 0);
  }

  function start() {
    // Render fallback immediately so users don't see a blank top bar.
    renderFromData(FALLBACK);

    // Then try to fetch the live manifest and upgrade in place.
    fetch('/themes.json', { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) { if (data && data.themes) renderFromData(data); })
      .catch(function () { /* keep fallback */ });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
