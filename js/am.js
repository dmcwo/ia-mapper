/* ── Architecture Map module ───────────────────────────────────
   Renders the tree, handles drag-and-drop and keyboard move.
   Exposes: window.AM.render(), window.AM.startKeyboardMove(id)
   ─────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  /* ── Module state ────────────────────────────────────────── */
  var collapsedNodes  = {};    // { [id]: true }
  var prevAMIds       = {};    // { [id]: true } — for enter animations

  // Proximity drop line
  var dropLineEl      = null;
  var currentDropTarget = null;

  // Keyboard-move state machine
  var kbMove = null;
  // kbMove = { cardId, positions: [{targetId, position, label}], idx }

  /* ── Announce helper ─────────────────────────────────────── */
  function announce(msg) {
    var el = document.getElementById('sr-announce');
    if (el) { el.textContent = ''; requestAnimationFrame(function () { el.textContent = msg; }); }
  }
  function setStatus(msg) {
    var el = document.getElementById('am-status');
    if (el) el.textContent = msg;
  }

  /* ═══════════════════════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════════════════════ */
  function render() {
    var state    = State.getState();
    var treeEl   = document.getElementById('am-tree');
    var rootDrop = document.getElementById('am-root-drop');
    if (!treeEl) return;

    // Remember focused card
    var focusedId = null;
    var active = document.activeElement;
    if (active && active.dataset && active.dataset.nodeId) focusedId = active.dataset.nodeId;

    treeEl.innerHTML = '';

    if (state.rootIds.length === 0) {
      if (rootDrop) rootDrop.style.display = '';
    } else {
      if (rootDrop) rootDrop.style.display = 'none';
      state.rootIds.forEach(function (id) {
        var node = renderNode(id);
        if (node) treeEl.appendChild(node);
      });
    }

    // Update new-cards set
    var newSet = {};
    state.rootIds.forEach(function (id) { collectIds(id, newSet, state); });
    prevAMIds = newSet;

    // Restore focus
    if (focusedId) {
      var focusEl = treeEl.querySelector('[data-node-id="' + focusedId + '"]');
      if (focusEl) focusEl.focus();
    }

    // Keep keyboard-move highlight if active
    if (kbMove) highlightKbPosition();

    // Feature 8: render utility section
    renderUtility();

    if (window.lucide) lucide.createIcons();
  }

  function collectIds(id, set, state) {
    set[id] = true;
    var c = state.cards[id];
    if (c) c.childIds.forEach(function (cid) { collectIds(cid, set, state); });
  }

  /* ── Render a single tree node (recursive) ───────────────── */
  function renderNode(id) {
    var card = State.getCard(id);
    if (!card || card.location !== 'am') return null;

    var isNew = !prevAMIds[id];

    var node = document.createElement('div');
    node.className = 'tree-node' + (collapsedNodes[id] ? ' is-collapsed' : '') + (isNew ? ' just-dropped' : '');
    node.dataset.nodeId = id;

    node.appendChild(buildAMCard(card));

    // Children
    if (card.childIds.length > 0 && !collapsedNodes[id]) {
      var childrenEl = document.createElement('div');
      childrenEl.className = 'tree-children';
      card.childIds.forEach(function (cid) {
        var childNode = renderNode(cid);
        if (childNode) childrenEl.appendChild(childNode);
      });
      node.appendChild(childrenEl);
    }

    return node;
  }

  /* ── Build AM card element ───────────────────────────────── */
  function buildAMCard(card) {
    var el = document.createElement('div');
    el.className = 'am-card';
    el.setAttribute('draggable', 'true');
    el.setAttribute('tabindex', '0');
    el.setAttribute('role', 'treeitem');
    el.setAttribute('aria-label', card.title + (card.description ? ' — ' + card.description : ''));
    el.dataset.cardId = card.id;
    el.dataset.nodeId = card.id;

    var hasChildren = card.childIds.length > 0;
    var badgeCount  = countDescendants(card.id, State.getState());

    // Feature 5: is-empty on desc text, add-desc-btn
    el.innerHTML =
      '<div class="am-card-header">' +
        '<span class="drag-handle" aria-hidden="true" title="Drag to reposition"><i data-lucide="grip-vertical"></i></span>' +
        '<button class="tree-toggle' + (!hasChildren ? ' tree-toggle--hidden' : '') + (collapsedNodes[card.id] ? ' collapsed' : '') +
          '" tabindex="-1" aria-label="' + (collapsedNodes[card.id] ? 'Expand' : 'Collapse') + ' ' + esc(card.title) + '" aria-expanded="' + (!collapsedNodes[card.id]) + '">' +
          '<i data-lucide="chevron-down"></i>' +
        '</button>' +
        '<div class="card-body">' +
          '<span class="card-title-text">' + esc(card.title) + '</span>' +
          '<input class="card-title-input" type="text" value="' + esc(card.title) + '" aria-label="Title">' +
          '<span class="card-desc-text' + (card.description ? '' : ' is-empty') + '">' + esc(card.description) + '</span>' +
          '<textarea class="card-desc-input" rows="2" aria-label="Description">' + esc(card.description) + '</textarea>' +
          '<button class="add-desc-btn' + (card.description ? ' is-hidden' : '') + '" type="button" aria-label="Add description">+ Add description</button>' +
        '</div>' +
        '<div class="am-card-actions">' +
          '<button class="am-action-btn" data-action="toEB" tabindex="-1" aria-label="Return to Element Box" title="Return to Element Box (B)"><i data-lucide="corner-up-left"></i></button>' +
          '<button class="am-action-btn am-action-btn--danger" data-action="delete" tabindex="-1" aria-label="Delete ' + esc(card.title) + '" title="Delete (Del)"><i data-lucide="x"></i></button>' +
        '</div>' +
      '</div>' +
      (collapsedNodes[card.id] && badgeCount > 0
        ? '<span class="collapsed-badge">' + badgeCount + ' item' + (badgeCount !== 1 ? 's' : '') + ' hidden</span>'
        : '') +
      (card.nestedIds.length > 0 ? buildNestedArea(card) : '');

    attachAMCardEvents(el, card.id);
    return el;
  }

  /* ── Recursive nested-area builder ──────────────────────── */
  function buildNestedCard(nc) {
    var isNew = !prevAMIds[nc.id];
    // Feature 5: is-empty on desc text, add-desc-btn
    return '<div class="am-card is-nested' + (isNew ? ' just-dropped' : '') + '" draggable="true" tabindex="0" role="treeitem"' +
        ' data-card-id="' + nc.id + '" data-node-id="' + nc.id + '"' +
        ' aria-label="' + esc(nc.title) + ' — nested element">' +
        '<div class="am-card-header">' +
          '<span class="drag-handle" aria-hidden="true" title="Drag to reposition"><i data-lucide="grip-vertical"></i></span>' +
          '<div class="card-body">' +
            '<span class="card-title-text">' + esc(nc.title) + '</span>' +
            '<input class="card-title-input" type="text" value="' + esc(nc.title) + '" aria-label="Title">' +
            '<span class="card-desc-text' + (nc.description ? '' : ' is-empty') + '">' + esc(nc.description) + '</span>' +
            '<textarea class="card-desc-input" rows="2" aria-label="Description">' + esc(nc.description) + '</textarea>' +
            '<button class="add-desc-btn' + (nc.description ? ' is-hidden' : '') + '" type="button" aria-label="Add description">+ Add description</button>' +
          '</div>' +
          '<div class="am-card-actions">' +
            '<button class="am-action-btn" data-action="toEB" tabindex="-1" aria-label="Return to Element Box" title="Return to Element Box (B)"><i data-lucide="corner-up-left"></i></button>' +
            '<button class="am-action-btn am-action-btn--danger" data-action="delete" tabindex="-1" aria-label="Delete ' + esc(nc.title) + '" title="Delete (Del)"><i data-lucide="x"></i></button>' +
          '</div>' +
        '</div>' +
        (nc.nestedIds.length > 0 ? buildNestedArea(nc) : '') +
      '</div>';
  }

  function buildNestedArea(card) {
    var html = '<div class="nested-cards">';
    card.nestedIds.forEach(function (nid) {
      var nc = State.getCard(nid);
      if (nc) html += buildNestedCard(nc);
    });
    html += '</div>';
    return html;
  }

  /* ═══════════════════════════════════════════════════════════
     FEATURE 8 — UTILITY MENU RENDER
  ═══════════════════════════════════════════════════════════ */
  function renderUtility() {
    var state = State.getState();
    var zoneEl = document.getElementById('am-zone-utility');
    var addBtn = document.getElementById('add-utility-btn');
    var utilityTreeEl = document.getElementById('am-utility-tree');
    var utilityRootDrop = document.getElementById('am-utility-root-drop');

    if (!zoneEl || !addBtn) return;

    if (state.utilityEnabled) {
      zoneEl.removeAttribute('hidden');
      zoneEl.removeAttribute('aria-hidden');
      addBtn.setAttribute('hidden', '');
    } else {
      zoneEl.setAttribute('hidden', '');
      zoneEl.setAttribute('aria-hidden', 'true');
      addBtn.removeAttribute('hidden');
    }

    if (!utilityTreeEl) return;
    utilityTreeEl.innerHTML = '';

    if (!state.utilityEnabled) return;

    if (state.utilityIds.length === 0) {
      if (utilityRootDrop) utilityRootDrop.style.display = '';
    } else {
      if (utilityRootDrop) utilityRootDrop.style.display = 'none';
      state.utilityIds.forEach(function (id) {
        var node = renderNode(id);
        if (node) utilityTreeEl.appendChild(node);
      });
    }
  }

  /* ═══════════════════════════════════════════════════════════
     PROXIMITY DROP LINE
  ═══════════════════════════════════════════════════════════ */

  function initDropLine(canvas) {
    dropLineEl = document.createElement('div');
    dropLineEl.className = 'am-drop-line';
    dropLineEl.setAttribute('aria-hidden', 'true');
    dropLineEl.style.display = 'none';
    canvas.appendChild(dropLineEl);
  }

  /**
   * Given a dragover event, compute which card and position the cursor implies.
   * Returns { targetId, position, zone } where position is 'before'|'after'|'child'|'nest'|'root'
   * and zone is 'main' or 'utility'.
   */
  function computeDropTarget(e, canvas) {
    var draggingId = document.body.dataset.draggingId;
    var state = State.getState();

    // Target only non-nested page cards; skip the card being dragged
    var mainCards = Array.from(document.querySelectorAll('#am-tree .am-card:not(.is-nested)'));
    var utilityCards = state.utilityEnabled
      ? Array.from(document.querySelectorAll('#am-utility-tree .am-card:not(.is-nested)'))
      : [];

    if (draggingId) {
      mainCards = mainCards.filter(function (c) { return c.dataset.cardId !== draggingId; });
      utilityCards = utilityCards.filter(function (c) { return c.dataset.cardId !== draggingId; });
    }

    var allCards = mainCards.map(function (c) { return { el: c, zone: 'main' }; })
      .concat(utilityCards.map(function (c) { return { el: c, zone: 'utility' }; }));

    if (allCards.length === 0) {
      return { targetId: null, position: 'root', zone: 'main' };
    }

    var cy = e.clientY;
    var cx = e.clientX;
    var draggingCard = draggingId ? State.getCard(draggingId) : null;

    for (var i = 0; i < allCards.length; i++) {
      var r = allCards[i].el.getBoundingClientRect();
      var cardId = allCards[i].el.dataset.cardId;
      var zone = allCards[i].zone;

      // Extend hit area by 6px above/below to bridge the gap between cards.
      // Also require horizontal proximity so left-column (main) cards don't
      // capture drags that are over the right-column (utility) zone.
      if (cy < r.top - 6 || cy > r.bottom + 6) continue;
      if (cx < r.left - 20 || cx > r.right + 20) continue;

      var relY = (cy - r.top) / r.height;

      if (relY < 0.33) {
        return { targetId: cardId, position: 'before', zone: zone };

      } else if (relY > 0.67) {
        var relX = (cx - r.left) / r.width;
        return { targetId: cardId, position: relX > 0.6 ? 'child' : 'after', zone: zone };

      } else {
        // Middle zone — nest if allowed
        var targetCard = State.getCard(cardId);
        var canNest = targetCard && targetCard.location === 'am' &&
                      draggingCard && draggingCard.location !== 'nested';
        return { targetId: cardId, position: canNest ? 'nest' : 'after', zone: zone };
      }
    }

    // Cursor is outside all card bounds — snap to nearest end
    if (cy < allCards[0].el.getBoundingClientRect().top) {
      return { targetId: allCards[0].el.dataset.cardId, position: 'before', zone: allCards[0].zone };
    }
    var lastEntry = allCards[allCards.length - 1];
    return { targetId: lastEntry.el.dataset.cardId, position: 'after', zone: lastEntry.zone };
  }

  /**
   * Position and show the drop line, or highlight a card for nest.
   * `target` = { targetId, position, zone } from computeDropTarget.
   */
  function showDropLine(target) {
    // Clear any nest highlight first
    document.querySelectorAll('.am-card.drop-nest-target').forEach(function (c) {
      c.classList.remove('drop-nest-target');
    });

    if (!target) {
      if (dropLineEl) dropLineEl.style.display = 'none';
      return;
    }

    currentDropTarget = target;

    // Root: no line (root drop zone element handles visual)
    if (!target.targetId || target.position === 'root') {
      if (dropLineEl) dropLineEl.style.display = 'none';
      return;
    }

    // Nest: highlight the host card instead of drawing a line
    if (target.position === 'nest') {
      if (dropLineEl) dropLineEl.style.display = 'none';
      var nestCard = document.querySelector(
        '.am-card:not(.is-nested)[data-card-id="' + target.targetId + '"]');
      if (nestCard) nestCard.classList.add('drop-nest-target');
      return;
    }

    // Before / after / child: draw the line
    var canvas = document.getElementById('am-canvas');
    if (!canvas || !dropLineEl) return;

    var cardEl = document.querySelector(
      '.am-card:not(.is-nested)[data-card-id="' + target.targetId + '"]');
    if (!cardEl) { dropLineEl.style.display = 'none'; return; }

    var r          = cardEl.getBoundingClientRect();
    var canvasRect = canvas.getBoundingClientRect();
    var scrollTop  = canvas.scrollTop;
    var scrollLeft = canvas.scrollLeft;

    var lineLeft  = r.left - canvasRect.left + scrollLeft;
    var lineWidth = r.width;
    var lineTop;

    if (target.position === 'before') {
      lineTop = r.top - canvasRect.top + scrollTop - 3;

    } else if (target.position === 'after') {
      lineTop = r.bottom - canvasRect.top + scrollTop + 3;

    } else { // child
      lineTop   = r.bottom - canvasRect.top + scrollTop + 3;
      lineLeft += 40;
      lineWidth  = Math.max(120, lineWidth - 40);
    }

    dropLineEl.style.top     = lineTop  + 'px';
    dropLineEl.style.left    = lineLeft + 'px';
    dropLineEl.style.width   = lineWidth + 'px';
    dropLineEl.style.display = 'block';
  }

  function hideDropLine() {
    if (dropLineEl) dropLineEl.style.display = 'none';
    document.querySelectorAll('.am-card.drop-nest-target').forEach(function (c) {
      c.classList.remove('drop-nest-target');
    });
    currentDropTarget = null;
  }

  function getDropLabel(target) {
    if (!target) return '';
    if (!target.targetId || target.position === 'root') return 'Add as top-level page';
    var card = State.getCard(target.targetId);
    var name = card ? '"' + card.title + '"' : '';
    if (target.position === 'before') return '↑ Sibling above ' + name;
    if (target.position === 'after')  return '↓ Sibling below ' + name;
    if (target.position === 'child')  return '→ Child of '       + name;
    if (target.position === 'nest')   return '⬇ Nest inside '   + name;
    return '';
  }

  /* ── AM card events ──────────────────────────────────────── */
  function attachAMCardEvents(el, id) {
    var titleText  = el.querySelector('.card-title-text');
    var titleInput = el.querySelector('.card-title-input');
    var descText   = el.querySelector('.card-desc-text');
    var descInput  = el.querySelector('.card-desc-input');
    var addDescBtn = el.querySelector('.add-desc-btn');
    var toggleBtn  = el.querySelector('.tree-toggle');

    /* Inline title edit */
    function startTitleEdit() {
      titleText.classList.add('hidden');
      titleInput.classList.add('active');
      titleInput.focus(); titleInput.select();
    }
    function commitTitle() {
      var val = titleInput.value.trim() || 'Untitled';
      titleText.classList.remove('hidden'); titleInput.classList.remove('active');
      State.updateCard(id, { title: val });
    }
    titleText.addEventListener('click', function (e) { e.stopPropagation(); startTitleEdit(); });
    titleInput.addEventListener('blur', commitTitle);
    titleInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); commitTitle(); el.focus(); }
      if (e.key === 'Escape') { titleInput.value = State.getCard(id).title; commitTitle(); el.focus(); }
      e.stopPropagation();
    });

    /* Inline desc edit */
    if (descText && descInput) {
      function startDescEdit() {
        descText.classList.add('hidden'); descInput.classList.add('active');
        descInput.focus(); autoResize(descInput);
      }
      function commitDesc() {
        var val = descInput.value.trim();
        descText.classList.remove('hidden'); descInput.classList.remove('active');
        State.updateCard(id, { description: val });
        // Feature 5: toggle empty state
        if (val) {
          descText.classList.remove('is-empty');
          if (addDescBtn) addDescBtn.classList.add('is-hidden');
        } else {
          descText.classList.add('is-empty');
          if (addDescBtn) addDescBtn.classList.remove('is-hidden');
        }
      }
      descText.addEventListener('click', function (e) { e.stopPropagation(); startDescEdit(); });
      descInput.addEventListener('blur', commitDesc);
      descInput.addEventListener('input', function () { autoResize(descInput); });
      descInput.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') { commitDesc(); el.focus(); }
        e.stopPropagation();
      });

      // Feature 5: add-desc-btn
      if (addDescBtn) {
        addDescBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          startDescEdit();
        });
      }
    }

    /* Toggle collapse */
    if (toggleBtn) {
      toggleBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        var card = State.getCard(id);
        if (!card || !card.childIds.length) return;
        if (collapsedNodes[id]) { delete collapsedNodes[id]; } else { collapsedNodes[id] = true; }
        render();
        announce((collapsedNodes[id] ? 'Collapsed ' : 'Expanded ') + card.title);
      });
    }

    /* Action buttons */
    el.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-action]');
      if (!btn) return;
      var action = btn.dataset.action;
      var card = State.getCard(id);
      if (action === 'edit') { e.stopPropagation(); startTitleEdit(); }
      if (action === 'toEB') {
        e.stopPropagation();
        State.moveToEB(id);
        announce((card ? card.title : 'Card') + ' returned to Element Box.');
      }
      if (action === 'delete') { e.stopPropagation(); confirmDeleteAM(id, el); }
    });

    /* Keyboard shortcuts on focused card */
    el.addEventListener('keydown', function (e) {
      if (e.target !== el) return;
      var card = State.getCard(id);
      if (!card) return;

      if (e.key === 'E' || e.key === 'e') { e.preventDefault(); startTitleEdit(); }
      if (e.key === 'Delete') { e.preventDefault(); confirmDeleteAM(id, el); }
      if (e.key === 'B' || e.key === 'b') { e.preventDefault(); State.moveToEB(id); announce(card.title + ' returned to Element Box.'); }
      if (e.key === 'M' || e.key === 'm') { e.preventDefault(); startKeyboardMove(id); }

      // Tree navigation
      if (e.key === 'ArrowDown') { e.preventDefault(); focusNextAMCard(el, 1); }
      if (e.key === 'ArrowUp')   { e.preventDefault(); focusNextAMCard(el, -1); }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (collapsedNodes[id] && card.childIds.length) { delete collapsedNodes[id]; render(); }
        else {
          var treeNode = el.closest('.tree-node');
          var first = treeNode && treeNode.querySelector('.tree-children .am-card');
          if (first) first.focus();
        }
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (!collapsedNodes[id] && card.childIds.length) { collapsedNodes[id] = true; render(); }
        else {
          var parentNode = el.closest('.tree-children');
          if (parentNode) {
            var parentCard = parentNode.previousElementSibling;
            if (parentCard && parentCard.classList.contains('am-card')) parentCard.focus();
          }
        }
      }
      if (e.key === 'Home') {
        e.preventDefault();
        var allCards = Array.from(document.querySelectorAll('#am-canvas .am-card'));
        if (allCards[0]) allCards[0].focus();
      }
      if (e.key === 'End') {
        e.preventDefault();
        var allCards = Array.from(document.querySelectorAll('#am-canvas .am-card'));
        if (allCards.length) allCards[allCards.length - 1].focus();
      }

      // Keyboard move: if in move mode and this card gets Space/Enter, confirm drop
      if (kbMove && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); confirmKbDrop(id); }
      if (kbMove && e.key === 'Escape') { e.preventDefault(); cancelKbMove(); }
    });

    /* Drag & drop */
    el.addEventListener('dragstart', function (e) {
      e.dataTransfer.setData('text/plain', id);
      e.dataTransfer.effectAllowed = 'move';
      document.body.dataset.draggingId = id;
      document.body.classList.add('is-dragging');
      requestAnimationFrame(function () { el.classList.add('dragging'); });
      e.stopPropagation();
    });
    el.addEventListener('dragend', function () {
      el.classList.remove('dragging');
      document.body.classList.remove('is-dragging');
      delete document.body.dataset.draggingId;
      hideDropLine();
      if (!kbMove) setStatus('');
    });

    // Nested cards
    el.querySelectorAll('.am-card.is-nested').forEach(function (nc) {
      var nid = nc.dataset.cardId;
      if (!nid) return;

      nc.addEventListener('dragstart', function (e) {
        e.dataTransfer.setData('text/plain', nid);
        e.dataTransfer.effectAllowed = 'move';
        document.body.dataset.draggingId = nid;
        document.body.classList.add('is-dragging');
        requestAnimationFrame(function () { nc.classList.add('dragging'); });
        e.stopPropagation();
      });
      nc.addEventListener('dragend', function () {
        nc.classList.remove('dragging');
        document.body.classList.remove('is-dragging');
        delete document.body.dataset.draggingId;
        hideDropLine();
      });

      nc.addEventListener('keydown', function (e) {
        if (e.target !== nc) return;
        var ncard = State.getCard(nid);
        if (e.key === 'B' || e.key === 'b') { e.preventDefault(); State.moveToEB(nid); announce((ncard ? ncard.title : 'Card') + ' returned to Element Box.'); }
        if (e.key === 'Delete') { e.preventDefault(); confirmDeleteAM(nid, nc); }
        if (e.key === 'M' || e.key === 'm') { e.preventDefault(); startKeyboardMove(nid); }
        var titleT = nc.querySelector('.card-title-text');
        var titleI = nc.querySelector('.card-title-input');
        if (e.key === 'E' || e.key === 'e') {
          e.preventDefault();
          titleT.classList.add('hidden'); titleI.classList.add('active'); titleI.focus(); titleI.select();
        }
        titleI.addEventListener('blur', function () {
          var val = titleI.value.trim() || 'Untitled';
          titleT.classList.remove('hidden'); titleI.classList.remove('active');
          State.updateCard(nid, { title: val });
        });
        titleI.addEventListener('keydown', function (ev) {
          if (ev.key === 'Enter') { ev.preventDefault(); titleI.blur(); nc.focus(); }
          if (ev.key === 'Escape') { titleI.value = State.getCard(nid).title; titleI.blur(); nc.focus(); }
          ev.stopPropagation();
        });
      });

      nc.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-action]');
        if (!btn) return;
        e.stopPropagation();
        var ncard = State.getCard(nid);
        if (btn.dataset.action === 'toEB') { State.moveToEB(nid); announce((ncard ? ncard.title : 'Card') + ' returned to Element Box.'); }
        if (btn.dataset.action === 'delete') { confirmDeleteAM(nid, nc); }
      });

      // Feature 5: add-desc-btn for nested cards (inline, no re-render needed since nc is HTML string)
      var ncAddDescBtn = nc.querySelector('.add-desc-btn');
      var ncDescText = nc.querySelector('.card-desc-text');
      var ncDescInput = nc.querySelector('.card-desc-input');
      if (ncAddDescBtn && ncDescText && ncDescInput) {
        ncAddDescBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          ncDescText.classList.add('hidden'); ncDescInput.classList.add('active');
          ncDescInput.focus();
        });
      }
    });
  }

  /* ── Delete confirmation (AM) ────────────────────────────── */
  function confirmDeleteAM(id, el) {
    var card = State.getCard(id);
    if (!card) return;
    var dialog    = document.getElementById('confirm-dialog');
    var msg       = document.getElementById('confirm-msg');
    var okBtn     = document.getElementById('confirm-ok');
    var cancelBtn = document.getElementById('confirm-cancel');

    document.getElementById('confirm-title').textContent = 'Delete "' + card.title + '"?';
    var descendants = card.childIds.length + card.nestedIds.length;
    msg.textContent = descendants > 0
      ? descendants + ' child/nested item' + (descendants !== 1 ? 's' : '') + ' will be returned to the Element Box.'
      : 'This card will be permanently removed.';

    dialog.showModal();
    function cleanup() { okBtn.removeEventListener('click', onOk); cancelBtn.removeEventListener('click', onCancel); }
    function onOk() {
      cleanup(); dialog.close();
      State.deleteCard(id);
      announce('Deleted ' + card.title + '. Any children returned to Element Box.');
    }
    function onCancel() { cleanup(); dialog.close(); if (el) el.focus(); }
    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
    dialog.addEventListener('cancel', onCancel, { once: true });
  }

  /* ═══════════════════════════════════════════════════════════
     DRAG & DROP (proximity-based, canvas-level)
  ═══════════════════════════════════════════════════════════ */
  function initDragDrop() {
    var canvas = document.getElementById('am-canvas');
    initDropLine(canvas);

    // Capture dragged card ID from any dragstart (AM or EB cards)
    document.addEventListener('dragstart', function (e) {
      var cardEl = e.target.closest('[data-card-id]');
      if (cardEl) document.body.dataset.draggingId = cardEl.dataset.cardId;
    }, true);

    // Global cleanup when any drag ends
    document.addEventListener('dragend', function () {
      hideDropLine();
      document.body.classList.remove('is-dragging');
      delete document.body.dataset.draggingId;
      if (!kbMove) setStatus('');
    });

    // Main root drop zone — explicit handler so canvas dragover can proceed to
    // computeDropTarget even when the main tree is empty but utility has items.
    var mainRootDrop = document.getElementById('am-root-drop');
    if (mainRootDrop) {
      mainRootDrop.addEventListener('dragover', function (e) {
        e.preventDefault(); e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';
        mainRootDrop.classList.add('drag-over');
        currentDropTarget = { targetId: null, position: 'root', zone: 'main' };
        if (!kbMove) setStatus('Add as top-level page');
      });
      mainRootDrop.addEventListener('dragleave', function (e) {
        if (!mainRootDrop.contains(e.relatedTarget)) mainRootDrop.classList.remove('drag-over');
      });
      mainRootDrop.addEventListener('drop', function (e) {
        e.preventDefault(); e.stopPropagation();
        mainRootDrop.classList.remove('drag-over');
        var cardId = e.dataTransfer.getData('text/plain');
        if (!cardId) return;
        var card = State.getCard(cardId);
        if (!card) return;
        State.moveToAM(cardId, null, null);
        announce(card.title + ' added to Architecture Map.');
        if (!kbMove) setStatus('');
      });
    }

    canvas.addEventListener('dragover', function (e) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';

      var rootDrop = document.getElementById('am-root-drop');
      var state    = State.getState();

      // Completely empty canvas — fallback in case root drop zone doesn't capture the event
      if (state.rootIds.length === 0 && state.utilityIds.length === 0) {
        currentDropTarget = { targetId: null, position: 'root', zone: 'main' };
        if (!kbMove) setStatus('Add as top-level page');
        return;
      }
      if (rootDrop) rootDrop.classList.remove('drag-over');

      var target = computeDropTarget(e, canvas);
      showDropLine(target);
      if (!kbMove) setStatus(getDropLabel(target));
    });

    canvas.addEventListener('dragleave', function (e) {
      if (!canvas.contains(e.relatedTarget)) {
        hideDropLine();
        var rootDrop = document.getElementById('am-root-drop');
        if (rootDrop) rootDrop.classList.remove('drag-over');
        if (!kbMove) setStatus('');
      }
    });

    canvas.addEventListener('drop', function (e) {
      e.preventDefault();
      var cardId = e.dataTransfer.getData('text/plain');
      var target = currentDropTarget;
      hideDropLine();
      document.body.classList.remove('is-dragging');
      delete document.body.dataset.draggingId;
      var rootDrop = document.getElementById('am-root-drop');
      if (rootDrop) rootDrop.classList.remove('drag-over');
      if (!kbMove) setStatus('');

      if (!cardId) return;
      var card = State.getCard(cardId);
      if (!card) return;

      // Feature 8: use zone to call correct move function
      var moveFn = (target && target.zone === 'utility') ? State.moveToUtility : State.moveToAM;

      if (!target || !target.targetId || target.position === 'root') {
        State.moveToAM(cardId, null, null);
        announce(card.title + ' added to Architecture Map as a top-level page.');
      } else {
        moveFn(cardId, target.targetId, target.position);
        var targetCard = State.getCard(target.targetId);
        var msg = card.title + ' moved';
        if (targetCard) {
          if (target.position === 'child') msg += ' as child of ' + targetCard.title;
          else if (target.position === 'nest') msg += ' nested inside ' + targetCard.title;
          else msg += ' as sibling of ' + targetCard.title;
        }
        announce(msg + '.');
      }
    });

    // Feature 8: utility root drop zone
    var utilityRootDrop = document.getElementById('am-utility-root-drop');
    if (utilityRootDrop) {
      utilityRootDrop.addEventListener('dragover', function (e) {
        e.preventDefault(); e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';
        utilityRootDrop.classList.add('drag-over');
        currentDropTarget = { targetId: null, position: 'root', zone: 'utility' };
        if (!kbMove) setStatus('Add as utility menu item');
      });
      utilityRootDrop.addEventListener('dragleave', function (e) {
        if (!utilityRootDrop.contains(e.relatedTarget)) {
          utilityRootDrop.classList.remove('drag-over');
        }
      });
      utilityRootDrop.addEventListener('drop', function (e) {
        e.preventDefault(); e.stopPropagation();
        utilityRootDrop.classList.remove('drag-over');
        var cardId = e.dataTransfer.getData('text/plain');
        if (!cardId) return;
        var card = State.getCard(cardId);
        if (!card) return;
        State.moveToUtility(cardId, null, null);
        announce(card.title + ' added to Utility Menu.');
        if (!kbMove) setStatus('');
      });
    }
  }

  /* ═══════════════════════════════════════════════════════════
     KEYBOARD MOVE MODE
  ═══════════════════════════════════════════════════════════ */
  function startKeyboardMove(id) {
    var card = State.getCard(id);
    if (!card) return;

    var positions = buildPositionsList(id);
    if (positions.length === 0) {
      announce('No valid positions found. Add more cards to the Architecture Map first.');
      return;
    }

    var startIdx = findCurrentIdx(id, positions, State.getState());
    kbMove = { cardId: id, positions: positions, idx: startIdx };
    document.body.classList.add('is-kb-moving');
    highlightKbPosition();

    var cardEl = document.querySelector('[data-node-id="' + id + '"]');
    if (cardEl) cardEl.classList.add('kb-moving');

    var startLabel = positions[startIdx].label;
    var descendantCount = countDescendants(id, State.getState());
    var scopeNote = descendantCount > 0
      ? ' (moving with ' + descendantCount + ' child' + (descendantCount !== 1 ? 'ren' : '') + ' — positions outside subtree only)'
      : '';
    setStatus('Moving "' + card.title + '"' + scopeNote + ' — ' + startLabel +
      ' (' + (startIdx + 1) + '/' + positions.length + ') · ↑↓ to change · Enter to confirm · Esc to cancel');
    announce('Moving "' + card.title + '"' + (descendantCount > 0 ? ' with ' + descendantCount + ' children' : '') +
      '. Currently ' + startLabel + '. ' + positions.length + ' positions available. Use arrow keys to change, Enter to confirm, Escape to cancel.');

    document.addEventListener('keydown', onKbMoveKey);
  }

  function onKbMoveKey(e) {
    if (!kbMove) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      var nextIdx = (kbMove.idx + 1) % kbMove.positions.length;
      var wrapped = nextIdx < kbMove.idx;
      kbMove.idx = nextIdx;
      highlightKbPosition();
      if (wrapped) announce('Cycled through all ' + kbMove.positions.length + ' positions — back at beginning.');
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      var prevIdx = (kbMove.idx - 1 + kbMove.positions.length) % kbMove.positions.length;
      var wrappedUp = prevIdx > kbMove.idx;
      kbMove.idx = prevIdx;
      highlightKbPosition();
      if (wrappedUp) announce('Cycled through all ' + kbMove.positions.length + ' positions — back at end.');
    }
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); commitKbMove(); }
    if (e.key === 'Escape')    { e.preventDefault(); cancelKbMove(); }
  }

  function highlightKbPosition() {
    hideDropLine();
    var state    = State.getState();
    var rootDrop = document.getElementById('am-root-drop');

    if (rootDrop && state.rootIds.length > 0) {
      rootDrop.style.display = 'none';
      rootDrop.classList.remove('kb-highlight', 'drag-over');
    }

    if (!kbMove) return;
    var pos = kbMove.positions[kbMove.idx];

    if (pos.position === 'root') {
      if (rootDrop) {
        rootDrop.style.display = '';
        rootDrop.classList.add('kb-highlight', 'drag-over');
      }
    } else {
      showDropLine({ targetId: pos.targetId, position: pos.position });
      // Scroll drop line into view if it's a positional line
      if (dropLineEl && dropLineEl.style.display !== 'none') {
        dropLineEl.scrollIntoView({ block: 'nearest' });
      } else {
        // For nest targets, scroll the card into view
        var nestCard = document.querySelector('.am-card.drop-nest-target');
        if (nestCard) nestCard.scrollIntoView({ block: 'nearest' });
      }
    }

    var movingCard = State.getCard(kbMove.cardId);
    var descCount  = movingCard ? countDescendants(kbMove.cardId, State.getState()) : 0;
    var scopeHint  = descCount > 0 ? ' [' + descCount + ' child' + (descCount !== 1 ? 'ren' : '') + ' move with it]' : '';
    setStatus('Moving "' + (movingCard ? movingCard.title : '') + '"' + scopeHint + ' — ' +
      pos.label + ' (' + (kbMove.idx + 1) + '/' + kbMove.positions.length + ') · ↑↓ to change · Enter to confirm · Esc to cancel');
  }

  function commitKbMove() {
    if (!kbMove) return;
    var pos    = kbMove.positions[kbMove.idx];
    var cardId = kbMove.cardId;
    var card   = State.getCard(cardId);
    cancelKbMove();
    var moveFn = (pos.zone === 'utility') ? State.moveToUtility : State.moveToAM;
    if (pos.position === 'root') {
      State.moveToAM(cardId, null, null);
    } else {
      moveFn(cardId, pos.targetId, pos.position);
    }
    announce((card ? card.title : 'Card') + ' moved: ' + pos.label + '.');
  }

  function confirmKbDrop(targetCardId) {
    // Called when user presses Enter on an AM card while in kbMove mode
    if (!kbMove) return;
    var cardId = kbMove.cardId;
    var card   = State.getCard(cardId);
    cancelKbMove();
    var moveFn = isInUtilityZone(targetCardId, State.getState()) ? State.moveToUtility : State.moveToAM;
    moveFn(cardId, targetCardId, 'child');
    announce((card ? card.title : 'Card') + ' placed as child of ' + ((State.getCard(targetCardId) || {}).title || '') + '.');
  }

  function isInUtilityZone(id, state) {
    var card = state.cards[id];
    while (card) {
      if (state.utilityIds.indexOf(card.id) !== -1) return true;
      if (!card.parentId) return false;
      card = state.cards[card.parentId];
    }
    return false;
  }

  function cancelKbMove() {
    document.removeEventListener('keydown', onKbMoveKey);
    document.body.classList.remove('is-kb-moving');
    hideDropLine();
    var rootDrop = document.getElementById('am-root-drop');
    if (rootDrop) {
      rootDrop.classList.remove('kb-highlight', 'drag-over');
      if (State.getState().rootIds.length > 0) rootDrop.style.display = 'none';
    }
    if (kbMove) {
      var cardEl = document.querySelector('[data-node-id="' + kbMove.cardId + '"]');
      if (cardEl) cardEl.classList.remove('kb-moving');
    }
    kbMove = null;
    setStatus('');
  }

  /* Count all descendants (children + nested, recursively) of a card */
  function countDescendants(id, state) {
    var card = state.cards[id];
    if (!card) return 0;
    var count = card.childIds.length + card.nestedIds.length;
    card.childIds.forEach(function (cid) { count += countDescendants(cid, state); });
    card.nestedIds.forEach(function (nid) { count += countDescendants(nid, state); });
    return count;
  }

  /* Build an ordered list of valid drop positions for a card */
  function buildPositionsList(movingId) {
    var state   = State.getState();
    var rawList = [];

    // Tree positions first (relative moves near current location)
    state.rootIds.forEach(function (id) {
      addPositionsForNode(id, movingId, rawList, state, 'main');
    });

    // Feature 8: include utility zone positions when enabled
    if (state.utilityEnabled) {
      state.utilityIds.forEach(function (id) {
        addPositionsForNode(id, movingId, rawList, state, 'utility');
      });
    }

    // 'root' goes last — it's a drastic cross-hierarchy move, rarely the intent
    rawList.push({ targetId: '', position: 'root', zone: 'main', label: 'Add as top-level page' });

    return dedupePositions(rawList, state);
  }

  /**
   * Find the index in `positions` that represents where the card currently IS.
   */
  function findCurrentIdx(movingId, positions, state) {
    var card = state.cards[movingId];
    if (!card || card.location !== 'am') return 0;

    var searchTarget, searchPos;

    if (!card.parentId) {
      // Root-level card (main or utility)
      var rootIdx = state.rootIds.indexOf(movingId);
      var utilIdx = state.utilityIds.indexOf(movingId);
      var siblingList = rootIdx !== -1 ? state.rootIds : state.utilityIds;
      var sibIdx = rootIdx !== -1 ? rootIdx : utilIdx;

      if (sibIdx > 0) {
        searchTarget = siblingList[sibIdx - 1];
        searchPos    = 'after';
      } else {
        searchTarget = '';
        searchPos    = 'root';
      }
    } else {
      // Child card
      var parent  = state.cards[card.parentId];
      var childSibIdx  = parent ? parent.childIds.indexOf(movingId) : -1;
      if (childSibIdx === 0) {
        searchTarget = card.parentId;
        searchPos    = 'child';
      } else if (childSibIdx > 0) {
        searchTarget = parent.childIds[childSibIdx - 1];
        searchPos    = 'after';
      }
    }

    if (searchTarget !== undefined) {
      for (var i = 0; i < positions.length; i++) {
        if (positions[i].targetId === searchTarget && positions[i].position === searchPos) {
          return i;
        }
      }
    }

    return 0;
  }

  /**
   * Remove semantically duplicate positions.
   */
  function dedupePositions(positions, state) {
    var seen        = {};  // 'targetId::position' → true
    var afterSeen   = {};  // targetId → true, for cards with an 'after' already added
    var result      = [];

    for (var i = 0; i < positions.length; i++) {
      var p   = positions[i];
      var key = (p.targetId || '') + '::' + p.position;

      // Skip exact duplicates
      if (seen[key]) continue;

      // Skip 'before X' when 'after prev(X)' is already in the list
      if (p.position === 'before' && p.targetId) {
        var card = state.cards[p.targetId];
        if (card) {
          var siblings = card.parentId
            ? ((state.cards[card.parentId] || {}).childIds || [])
            : (state.utilityIds.indexOf(p.targetId) !== -1 ? state.utilityIds : state.rootIds);
          var idx = siblings.indexOf(p.targetId);
          if (idx > 0 && afterSeen[siblings[idx - 1]]) continue;
        }
      }

      seen[key] = true;
      if (p.position === 'after' && p.targetId) afterSeen[p.targetId] = true;
      result.push(p);
    }

    return result;
  }

  function addPositionsForNode(id, movingId, positions, state, zone) {
    if (id === movingId) return;
    var card = state.cards[id];
    if (!card || card.location !== 'am') return;

    var movingCard = state.cards[movingId];

    positions.push({ targetId: id, position: 'before', zone: zone, label: 'Before "'  + card.title + '"' });
    positions.push({ targetId: id, position: 'child',  zone: zone, label: 'Child of "' + card.title + '"' });
    positions.push({ targetId: id, position: 'after',  zone: zone, label: 'After "'    + card.title + '"' });

    if (card.parentId) {
      var parentCard = state.cards[card.parentId];
      positions.push({ targetId: card.parentId, position: 'after', zone: zone,
        label: 'Promote up — sibling after "' + (parentCard ? parentCard.title : 'parent') + '"' });
    }

    if (movingCard && movingCard.location !== 'nested') {
      positions.push({ targetId: id, position: 'nest', zone: zone, label: 'Nest inside "' + card.title + '" as element' });
    }

    if (!collapsedNodes[id]) {
      card.childIds.forEach(function (cid) {
        addPositionsForNode(cid, movingId, positions, state, zone);
      });
    }
  }

  /* ── Navigate between visible AM cards ───────────────────── */
  function focusNextAMCard(el, dir) {
    var cards = Array.from(document.querySelectorAll('#am-canvas .am-card'));
    var idx   = cards.indexOf(el);
    var next  = cards[idx + dir];
    if (next) next.focus();
  }

  /* ── Helpers ─────────────────────────────────────────────── */
  function autoResize(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
  }

  function esc(str) {
    return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  /* ── Init ────────────────────────────────────────────────── */
  function init() {
    initDragDrop();

    // Card controls visibility toggle
    var controlsBtn = document.getElementById('am-controls-btn');
    if (controlsBtn) {
      controlsBtn.addEventListener('click', function () {
        var canvas = document.getElementById('am-canvas');
        var active = canvas.classList.toggle('am-show-controls');
        controlsBtn.setAttribute('aria-pressed', String(active));
        controlsBtn.setAttribute('aria-label', active ? 'Hide card controls' : 'Show card controls');
      });
    }

    // Feature 8: wire utility toggle buttons
    var addUtilityBtn = document.getElementById('add-utility-btn');
    if (addUtilityBtn) {
      addUtilityBtn.addEventListener('click', function () {
        State.toggleUtility();
      });
    }

    var utilityRemoveBtn = document.getElementById('utility-remove-btn');
    if (utilityRemoveBtn) {
      utilityRemoveBtn.addEventListener('click', function () {
        var state = State.getState();
        var hasCards = state.utilityIds.length > 0;
        var msg = hasCards
          ? 'Remove the Utility Menu? The ' + state.utilityIds.length + ' item(s) will remain in the Architecture Map but the section will be hidden.'
          : 'Remove the Utility Menu section?';
        if (window.confirm(msg)) {
          State.toggleUtility();
        }
      });
    }

    // When the canvas itself receives keyboard focus (via Tab), forward to first card.
    var canvas = document.getElementById('am-canvas');
    if (canvas) {
      canvas.addEventListener('focus', function (e) {
        if (e.relatedTarget && canvas.contains(e.relatedTarget)) return;
        var first = canvas.querySelector('.am-card');
        if (first) {
          first.focus();
        }
      });

      canvas.addEventListener('keydown', function (e) {
        if (e.target !== canvas) return;
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          var cards = canvas.querySelectorAll('.am-card');
          var target = e.key === 'ArrowUp'
            ? cards[cards.length - 1]
            : cards[0];
          if (target) target.focus();
        }
      });
    }
  }

  window.AM = {
    render: render,
    init: init,
    startKeyboardMove: startKeyboardMove,
    cancelKbMove: cancelKbMove
  };
})();
