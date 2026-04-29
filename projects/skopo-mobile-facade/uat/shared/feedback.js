/**
 * AstroQuest UAT — shared feedback widget.
 *
 * Mounted inside every theme prototype (theme1..theme5). Posts a single
 * payload to /api/theme-feedback so the team can compare votes across themes.
 *
 * Auto-binds to elements with these IDs:
 *   #aq-fb-stars        — 5 buttons rendered inside (1..5)
 *   #aq-fb-thumbs       — 👍 / 👎 toggle buttons
 *   #aq-fb-comment      — <textarea>
 *   #aq-fb-name         — <input> (optional)
 *   #aq-fb-submit       — <button> Submit
 *   #aq-fb-status       — <div> for status / thank-you message
 *
 * The current page must set window.AQ_THEME = "theme1" (or 2..5) BEFORE
 * including this script.
 */
(function () {
  var THEME = (window.AQ_THEME || 'unknown').toString();

  var state = { stars: 0, thumb: null };

  function el(id) { return document.getElementById(id); }

  function renderStars() {
    var box = el('aq-fb-stars');
    if (!box) return;
    box.innerHTML = '';
    for (var i = 1; i <= 5; i++) {
      (function (n) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'aq-star' + (n <= state.stars ? ' on' : '');
        b.setAttribute('aria-label', n + ' star');
        b.textContent = '★';
        b.onclick = function () { state.stars = n; renderStars(); };
        box.appendChild(b);
      })(i);
    }
  }

  function renderThumbs() {
    var up = el('aq-fb-thumb-up');
    var dn = el('aq-fb-thumb-dn');
    if (up) up.classList.toggle('on', state.thumb === 'up');
    if (dn) dn.classList.toggle('on', state.thumb === 'dn');
  }

  function bindThumbs() {
    var up = el('aq-fb-thumb-up');
    var dn = el('aq-fb-thumb-dn');
    if (up) up.onclick = function () { state.thumb = state.thumb === 'up' ? null : 'up'; renderThumbs(); };
    if (dn) dn.onclick = function () { state.thumb = state.thumb === 'dn' ? null : 'dn'; renderThumbs(); };
  }

  function setStatus(msg, kind) {
    var s = el('aq-fb-status');
    if (!s) return;
    s.textContent = msg || '';
    s.className = 'aq-fb-status ' + (kind || '');
  }

  function submit() {
    var btn = el('aq-fb-submit');
    if (btn) btn.disabled = true;
    setStatus('Sending…', '');
    var payload = {
      theme: THEME,
      stars: state.stars,
      thumb: state.thumb,
      name: (el('aq-fb-name') && el('aq-fb-name').value || '').slice(0, 80),
      comment: (el('aq-fb-comment') && el('aq-fb-comment').value || '').slice(0, 2000),
      url: location.href,
      ua: navigator.userAgent.slice(0, 200),
      ts: new Date().toISOString(),
    };
    fetch('/api/theme-feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function () {
      setStatus('Thank you! Your feedback has been recorded. 🙏', 'ok');
      // Disable the form so they don't double-submit
      ['aq-fb-comment', 'aq-fb-name', 'aq-fb-submit'].forEach(function (id) {
        var n = el(id); if (n) n.disabled = true;
      });
      var stars = el('aq-fb-stars'); if (stars) stars.style.pointerEvents = 'none';
    }).catch(function (e) {
      setStatus('Could not send feedback: ' + e.message + '. Please try again.', 'err');
      if (btn) btn.disabled = false;
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    renderStars();
    bindThumbs();
    renderThumbs();
    var btn = el('aq-fb-submit');
    if (btn) btn.onclick = submit;
  });
})();
