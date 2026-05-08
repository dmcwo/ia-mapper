/* ── Menu Preview module ───────────────────────────────────────
   Renders a live nav preview from the AM tree.
   Exposes: window.Preview.render(), window.Preview.init()
   ─────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  var currentVP    = 'desktop';
  var currentTheme = 'default';
  var showUtility  = true;   // preview option: show utility nav section
  var siteName     = 'Site'; // customizable via the site name input field

  /* Theme '1' = Two-tier  (no external CSS — uses Default nav style)
     Theme '2' = Mega       (reuses theme-1 utility-dropdown CSS)
     Theme '4' = Compact    (compact-sticky CSS)                    */
  var THEME_CSS_FILE = {
    '2': 'css/theme-1-utility-dropdown.css',
    '4': 'css/theme-4-compact-sticky.css'
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
  }

  /* ── Route to the right desktop builder ─────────────────── */
  function buildDesktopPreview(state) {
    switch (currentTheme) {
      case '1': return buildThemeTwoTier(state);
      case '2': return buildThemeMega(state);
      case '4': return buildThemeCompact(state);
      default:  return buildDefault(state);
    }
  }

  /* ══════════════════════════════════════════════════════════
     DEFAULT THEME
     ══════════════════════════════════════════════════════════ */
  function buildDefault(state) {
    var hasUtil = showUtility && state.utilityEnabled && state.utilityIds.length > 0;

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
    var hasUtil = showUtility && state.utilityEnabled && state.utilityIds.length > 0;
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
     THEME 2 — Mega menu
     Styled header (utility-dropdown CSS) + full-width dark panel.
     All nav items with children show the shared mega panel;
     no individual flyout dropdowns.
     ══════════════════════════════════════════════════════════ */
  function buildThemeMega(state) {
    var hasUtil = showUtility && state.utilityEnabled && state.utilityIds.length > 0;

    var html = '<header class="site-header site-header--mega">';

    /* ── Row 1: Utility bar ──────────────────────────────────── */
    if (hasUtil) {
      html += '<div class="utility-bar"><div class="utility-bar__inner">' +
        '<nav class="utility-nav" aria-label="Utility navigation"><ul class="utility-nav__list">';
      state.utilityIds.forEach(function (id) {
        var c = state.cards[id];
        if (c) html += '<li class="utility-nav__item"><a class="utility-nav__link">' + esc(c.title) + '</a></li>';
      });
      html += '</ul></nav></div></div>';
    }

    /* ── Row 2: Brand row (logo only, white bg) ──────────────── */
    html += '<div class="mega-brand-row">' +
      '<span class="site-logo-text">' + esc(siteName) + '</span>' +
      '</div>';

    /* ── Row 3: Full-width nav row (dark bg, equal-width items)
       Items WITH children get data-mega-col so JS can highlight
       the matching panel column on hover.                        */
    var colIdx = 0;
    var navItems = '';
    state.rootIds.forEach(function (id) {
      var card = state.cards[id];
      if (!card) return;
      if (card.childIds.length > 0) {
        navItems += '<li class="primary-nav__item" data-mega-col="' + colIdx + '">' +
          '<button class="primary-nav__link primary-nav__link--parent">' +
          esc(card.title) + '</button></li>';
        colIdx++;
      } else {
        navItems += '<li class="primary-nav__item"><a class="primary-nav__link">' + esc(card.title) + '</a></li>';
      }
    });

    /* Nav row: full-width background, but content is max-width-constrained
       via .mega-nav-row__inner so text never runs to the screen edges.
       The panel is a sibling of the inner wrapper (not inside it) so its
       left:0/right:0 still covers the full row width for the background,
       while its inner content also uses the same max-width constraint.   */
    html += '<div class="mega-nav-row">' +
      '<div class="mega-nav-row__inner">' +
      '<nav class="primary-nav primary-nav--has-mega" aria-label="Primary navigation">' +
      '<ul class="primary-nav__list">' + navItems + '</ul></nav>' +
      '</div>' +
      buildMegaPanel(state) +
      '</div>';

    html += '</header>';
    return html;
  }

  /* ══════════════════════════════════════════════════════════
     THEME 4 — Compact sticky
     Single-row header: logo | nav | utility links.
     Flyouts open at L2; L3+ items with children are grouped
     inline within the flyout (never spawn another flyout).
     ══════════════════════════════════════════════════════════ */
  function buildThemeCompact(state) {
    var hasUtil = showUtility && state.utilityEnabled && state.utilityIds.length > 0;

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

  /* ── Shared mega panel builder ───────────────────────────────
     One column per L1 item that has children.
     L2 items are shown as flat links — no sub-navigation.
     Modelled on UCLA Library's mega menu pattern.             */
  function buildMegaPanel(state) {
    var cols = '';
    var colIdx = 0;
    state.rootIds.forEach(function (id) {
      var card = state.cards[id];
      if (!card || card.childIds.length === 0) return;
      cols += '<div class="mega-col" data-mega-col="' + colIdx + '">';
      // No column header — the nav bar item above is the visual label.
      // Adding the title again here would duplicate every L1 name.
      cols += '<ul class="mega-col__list">';
      card.childIds.forEach(function (cid) {
        var child = state.cards[cid];
        if (!child) return;
        var hasSub = child.childIds && child.childIds.length > 0;
        cols += '<li><a class="mega-col__link">' + esc(child.title) +
          (hasSub ? ' <span class="mega-col__sub-arrow" aria-hidden="true">›</span>' : '') +
          '</a></li>';
      });
      cols += '</ul></div>';
      colIdx++;
    });
    if (!cols) return '';
    return '<div class="preview-mega-panel"><div class="mega-panel__inner">' + cols + '</div></div>';
  }

  /* ══════════════════════════════════════════════════════════
     MOBILE PREVIEW (shared across all themes)
     ══════════════════════════════════════════════════════════ */
  function buildMobilePreview(state) {
    var hasUtil = showUtility && state.utilityEnabled && state.utilityIds.length > 0;

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

  /* ── Option toggles ──────────────────────────────────────── */
  function toggleUtility() {
    showUtility = !showUtility;
    var btn = document.getElementById('opt-utility-bar');
    if (btn) {
      btn.classList.toggle('active', showUtility);
      btn.setAttribute('aria-pressed', String(showUtility));
    }
    render();
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
  }

  /* ── Mega column highlight (UCLA-style hover) ───────────────
     Mouseenter on a nav item with [data-mega-col] → dim all
     columns, brighten the matching one.
     Mouseleave of the whole .site-header--mega → reset.        */
  function initMegaHighlight() {
    var content = document.getElementById('preview-content');
    if (!content) return;

    content.addEventListener('mouseenter', function (e) {
      if (currentTheme !== '2') return;
      var item = e.target && e.target.closest && e.target.closest('.primary-nav__item[data-mega-col]');
      if (!item) return;
      var panel = content.querySelector('.preview-mega-panel');
      if (!panel) return;
      var colIdx = item.getAttribute('data-mega-col');
      panel.classList.add('mega-panel--has-active');
      panel.querySelectorAll('.mega-col').forEach(function (c) { c.classList.remove('mega-col--active'); });
      var col = panel.querySelector('.mega-col[data-mega-col="' + colIdx + '"]');
      if (col) col.classList.add('mega-col--active');
    }, true /* capture so it fires before display:none hides child */);

    content.addEventListener('mouseleave', function (e) {
      if (currentTheme !== '2') return;
      var header = e.target && e.target.closest && e.target.closest('.site-header--mega');
      if (!header) return;
      var panel = content.querySelector('.preview-mega-panel');
      if (!panel) return;
      panel.classList.remove('mega-panel--has-active');
      panel.querySelectorAll('.mega-col').forEach(function (c) { c.classList.remove('mega-col--active'); });
    }, true);
  }

  /* ── Init ────────────────────────────────────────────────── */
  function init() {
    document.querySelectorAll('.vp-btn').forEach(function (btn) {
      btn.addEventListener('click', function () { setViewport(btn.dataset.vp); });
    });

    document.querySelectorAll('.theme-btn').forEach(function (btn) {
      btn.addEventListener('click', function () { setTheme(btn.dataset.theme); });
    });

    var utilBtn = document.getElementById('opt-utility-bar');
    if (utilBtn) utilBtn.addEventListener('click', toggleUtility);

    var siteNameInput = document.getElementById('preview-site-name-input');
    if (siteNameInput) {
      siteNameInput.addEventListener('input', function () {
        siteName = siteNameInput.value || 'Site';
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
