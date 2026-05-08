/* ── App entry point ───────────────────────────────────────────
   Initialises all modules, subscribes renderers, wires global
   keyboard shortcuts and UI controls.
   ─────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  /* ── Re-render everything on state change ────────────────── */
  function renderAll() {
    EB.render();
    AM.render();
    Preview.render();
    updateUndoRedo();
  }

  /* ── Undo / redo button state ────────────────────────────── */
  function updateUndoRedo() {
    var undoBtn = document.getElementById('undo-btn');
    var redoBtn = document.getElementById('redo-btn');
    if (undoBtn) undoBtn.disabled = !State.canUndo();
    if (redoBtn) redoBtn.disabled = !State.canRedo();
  }

  /* ── Global keyboard shortcuts ───────────────────────────── */
  function initGlobalKeys() {
    document.addEventListener('keydown', function (e) {
      // Don't fire shortcuts while typing in an input / textarea
      var tag = (e.target.tagName || '').toLowerCase();
      var isEditing = tag === 'input' || tag === 'textarea' || e.target.isContentEditable;

      /* Ctrl+Z — undo */
      if (e.ctrlKey && !e.shiftKey && e.key === 'z') {
        e.preventDefault();
        State.undo();
        announce('Undo');
        return;
      }
      /* Ctrl+Y or Ctrl+Shift+Z — redo */
      if ((e.ctrlKey && e.key === 'y') || (e.ctrlKey && e.shiftKey && e.key === 'z')) {
        e.preventDefault();
        State.redo();
        announce('Redo');
        return;
      }

      if (isEditing) return;

      /* C — toggle Element Box */
      if (e.key === 'c' || e.key === 'C') {
        if (!e.ctrlKey && !e.metaKey) { e.preventDefault(); EB.toggle(); }
        return;
      }

      /* ? — shortcuts dialog */
      if (e.key === '?') {
        e.preventDefault();
        toggleShortcutsDialog();
        return;
      }
    });
  }

  /* ── Shortcuts dialog ────────────────────────────────────── */
  function toggleShortcutsDialog() {
    var dialog = document.getElementById('shortcuts-dialog');
    var btn    = document.getElementById('shortcuts-btn');
    if (!dialog) return;
    if (dialog.open) {
      dialog.close();
      btn.setAttribute('aria-expanded', 'false');
    } else {
      dialog.showModal();
      btn.setAttribute('aria-expanded', 'true');
      // Focus first focusable inside
      var first = dialog.querySelector('button, [tabindex]');
      if (first) first.focus();
    }
  }

  function initDialogs() {
    /* Shortcuts dialog open/close */
    var shortcutsBtn = document.getElementById('shortcuts-btn');
    if (shortcutsBtn) shortcutsBtn.addEventListener('click', toggleShortcutsDialog);

    var shortcutsDialog = document.getElementById('shortcuts-dialog');
    if (shortcutsDialog) {
      shortcutsDialog.querySelector('.dialog-close').addEventListener('click', function () {
        shortcutsDialog.close();
        document.getElementById('shortcuts-btn').setAttribute('aria-expanded', 'false');
      });
      shortcutsDialog.addEventListener('cancel', function () {
        document.getElementById('shortcuts-btn').setAttribute('aria-expanded', 'false');
      });
    }

    /* Confirm dialog: close on backdrop click */
    var confirmDialog = document.getElementById('confirm-dialog');
    if (confirmDialog) {
      confirmDialog.addEventListener('click', function (e) {
        if (e.target === confirmDialog) confirmDialog.close();
      });
    }
  }

  /* ── Header buttons ──────────────────────────────────────── */
  function initHeader() {
    document.getElementById('undo-btn').addEventListener('click', function () {
      State.undo(); announce('Undo');
    });
    document.getElementById('redo-btn').addEventListener('click', function () {
      State.redo(); announce('Redo');
    });
    document.getElementById('export-btn').addEventListener('click', function () {
      Export.download();
      announce('Downloading IA export as Markdown file.');
    });

    /* ── Bulk action buttons (Feature 2) ── */
    var amClearBtn = document.getElementById('am-clear-btn');
    if (amClearBtn) {
      amClearBtn.addEventListener('click', function () {
        var s = State.getState();
        if (!s.rootIds.length && !s.utilityIds.length) return;
        if (window.confirm('Move all Architecture Map cards back to the Element Box?')) {
          State.clearAM();
          announce('All Architecture Map cards returned to Element Box.');
        }
      });
    }

    var ebClearBtn = document.getElementById('eb-clear-btn');
    if (ebClearBtn) {
      ebClearBtn.addEventListener('click', function () {
        var s = State.getState();
        if (!s.ebIds.length) return;
        if (window.confirm('Delete all ' + s.ebIds.length + ' card(s) in the Element Box? This cannot be undone.')) {
          State.clearEB();
          announce('Element Box cleared.');
        }
      });
    }

    var amDeleteBtn = document.getElementById('am-delete-btn');
    if (amDeleteBtn) {
      amDeleteBtn.addEventListener('click', function () {
        var s = State.getState();
        if (!s.rootIds.length && !s.utilityIds.length) return;
        if (window.confirm('Permanently delete all Architecture Map cards? This cannot be undone.')) {
          State.deleteAllAM();
          announce('All Architecture Map cards deleted.');
        }
      });
    }

    /* ── Import ── */
    var importBtn   = document.getElementById('import-btn');
    var importInput = document.getElementById('import-file-input');
    var importDlg   = document.getElementById('import-confirm-dialog');

    if (importBtn && importInput) {
      importBtn.addEventListener('click', function () {
        importInput.value = ''; // allow re-selecting the same file
        importInput.click();
      });

      importInput.addEventListener('change', function () {
        var file = importInput.files[0];
        if (!file) return;

        var s = State.getState();
        var hasContent = s.rootIds.length || s.utilityIds.length || s.ebIds.length;

        function doImport() {
          Import.handleFile(file, function () {
            renderAll();
            announce('Import complete.');
          });
        }

        if (hasContent && importDlg) {
          importDlg.showModal();
          var okBtn  = document.getElementById('import-confirm-ok');
          var canBtn = document.getElementById('import-confirm-cancel');

          function cleanup() {
            okBtn.removeEventListener('click', onOk);
            canBtn.removeEventListener('click', onCancel);
          }
          function onOk()     { cleanup(); importDlg.close(); doImport(); }
          function onCancel() { cleanup(); importDlg.close(); }

          okBtn.addEventListener('click', onOk);
          canBtn.addEventListener('click', onCancel);
          importDlg.addEventListener('cancel', onCancel, { once: true });
        } else {
          doImport();
        }
      });
    }
  }

  /* ── Announce helper ─────────────────────────────────────── */
  function announce(msg) {
    var el = document.getElementById('sr-announce');
    if (el) { el.textContent = ''; requestAnimationFrame(function () { el.textContent = msg; }); }
  }

  /* ── Bootstrap ───────────────────────────────────────────── */
  function init() {
    // Load persisted state
    State.load();

    // Subscribe renderers to state changes
    State.subscribe(renderAll);

    // Init each module
    EB.init();
    AM.init();
    Preview.init();

    // Wire global UI
    initHeader();
    initDialogs();
    initGlobalKeys();

    // Initial render
    renderAll();
  }

  // Wait for DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
