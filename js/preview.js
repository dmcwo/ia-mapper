/* ── Menu Preview module ───────────────────────────────────────
   Renders a live nav preview from the AM tree.
   Exposes: window.Preview.render(), window.Preview.init()
   ─────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  var currentVP    = 'desktop';
  var currentTheme = 'default';
  var siteName     = 'Site'; // customizable via the site name input field

  /* Called after render to align the mega panel spacer with the brand width.
     Assigned by initMegaHighlight(); no-op until then.                       */
  var alignMegaSpacer = function() {};

  /* Theme '1' = Two-tier  (no external CSS — uses Default nav style)
     Theme '2' = Mega       (UCLA-style, pmega- prefix)
     Theme '4' = Compact    (compact-sticky CSS)                    */
  var THEME_CSS_FILE = {
    '2': 'css/theme-mega-v2.css',
    '4': 'css/theme-4-compact-sticky.css',
    '5': 'css/theme-5-rich-dropdown.css'
  };

  /* ── Main render ─────────────────────────────────────────── */
  function render() {
    var state   = State.getState();
    var content = document.getElementById('preview-content');
    if (!content) return;

    if (state.rootIds.length === 0 && !(state.utilityEnabled && state.utilityIds.length)) {
      content.innerHTML = '<p class="preview-empty">Add pages to the Architecture Map to see your navigation here.</p>';
      return;
    }

    content.innerHTML = currentVP === 'mobile'
      ? buildMobilePreview(state)
      : buildDesktopPreview(state);

    if (currentTheme === '2') requestAnimationFrame(alignMegaSpacer);
  }

  /* ── Route to the right desktop builder ─────────────────── */
  function buildDesktopPreview(state) {
    switch (currentTheme) {
      case '1': return buildThemeTwoTier(state);
      case '2': return buildThemeMega(state);
      case '4': return buildThemeCompact(state);
      case '5': return buildThemeRich(state);
      default:  return buildDefault(state);
    }
  }

  /* ══════════════════════════════════════════════════════════
     DEFAULT THEME
     ══════════════════════════════════════════════════════════ */
  function buildDefault(state) {
    var hasUtil = state.utilityEnabled && state.utilityIds.length > 0;

    var html = '<nav class="pnav-wrapper" aria-label="Preview navigation">' +
      '<div class="pnav-brand">' + esc(siteName) + '</div>' +
      '<ul class="preview-nav">';
    state.rootIds.forEach(function (id) { html += buildDefaultItem(id, state, 0); });
    html += '</ul>';

    if (hasUtil) {
      html += '<ul class="preview-utility-nav">';
      state.utilityIds.forEach(function (id) { html += buildDefaultItem(id, state, 0); });
      html += '</ul>';
    }

    html += '</nav>';
    return html;
  }

  function buildDefaultItem(id, state, depth) {
    var card = state.cards[id];
    if (!card) return '';
    var hasChildren = card.childIds.length > 0;
    var chevron = hasChildren
      ? '<span class="pnav-chevron" aria-hidden="true">' + (depth === 0 ? '▾' : '›') + '</span>'
      : '';

    var html = '<li class="' + (hasChildren ? 'has-sub' : '') + '">';
    html += '<span class="pnav-item">' + esc(card.title) + chevron + '</span>';
    if (hasChildren) {
      html += '<ul class="pnav-sub">';
      card.childIds.forEach(function (cid) { html += buildDefaultItem(cid, state, depth + 1); });
      html += '</ul>';
    }
    html += '</li>';
    return html;
  }

  /* ══════════════════════════════════════════════════════════
     THEME 1 — Two-tier
     Slim utility bar above + the same nav as Default below.
     No theme CSS — uses pnav-wrapper / pnav-sub from style.css.
     Behaviour is identical to Default; just adds the utility tier.
     ══════════════════════════════════════════════════════════ */
  function buildThemeTwoTier(state) {
    var hasUtil = state.utilityEnabled && state.utilityIds.length > 0;
    var html = '';

    // Tier 1 — slim utility bar
    if (hasUtil) {
      html += '<div class="preview-util-bar">';
      state.utilityIds.forEach(function (id) {
        var c = state.cards[id];
        if (c) html += '<a class="preview-util-link">' + esc(c.title) + '</a>';
      });
      html += '</div>';
    }

    // Tier 2 — same nav as Default
    html += '<nav class="pnav-wrapper" aria-label="Preview navigation">' +
      '<div class="pnav-brand">' + esc(siteName) + '</div>' +
      '<ul class="preview-nav">';
    state.rootIds.forEach(function (id) { html += buildDefaultItem(id, state, 0); });
    html += '</ul></nav>';

    return html;
  }

  /* ══════════════════════════════════════════════════════════
     THEME 2 — Mega menu (UCLA-style)
     Dark nav bar with fixed-width tabs aligned to panel columns.
     Spacer element maintains brand-area offset. Panel fades in on
     nav hover; yellow indicator + column dimming on tab hover.
     ══════════════════════════════════════════════════════════ */
  function buildThemeMega(state) {
    var hasUtil = state.utilityEnabled && state.utilityIds.length > 0;

    var html = '<div class="pmega-nav"><div class="pmega-bar">' +
      '<div class="pmega-brand">' + esc(siteName) + '</div>' +
      '<nav aria-label="Primary navigation"><ul class="pmega-tab-list">';

    var colIdx = 0;
    state.rootIds.forEach(function(id) {
      var card = state.cards[id];
      if (!card) return;
      if (card.childIds.length > 0) {
        html += '<li class="pmega-tab pmega-tab--has-col" data-col="' + colIdx + '">' +
          '<button class="pmega-tab-btn">' + esc(card.title) + '</button></li>';
        colIdx++;
      } else {
        html += '<li class="pmega-tab"><a class="pmega-tab-link">' + esc(card.title) + '</a></li>';
      }
    });

    html += '</ul></nav>';

    if (hasUtil) {
      html += '<div class="pmega-utility">';
      state.utilityIds.forEach(function(id) {
        var c = state.cards[id];
        if (c) html += '<a class="pmega-util-link">' + esc(c.title) + '</a>';
      });
      html += '</div>';
    }

    html += '</div>'; // .pmega-bar

    /* ── Panel: columns aligned under tabs via spacer ─────────── */
    var hasCols = false;
    var cols = '';
    var colIdx2 = 0;
    state.rootIds.forEach(function(id) {
      var card = state.cards[id];
      if (!card || card.childIds.length === 0) return;
      hasCols = true;
      cols += '<div class="pmega-col" data-col="' + colIdx2 + '">' +
        '<ul class="pmega-col-list">';
      card.childIds.forEach(function(cid) {
        var child = state.cards[cid];
        if (!child) return;
        cols += '<li><a class="pmega-col-link">' + esc(child.title) + '</a></li>';
      });
      cols += '</ul></div>';
      colIdx2++;
    });

    if (hasCols) {
      html += '<div class="pmega-panel">' +
        '<div class="pmega-panel-inner">' +
        '<div class="pmega-spacer"></div>' +
        '<div class="pmega-cols">' + cols + '</div>' +
        '</div></div>';
    }

    html += '</div>'; // .pmega-nav
    return html;
  }

  /* ══════════════════════════════════════════════════════════
     THEME 4 — Compact sticky
     Single-row header: logo | nav | utility links.
     Flyouts open at L2; L3+ items with children are grouped
     inline within the flyout (never spawn another flyout).
     ══════════════════════════════════════════════════════════ */
  function buildThemeCompact(state) {
    var hasUtil = state.utilityEnabled && state.utilityIds.length > 0;

    var html = '<header class="site-header site-header--sticky">' +
      '<div class="primary-header"><div class="primary-header__inner">' +
      '<div class="site-logo"><span class="site-logo-text">' + esc(siteName) + '</span></div>' +
      '<div class="nav-shell">' +
      '<nav class="primary-nav" aria-label="Primary navigation"><ul class="primary-nav__list">';

    state.rootIds.forEach(function (id) { html += buildCompactDropdownItem(id, state); });

    html += '</ul></nav>';

    if (hasUtil) {
      html += '<div class="utility-actions">';
      state.utilityIds.forEach(function (id) {
        var c = state.cards[id];
        if (c) html += '<a class="utility-action utility-action--link">' + esc(c.title) + '</a>';
      });
      html += '</div>';
    }

    html += '</div></div></div></header>';
    return html;
  }

  /* ── Compact dropdown item (L1 → open panel below) ─────── */
  function buildCompactDropdownItem(id, state) {
    var card = state.cards[id];
    if (!card) return '';
    var hasChildren = card.childIds.length > 0;

    if (!hasChildren) {
      return '<li class="primary-nav__item"><a class="primary-nav__link">' + esc(card.title) + '</a></li>';
    }

    var html = '<li class="primary-nav__item primary-nav__item--has-dropdown">' +
      '<button class="primary-nav__link primary-nav__link--parent" aria-expanded="false">' +
      esc(card.title) + ' <span class="dropdown-arrow" aria-hidden="true"></span>' +
      '</button>' +
      '<ul class="dropdown-menu">';
    card.childIds.forEach(function (cid) { html += buildCompactChild(cid, state, 0); });
    html += '</ul></li>';
    return html;
  }

  /* ── Compact child renderer ──────────────────────────────
     depth 0  → flyout panel opens to the right
     depth 1+ → plain link with › if it has deeper children
                (no further flyout levels; children are shown
                 as indented links inside the sub-panel)       */
  function buildCompactChild(id, state, depth) {
    var card = state.cards[id];
    if (!card) return '';
    var hasChildren = card.childIds && card.childIds.length > 0;

    // Leaf at any depth: plain link
    if (!hasChildren) {
      var cls = depth > 0 ? 'dropdown-menu__link dropdown-menu__link--sub' : 'dropdown-menu__link';
      return '<li class="dropdown-menu__item"><a class="' + cls + '">' + esc(card.title) + '</a></li>';
    }

    // depth 0: single flyout panel opening to the right
    if (depth === 0) {
      var html = '<li class="dropdown-menu__item dropdown-menu__item--has-sub">' +
        '<a class="dropdown-menu__link dropdown-menu__link--has-sub">' +
        esc(card.title) + ' <span class="dropdown-sub-arrow" aria-hidden="true">›</span></a>' +
        '<ul class="dropdown-menu dropdown-menu--sub">';
      card.childIds.forEach(function (cid) { html += buildCompactChild(cid, state, 1); });
      html += '</ul></li>';
      return html;
    }

    // depth 1+: plain link with › indicator (shows children are further nested)
    var indicator = ' <span class="dropdown-sub-arrow" aria-hidden="true">›</span>';
    return '<li class="dropdown-menu__item">' +
      '<a class="dropdown-menu__link dropdown-menu__link--sub">' + esc(card.title) + indicator + '</a></li>';
  }

  /* ══════════════════════════════════════════════════════════
     THEME 5 — Rich dropdown
     Dark nav bar + wide card panel with icon+title+desc tiles.
     ══════════════════════════════════════════════════════════ */
  function buildThemeRich(state) {
    var hasUtil = state.utilityEnabled && state.utilityIds.length > 0;

    var html = '<header class="prich-header">' +
      '<div class="prich-inner">' +
      '<div class="prich-brand">' + esc(siteName) + '</div>' +
      '<nav class="prich-nav" aria-label="Primary navigation">' +
      '<ul class="prich-list">';

    state.rootIds.forEach(function(id) { html += buildRichNavItem(id, state); });

    html += '</ul></nav>';

    if (hasUtil) {
      html += '<div class="prich-utility">';
      state.utilityIds.forEach(function(id) {
        var c = state.cards[id];
        if (c) html += '<a class="prich-util-link">' + esc(c.title) + '</a>';
      });
      html += '</div>';
    }

    html += '</div></header>';
    return html;
  }

  function buildRichNavItem(id, state) {
    var card = state.cards[id];
    if (!card) return '';
    var hasChildren = card.childIds.length > 0;

    if (!hasChildren) {
      return '<li class="prich-item"><a class="prich-link">' + esc(card.title) + '</a></li>';
    }

    var grid = '<div class="prich-grid">';
    card.childIds.forEach(function(cid, idx) {
      var child = state.cards[cid];
      if (!child) return;
      var initial = esc((child.title || '?').charAt(0).toUpperCase());
      grid += '<a class="prich-card">' +
        '<div class="prich-card-icon prich-icon--' + (idx % 6) + '">' + initial + '</div>' +
        '<div class="prich-card-body">' +
        '<div class="prich-card-title">' + esc(child.title) + '</div>' +
        (child.description ? '<div class="prich-card-desc">' + esc(child.description) + '</div>' : '') +
        '</div></a>';
    });
    grid += '</div>';

    return '<li class="prich-item prich-item--has-panel">' +
      '<button class="prich-link prich-link--parent">' +
      esc(card.title) + ' <span class="prich-chevron" aria-hidden="true">&#9662;</span></button>' +
      '<div class="prich-panel">' + grid + '</div>' +
      '</li>';
  }

  /* ══════════════════════════════════════════════════════════
     MOBILE PREVIEW (shared across all themes)
     ══════════════════════════════════════════════════════════ */
  function buildMobilePreview(state) {
    var hasUtil = state.utilityEnabled && state.utilityIds.length > 0;

    var html =
      '<div class="preview-mobile-chrome">' +
        '<div class="preview-mobile-bar">' +
          '<span class="pmob-brand">' + esc(siteName) + '</span>' +
          '<button class="preview-hamburger" aria-label="Open menu">☰</button>' +
        '</div>' +
        '<div class="preview-mobile-panel">' +
          '<nav aria-label="Mobile preview navigation"><ul class="pmob-nav">';

    state.rootIds.forEach(function (id) { html += buildMobileItem(id, state, 0); });
    html += '</ul>';

    if (hasUtil) {
      html += '<div class="pmob-utility-divider" aria-hidden="true"></div>' +
        '<ul class="pmob-nav pmob-utility-nav">';
      state.utilityIds.forEach(function (id) { html += buildMobileItem(id, state, 0); });
      html += '</ul>';
    }

    html += '</nav></div></div>';
    return html;
  }

  function buildMobileItem(id, state, depth) {
    var card = state.cards[id];
    if (!card) return '';
    var hasChildren = card.childIds.length > 0;
    var indent = depth > 0 ? ' style="padding-left:' + (8 + depth * 14) + 'px"' : '';

    var html = '<li>';
    html += '<span class="pmob-item' + (depth > 0 ? ' pmob-item--child' : '') + '"' + indent + '>';
    if (depth > 0) html += '<span class="pmob-indent-marker" aria-hidden="true">—</span> ';
    html += esc(card.title) + '</span>';
    if (hasChildren) {
      html += '<ul class="pmob-sub">';
      card.childIds.forEach(function (cid) { html += buildMobileItem(cid, state, depth + 1); });
      html += '</ul>';
    }
    html += '</li>';
    return html;
  }

  /* ══════════════════════════════════════════════════════════
     THEME SWITCHING
     ══════════════════════════════════════════════════════════ */
  function setTheme(theme) {
    currentTheme = theme;
    loadThemeCSS(theme);

    document.querySelectorAll('.theme-btn').forEach(function (btn) {
      var active = btn.dataset.theme === theme;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', String(active));
    });

    var frame = document.getElementById('preview-frame');
    if (frame) {
      // Two-tier uses Default nav styles — no themed frame overrides needed
      var isThemed = theme !== 'default' && theme !== '1';
      frame.classList.toggle('themed', isThemed);
    }

    render();
  }

  function loadThemeCSS(theme) {
    var old = document.getElementById('preview-theme-css');
    if (old) old.parentNode.removeChild(old);

    var file = THEME_CSS_FILE[theme];
    if (!file) return; // default and two-tier load no external CSS

    var link = document.createElement('link');
    link.id   = 'preview-theme-css';
    link.rel  = 'stylesheet';
    link.href = file;
    document.head.appendChild(link);
  }

  /* ── Viewport toggle ─────────────────────────────────────── */
  function setViewport(vp) {
    currentVP = vp;
    var frame = document.getElementById('preview-frame');
    if (frame) frame.dataset.vp = vp;
    document.querySelectorAll('.vp-btn').forEach(function (btn) {
      var active = btn.dataset.vp === vp;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', String(active));
    });
    render();
  }

  /* ── Sub-menu smart flip (prevent right-edge overflow) ──────
     Compact theme: on mouseenter of a --has-sub item, check if
     the flyout sub-menu would overflow the preview frame and
     flip it leftward if so.                                    */
  function initSmartFlip() {
    var content = document.getElementById('preview-content');
    if (!content) return;
    content.addEventListener('mouseenter', function (e) {
      var item = e.target && e.target.closest && e.target.closest('.dropdown-menu__item--has-sub');
      if (!item) return;
      var sub = item.querySelector(':scope > .dropdown-menu--sub');
      if (!sub) return;
      var frame     = document.getElementById('preview-frame');
      var frameRight = frame ? frame.getBoundingClientRect().right : window.innerWidth;
      var itemRight  = item.getBoundingClientRect().right;
      var subWidth   = sub.offsetWidth || 220;
      sub.classList.toggle('flip-left', itemRight + subWidth > frameRight - 8);
    }, true);

    // Rich theme: flip panel rightward when it overflows the preview frame
    content.addEventListener('mouseenter', function(e) {
      var item = e.target && e.target.closest && e.target.closest('.prich-item--has-panel');
      if (!item) return;
      var panel = item.querySelector('.prich-panel');
      if (!panel) return;
      var frame = document.getElementById('preview-frame');
      var frameRight = frame ? frame.getBoundingClientRect().right : window.innerWidth;
      var itemLeft = item.getBoundingClientRect().left;
      var panelWidth = panel.offsetWidth || 480;
      panel.classList.toggle('prich-panel--flip-right', itemLeft + panelWidth > frameRight - 8);
    }, true);
  }

  /* ── Mega column highlight (UCLA-style hover) ───────────────
     Mouseenter on a .pmega-tab--has-col → yellow indicator + dim
     all other columns, brighten the matching one.
     Mouseleave of .pmega-nav → reset all state.               */
  function initMegaHighlight() {
    var content = document.getElementById('preview-content');
    if (!content) return;

    /* Align the panel spacer so the first column sits directly under
       the first parent tab, regardless of how many leaf tabs precede it. */
    alignMegaSpacer = function() {
      var firstTab   = content.querySelector('.pmega-tab--has-col .pmega-tab-btn');
      var panelInner = content.querySelector('.pmega-panel-inner');
      var spacer     = content.querySelector('.pmega-spacer');
      if (!firstTab || !panelInner || !spacer) return;
      var tabLeft   = firstTab.getBoundingClientRect().left;
      var innerLeft = panelInner.getBoundingClientRect().left;
      spacer.style.width = Math.max(0, tabLeft - innerLeft) + 'px';
    };

    content.addEventListener('mouseenter', function(e) {
      if (currentTheme !== '2') return;
      var tab = e.target && e.target.closest && e.target.closest('.pmega-tab--has-col');
      if (!tab) return;
      alignMegaSpacer();
      var colIdx = tab.getAttribute('data-col');
      /* Tabs */
      content.querySelectorAll('.pmega-tab--has-col').forEach(function(t) { t.classList.remove('is-active'); });
      tab.classList.add('is-active');
      /* Columns */
      var cols = content.querySelector('.pmega-cols');
      if (!cols) return;
      cols.classList.add('has-active');
      cols.querySelectorAll('.pmega-col').forEach(function(c) { c.classList.remove('is-active'); });
      var col = cols.querySelector('.pmega-col[data-col="' + colIdx + '"]');
      if (col) col.classList.add('is-active');
    }, true);

    content.addEventListener('mouseleave', function(e) {
      if (currentTheme !== '2') return;
      var nav = e.target && e.target.closest && e.target.closest('.pmega-nav');
      if (!nav) return;
      content.querySelectorAll('.pmega-tab--has-col').forEach(function(t) { t.classList.remove('is-active'); });
      var cols = content.querySelector('.pmega-cols');
      if (cols) {
        cols.classList.remove('has-active');
        cols.querySelectorAll('.pmega-col').forEach(function(c) { c.classList.remove('is-active'); });
      }
    }, true);

    window.addEventListener('resize', alignMegaSpacer);
  }

  /* ── Init ────────────────────────────────────────────────── */
  function init() {
    document.querySelectorAll('.vp-btn').forEach(function (btn) {
      btn.addEventListener('click', function () { setViewport(btn.dataset.vp); });
    });

    document.querySelectorAll('.theme-btn').forEach(function (btn) {
      btn.addEventListener('click', function () { setTheme(btn.dataset.theme); });
    });

    var siteNameInput = document.getElementById('preview-site-name-input');
    if (siteNameInput) {
      // Restore persisted site name
      var savedName = localStorage.getItem('ia-site-name');
      if (savedName !== null) {
        siteNameInput.value = savedName;
        siteName = savedName || 'Site';
      }
      siteNameInput.addEventListener('input', function () {
        siteName = siteNameInput.value || 'Site';
        localStorage.setItem('ia-site-name', siteNameInput.value);
        render();
      });
    }

    initSmartFlip();
    initMegaHighlight();
  }

  /* ── Helpers ─────────────────────────────────────────────── */
  function esc(str) {
    return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  window.Preview = { render: render, init: init };
})();
