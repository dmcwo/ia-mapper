/* ── Element Box module ────────────────────────────────────────
   Renders and manages the Element Box sidebar.
   Exposes: window.EB.render()
   ─────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  var prevEbIds = [];            // track previous set for enter animations
  var ebCollapsed = false;

  // Feature 6: track drop-before target for reordering
  var ebDropBeforeId = null;

  /* ── Announce helper ─────────────────────────────────────── */
  function announce(msg) {
    var el = document.getElementById('sr-announce');
    if (el) { el.textContent = ''; requestAnimationFrame(function () { el.textContent = msg; }); }
  }

  /* ── Main render ─────────────────────────────────────────── */
  function render() {
    var state = State.getState();
    var container = document.getElementById('eb-cards');
    if (!container) return;

    var newIds = state.ebIds.filter(function (id) { return prevEbIds.indexOf(id) === -1; });
    var focusedId = document.activeElement && document.activeElement.dataset.cardId;

    container.innerHTML = '';
    state.ebIds.forEach(function (id) {
      var card = State.getCard(id);
      if (!card) return;
      var el = buildCard(card, newIds.indexOf(id) !== -1);
      container.appendChild(el);
    });

    // Update rail count
    var railCount = document.getElementById('eb-rail-count');
    if (railCount) railCount.textContent = state.ebIds.length || '';

    // Restore focus
    if (focusedId) {
      var focusEl = container.querySelector('[data-card-id="' + focusedId + '"]');
      if (focusEl) focusEl.focus();
    }

    prevEbIds = state.ebIds.slice();
  }

  /* ── Build a single EB card element ─────────────────────── */
  function buildCard(card, isNew) {
    var el = document.createElement('div');
    el.className = 'eb-card' + (isNew ? ' card-entering' : '');
    el.setAttribute('role', 'listitem');
    el.setAttribute('draggable', 'true');
    el.setAttribute('tabindex', '0');
    el.setAttribute('aria-label', card.title + ' — press M to move to Architecture Map');
    el.dataset.cardId = card.id;

    // Feature 5: add is-empty class when no description; add-desc-btn hidden when description present
    el.innerHTML =
      '<div class="card-row">' +
        '<span class="drag-handle" aria-hidden="true" title="Drag to Architecture Map">⠿</span>' +
        '<div class="card-body">' +
          '<span class="card-title-text">' + esc(card.title) + '</span>' +
          '<input class="card-title-input" type="text" value="' + esc(card.title) + '" aria-label="Title">' +
          '<span class="card-desc-text' + (card.description ? '' : ' is-empty') + '">' + esc(card.description) + '</span>' +
          '<textarea class="card-desc-input" rows="2" aria-label="Description">' + esc(card.description) + '</textarea>' +
          '<button class="add-desc-btn' + (card.description ? ' is-hidden' : '') + '" type="button" aria-label="Add description">+ Add description</button>' +
        '</div>' +
        '<button class="card-delete-btn" aria-label="Delete ' + esc(card.title) + '" title="Delete (Del)">×</button>' +
      '</div>';

    attachCardEvents(el, card.id);
    return el;
  }

  /* ── Card event wiring ───────────────────────────────────── */
  function attachCardEvents(el, id) {
    var titleText  = el.querySelector('.card-title-text');
    var titleInput = el.querySelector('.card-title-input');
    var descText   = el.querySelector('.card-desc-text');
    var descInput  = el.querySelector('.card-desc-input');
    var deleteBtn  = el.querySelector('.card-delete-btn');
    var addDescBtn = el.querySelector('.add-desc-btn');

    /* ── Inline editing: title ─── */
    function startTitleEdit() {
      titleText.classList.add('hidden');
      titleInput.classList.add('active');
      titleInput.focus();
      titleInput.select();
    }
    function commitTitleEdit() {
      var val = titleInput.value.trim() || 'Untitled';
      titleText.classList.remove('hidden');
      titleInput.classList.remove('active');
      State.updateCard(id, { title: val });
    }

    titleText.addEventListener('click', startTitleEdit);
    titleText.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); startTitleEdit(); }
    });
    titleInput.addEventListener('blur', commitTitleEdit);
    titleInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); commitTitleEdit(); el.focus(); }
      if (e.key === 'Escape') { titleInput.value = State.getCard(id).title; commitTitleEdit(); el.focus(); }
      e.stopPropagation();
    });

    /* ── Inline editing: description ─── */
    function startDescEdit() {
      descText.classList.add('hidden');
      descInput.classList.add('active');
      descInput.focus();
      autoResize(descInput);
    }
    function commitDescEdit() {
      var val = descInput.value.trim();
      descText.classList.remove('hidden');
      descInput.classList.remove('active');
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

    descText.addEventListener('click', startDescEdit);
    descInput.addEventListener('blur', commitDescEdit);
    descInput.addEventListener('input', function () { autoResize(descInput); });
    descInput.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { commitDescEdit(); el.focus(); }
      e.stopPropagation();
    });

    // Feature 5: add-desc-btn click starts desc edit
    if (addDescBtn) {
      addDescBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        startDescEdit();
      });
    }

    /* ── Delete ─── */
    deleteBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      confirmDelete(id, el);
    });

    /* ── Keyboard shortcuts on the card ─── */
    el.addEventListener('keydown', function (e) {
      if (e.target !== el) return; // don't intercept when editing
      if (e.key === 'E' || e.key === 'e') { e.preventDefault(); startTitleEdit(); }
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); confirmDelete(id, el); }
      if (e.key === 'M' || e.key === 'm') { e.preventDefault(); keyboardMoveFromEB(id); }
      if (e.key === 'ArrowDown') { e.preventDefault(); focusNextCard(el, 1); }
      if (e.key === 'ArrowUp')   { e.preventDefault(); focusNextCard(el, -1); }
    });

    /* ── Drag & drop ─── */
    el.addEventListener('dragstart', function (e) {
      e.dataTransfer.setData('text/plain', id);
      e.dataTransfer.effectAllowed = 'move';
      el.classList.add('dragging');
      document.body.classList.add('is-dragging');
      // deferred so the drag image captures the un-dimmed state
      requestAnimationFrame(function () { el.classList.add('dragging'); });
    });
    el.addEventListener('dragend', function () {
      el.classList.remove('dragging');
      document.body.classList.remove('is-dragging');
    });

    // EB itself is also a drop target (to receive cards back from AM)
    // — handled at the container level in initDropTarget()
  }

  /* ── Delete confirmation ─────────────────────────────────── */
  function confirmDelete(id, el) {
    var card = State.getCard(id);
    if (!card) return;
    var hasChildren = card.childIds.length || card.nestedIds.length;
    var dialog = document.getElementById('confirm-dialog');
    var msg    = document.getElementById('confirm-msg');
    var okBtn  = document.getElementById('confirm-ok');
    var cancelBtn = document.getElementById('confirm-cancel');

    document.getElementById('confirm-title').textContent = 'Delete "' + card.title + '"?';
    msg.textContent = hasChildren
      ? 'This card has children or nested elements — all will be returned to the Element Box.'
      : 'This card will be permanently removed.';

    dialog.showModal();

    // Feature 1: fixed cleanup to also remove dialog cancel listener
    function cleanup() {
      okBtn.removeEventListener('click', onOk);
      cancelBtn.removeEventListener('click', onCancel);
      dialog.removeEventListener('cancel', onCancel);
    }
    // Feature 1: call State.deleteCard directly, no animation wait
    function onOk() {
      cleanup(); dialog.close();
      State.deleteCard(id);
      announce('Deleted ' + card.title);
    }
    function onCancel() { cleanup(); dialog.close(); if (el) el.focus(); }

    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
    dialog.addEventListener('cancel', onCancel, { once: true });
  }

  /* ── Keyboard move: pick up card → send to AM ────────────── */
  function keyboardMoveFromEB(id) {
    var card = State.getCard(id);
    if (!card) return;
    announce('Moving "' + card.title + '". Use the Architecture Map to choose a position and press Enter, or press Escape to cancel.');
    // Delegate to AM module
    if (window.AM && AM.startKeyboardMove) AM.startKeyboardMove(id);
  }

  /* ── Helpers ─────────────────────────────────────────────── */
  function focusNextCard(el, dir) {
    var cards = Array.from(document.querySelectorAll('#eb-cards .eb-card'));
    var idx = cards.indexOf(el);
    var next = cards[idx + dir];
    if (next) next.focus();
  }

  function autoResize(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
  }

  function esc(str) {
    return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  /* ── Collapse / expand ───────────────────────────────────── */
  function collapse() {
    ebCollapsed = true;
    var ws = document.getElementById('workspace');
    var eb = document.getElementById('element-box');
    var rail = document.getElementById('eb-rail');
    ws.classList.add('eb-collapsed');
    eb.setAttribute('aria-hidden', 'true');
    eb.setAttribute('inert', '');
    rail.removeAttribute('hidden');
    rail.removeAttribute('aria-hidden');
    document.getElementById('eb-expand-btn').focus();
  }

  function expand() {
    ebCollapsed = false;
    var ws = document.getElementById('workspace');
    var eb = document.getElementById('element-box');
    var rail = document.getElementById('eb-rail');
    ws.classList.remove('eb-collapsed');
    eb.removeAttribute('aria-hidden');
    eb.removeAttribute('inert');
    rail.setAttribute('hidden', '');
    rail.setAttribute('aria-hidden', 'true');
    document.getElementById('eb-collapse-btn').focus();
  }

  function toggle() { ebCollapsed ? expand() : collapse(); }
  function isCollapsed() { return ebCollapsed; }

  /* ── EB area as drop target (accept cards from AM, reorder within EB) ── */
  function initDropTarget() {
    var container = document.getElementById('eb-cards');

    container.addEventListener('dragover', function (e) {
      e.preventDefault(); e.dataTransfer.dropEffect = 'move';
      container.style.background = 'var(--c-accent-light)';

      // Feature 6: compute which card cursor is above midpoint of
      var draggingId = e.dataTransfer.getData ? null : null; // can't read in dragover
      var cards = Array.from(container.querySelectorAll('.eb-card'));
      var cy = e.clientY;
      var newBeforeId = null;

      // Clear all existing drop-before highlights
      cards.forEach(function (c) { c.classList.remove('eb-drop-before'); });

      for (var i = 0; i < cards.length; i++) {
        var r = cards[i].getBoundingClientRect();
        var mid = r.top + r.height / 2;
        if (cy < mid) {
          newBeforeId = cards[i].dataset.cardId;
          cards[i].classList.add('eb-drop-before');
          break;
        }
      }
      ebDropBeforeId = newBeforeId;
    });

    container.addEventListener('dragleave', function (e) {
      if (!container.contains(e.relatedTarget)) {
        container.style.background = '';
        // Clear drop-before highlights
        container.querySelectorAll('.eb-drop-before').forEach(function (c) {
          c.classList.remove('eb-drop-before');
        });
        ebDropBeforeId = null;
      }
    });

    container.addEventListener('drop', function (e) {
      e.preventDefault();
      container.style.background = '';
      container.querySelectorAll('.eb-drop-before').forEach(function (c) {
        c.classList.remove('eb-drop-before');
      });

      var cardId = e.dataTransfer.getData('text/plain');
      if (!cardId) { ebDropBeforeId = null; return; }
      var card = State.getCard(cardId);
      if (!card) { ebDropBeforeId = null; return; }

      // Feature 6: if card is already in EB, reorder; otherwise move from AM
      if (card.location === 'eb') {
        State.reorderEB(cardId, ebDropBeforeId);
        announce(card.title + ' reordered in Element Box.');
      } else {
        State.moveToEB(cardId);
        announce(card.title + ' returned to Element Box.');
      }
      ebDropBeforeId = null;
    });
  }

  /* ── Init ────────────────────────────────────────────────── */
  function init() {
    initDropTarget();
    document.getElementById('eb-collapse-btn').addEventListener('click', collapse);
    document.getElementById('eb-expand-btn').addEventListener('click', expand);

    var addBtn   = document.getElementById('eb-add-btn');
    var textarea = document.getElementById('eb-input');

    function addFromTextarea() {
      var lines = textarea.value.split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
      if (!lines.length) return;
      lines.forEach(function (line) { State.addCard(line); });
      textarea.value = '';
      textarea.focus();
      announce('Added ' + lines.length + ' element' + (lines.length > 1 ? 's' : '') + ' to Element Box.');
    }

    addBtn.addEventListener('click', addFromTextarea);
    textarea.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && e.shiftKey) { e.preventDefault(); addFromTextarea(); }
    });
  }

  window.EB = { render: render, init: init, toggle: toggle, collapse: collapse, expand: expand, isCollapsed: isCollapsed };
})();
