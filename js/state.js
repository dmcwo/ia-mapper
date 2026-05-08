/* global window */
(function () {
  'use strict';

  var STORAGE_KEY = 'ia-helper-v1';
  var MAX_HISTORY = 50;

  var _state = _empty();
  var _history = [];
  var _future = [];
  var _subscribers = [];
  var _saveTimer = null;

  function _empty() {
    return { version: 2, cards: {}, rootIds: [], ebIds: [], utilityIds: [], utilityEnabled: false, nextId: 1 };
  }

  function _clone(s) {
    return JSON.parse(JSON.stringify(s));
  }

  function _snap() {
    _history.push(_clone(_state));
    if (_history.length > MAX_HISTORY) _history.shift();
    _future = [];
  }

  function _notify() {
    _subscribers.forEach(function (fn) { fn(_state); });
    clearTimeout(_saveTimer);
    _saveTimer = setTimeout(_save, 300);
  }

  function _save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(_state)); } catch (_) {}
  }

  function _uid() {
    return 'c' + (_state.nextId++);
  }

  function _removeFromParent(id) {
    var c = _state.cards[id];
    if (!c) return;
    if (c.location === 'eb') {
      _state.ebIds = _state.ebIds.filter(function (x) { return x !== id; });
    } else if (c.location === 'am') {
      if (c.parentId) {
        var p = _state.cards[c.parentId];
        if (p) p.childIds = p.childIds.filter(function (x) { return x !== id; });
      } else {
        // Safe to filter both — card will only be in one
        _state.rootIds = _state.rootIds.filter(function (x) { return x !== id; });
        _state.utilityIds = _state.utilityIds.filter(function (x) { return x !== id; });
      }
      c.parentId = null;
    } else if (c.location === 'nested') {
      if (c.nestedInId) {
        var h = _state.cards[c.nestedInId];
        if (h) h.nestedIds = h.nestedIds.filter(function (x) { return x !== id; });
      }
      c.nestedInId = null;
    }
  }

  function _returnSubtreeToEB(id) {
    var c = _state.cards[id];
    if (!c) return;
    var childIds  = c.childIds.slice();
    var nestedIds = c.nestedIds.slice();
    c.childIds  = [];
    c.nestedIds = [];
    // Recursively return both child pages AND nested elements to EB
    childIds.forEach(_returnSubtreeToEB);
    nestedIds.forEach(_returnSubtreeToEB);
    c.parentId   = null;
    c.nestedInId = null;
    c.location   = 'eb';
    _state.ebIds.push(id);
  }

  function _isDescendant(potentialDescId, ancestorId) {
    var visited = {};
    var c = _state.cards[potentialDescId];
    while (c && !visited[c.id]) {
      visited[c.id] = true;
      var parentId = c.parentId || c.nestedInId;
      if (!parentId) break;
      if (parentId === ancestorId) return true;
      c = _state.cards[parentId];
    }
    return false;
  }

  /* ── Public API ─────────────────────────────────────────────── */

  function addCard(title) {
    _snap();
    var id = _uid();
    _state.cards[id] = {
      id: id, title: title.trim(), description: '',
      location: 'eb', parentId: null, childIds: [], nestedIds: [], nestedInId: null,
      order: _state.ebIds.length
    };
    _state.ebIds.push(id);
    _notify();
    return id;
  }

  function updateCard(id, updates) {
    if (!_state.cards[id]) return;
    _snap();
    Object.assign(_state.cards[id], updates);
    _notify();
  }

  function deleteCard(id) {
    var c = _state.cards[id];
    if (!c) return;
    _snap();
    _removeFromParent(id);
    var childIds = c.childIds.slice();
    var nestedIds = c.nestedIds.slice();
    c.childIds = [];
    c.nestedIds = [];
    childIds.forEach(_returnSubtreeToEB);
    nestedIds.forEach(_returnSubtreeToEB);
    delete _state.cards[id];
    _notify();
  }

  function moveToAM(id, targetId, position) {
    var c = _state.cards[id];
    if (!c) return;
    if (id === targetId) return;
    if (position !== 'nest' && targetId && _isDescendant(targetId, id)) return;

    _snap();
    _removeFromParent(id);

    if (!targetId) {
      c.location = 'am'; c.parentId = null;
      c.order = _state.rootIds.length;
      _state.rootIds.push(id);
    } else {
      var t = _state.cards[targetId];
      if (!t) { _notify(); return; }

      if (position === 'nest') {
        // Allow nesting into any placed card (am or nested) — deep nesting supported
        if (t.location === 'eb') { _notify(); return; }
        c.location = 'nested'; c.nestedInId = targetId; c.parentId = null;
        c.order = t.nestedIds.length;
        t.nestedIds.push(id);
      } else if (position === 'child') {
        c.location = 'am'; c.parentId = targetId;
        t.childIds.unshift(id);
        t.childIds.forEach(function (cid, i) { if (_state.cards[cid]) _state.cards[cid].order = i; });
      } else {
        c.location = 'am';
        // Check if target is a utility root item
        var siblings;
        if (t.parentId) {
          siblings = _state.cards[t.parentId].childIds;
        } else if (_state.utilityIds.indexOf(targetId) !== -1) {
          siblings = _state.utilityIds;
        } else {
          siblings = _state.rootIds;
        }
        c.parentId = t.parentId;
        var idx = siblings.indexOf(targetId);
        if (position === 'before') siblings.splice(idx, 0, id);
        else siblings.splice(idx + 1, 0, id);
        siblings.forEach(function (sid, i) { if (_state.cards[sid]) _state.cards[sid].order = i; });
      }
    }
    _notify();
  }

  function moveToUtility(id, targetId, position) {
    var c = _state.cards[id];
    if (!c) return;
    if (id === targetId) return;
    if (position !== 'nest' && targetId && _isDescendant(targetId, id)) return;

    _snap();
    _removeFromParent(id);

    if (!targetId) {
      c.location = 'am'; c.parentId = null;
      c.order = _state.utilityIds.length;
      _state.utilityIds.push(id);
    } else {
      var t = _state.cards[targetId];
      if (!t) { _notify(); return; }

      if (position === 'nest') {
        if (t.location === 'eb') { _notify(); return; }
        c.location = 'nested'; c.nestedInId = targetId; c.parentId = null;
        c.order = t.nestedIds.length;
        t.nestedIds.push(id);
      } else if (position === 'child') {
        c.location = 'am'; c.parentId = targetId;
        t.childIds.unshift(id);
        t.childIds.forEach(function (cid, i) { if (_state.cards[cid]) _state.cards[cid].order = i; });
      } else {
        c.location = 'am';
        var siblings;
        if (t.parentId) {
          siblings = _state.cards[t.parentId].childIds;
        } else {
          siblings = _state.utilityIds;
        }
        c.parentId = t.parentId;
        var idx = siblings.indexOf(targetId);
        if (position === 'before') siblings.splice(idx, 0, id);
        else siblings.splice(idx + 1, 0, id);
        siblings.forEach(function (sid, i) { if (_state.cards[sid]) _state.cards[sid].order = i; });
      }
    }
    _notify();
  }

  function moveToEB(id) {
    var c = _state.cards[id];
    if (!c) return;
    _snap();
    var childIds = c.childIds.slice();
    var nestedIds = c.nestedIds.slice();
    c.childIds = [];
    c.nestedIds = [];
    childIds.forEach(function (cid) {
      var child = _state.cards[cid];
      if (child) { child.parentId = null; _state.rootIds.push(cid); }
    });
    // Recursively return all nested items (including deeply nested) to EB
    nestedIds.forEach(_returnSubtreeToEB);
    _removeFromParent(id);
    c.location = 'eb';
    _state.ebIds.push(id);
    _notify();
  }

  function reorderEB(cardId, beforeId) {
    if (!_state.cards[cardId]) return;
    _snap();
    var ids = _state.ebIds.filter(function (x) { return x !== cardId; });
    if (!beforeId) {
      ids.push(cardId);
    } else {
      var idx = ids.indexOf(beforeId);
      if (idx === -1) ids.push(cardId); else ids.splice(idx, 0, cardId);
    }
    _state.ebIds = ids;
    _notify();
  }

  function clearAM() {
    _snap();
    var allIds = _state.rootIds.concat(_state.utilityIds);
    allIds.forEach(_returnSubtreeToEB);
    _state.rootIds = [];
    _state.utilityIds = [];
    _notify();
  }

  function clearEB() {
    _snap();
    _state.ebIds.forEach(function (id) {
      delete _state.cards[id];
    });
    _state.ebIds = [];
    _notify();
  }

  function deleteAllAM() {
    _snap();
    function deleteRecursive(id) {
      var c = _state.cards[id];
      if (!c) return;
      c.childIds.forEach(deleteRecursive);
      c.nestedIds.forEach(deleteRecursive);
      delete _state.cards[id];
    }
    var allIds = _state.rootIds.concat(_state.utilityIds);
    allIds.forEach(deleteRecursive);
    _state.rootIds = [];
    _state.utilityIds = [];
    _notify();
  }

  function toggleUtility() {
    _snap();
    _state.utilityEnabled = !_state.utilityEnabled;
    _notify();
  }

  function undo() {
    if (!_history.length) return;
    _future.push(_clone(_state));
    if (_future.length > MAX_HISTORY) _future.shift();
    _state = _history.pop();
    _subscribers.forEach(function (fn) { fn(_state); });
    clearTimeout(_saveTimer);
    _saveTimer = setTimeout(_save, 300);
  }

  function redo() {
    if (!_future.length) return;
    _history.push(_clone(_state));
    _state = _future.pop();
    _subscribers.forEach(function (fn) { fn(_state); });
    clearTimeout(_saveTimer);
    _saveTimer = setTimeout(_save, 300);
  }

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && parsed.version === 1) {
          // Migrate v1 → v2
          parsed.utilityIds = [];
          parsed.utilityEnabled = false;
          parsed.version = 2;
          _state = parsed;
          return;
        }
        if (parsed && parsed.version === 2) {
          _state = parsed;
          return;
        }
      }
    } catch (_) {}
    _state = _empty();
  }

  function subscribe(fn) { _subscribers.push(fn); }
  function getState() { return _state; }
  function getCard(id) { return _state.cards[id]; }
  function canUndo() { return _history.length > 0; }
  function canRedo() { return _future.length > 0; }

  window.State = {
    getState: getState, getCard: getCard,
    addCard: addCard, updateCard: updateCard, deleteCard: deleteCard,
    moveToAM: moveToAM, moveToEB: moveToEB, moveToUtility: moveToUtility,
    reorderEB: reorderEB,
    clearAM: clearAM, clearEB: clearEB, deleteAllAM: deleteAllAM,
    toggleUtility: toggleUtility,
    undo: undo, redo: redo,
    load: load, subscribe: subscribe,
    canUndo: canUndo, canRedo: canRedo
  };
})();
