/* ── Import module ──────────────────────────────────────────────
   Reads a .md or .json file and restores the IA state from it.
   Supported input formats:
     - .md   exported by this tool (exact format from export.js)
     - .json raw state snapshot (version 1 or 2)
   Exposes: window.Import.handleFile(file, onComplete)
   ─────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  var STORAGE_KEY = 'ia-helper-v1';

  /* ── Status display ──────────────────────────────────────── */
  function showMsg(msg, isError) {
    var el = document.getElementById('am-status');
    if (!el) return;
    el.textContent = msg;
    setTimeout(function () {
      if (el.textContent === msg) el.textContent = '';
    }, isError ? 6000 : 3500);
  }

  /* ── Markdown parser ─────────────────────────────────────── */
  // Parses the exact format produced by export.js.
  // Returns { flatSite, flatUtility, ebItems }
  //   flatSite / flatUtility : [{ title, description, depth, nestedItems: [{title, description}] }]
  //   ebItems                : [{ title, description }]
  function parseMd(text) {
    var lines   = text.split('\n');
    var section = 'none'; // 'none' | 'site' | 'utility' | 'eb'
    var flatSite    = [];
    var flatUtility = [];
    var ebItems     = [];
    // Per-section bold-node stacks for accumulating nested (element) items
    var boldStackSite = [];
    var boldStackUtil = [];

    // Matches bold page/utility lines:  [indent]- **Title** [— desc]
    var reBold = /^(\s*)- \*\*(.+?)\*\*(?:\s+—\s+(.+))?$/;
    // Matches nested element lines:     [indent]- Title [— desc] *(element)*
    var reElement = /^(\s*)- (.+?)(?:\s+—\s+(.+?))?\s*\*\(element\)\*\s*$/;
    // Matches EB lines (no bold, no element marker):  - Title [— desc]
    var reEbItem = /^- (.+?)(?:\s+—\s+(.+))?$/;

    lines.forEach(function (line) {
      /* ── Section headers ── */
      if (line === '## Site Structure') { section = 'site';    return; }
      if (line === '## Utility Menu')   { section = 'utility'; return; }
      if (line === '## Element Box')    { section = 'eb';      return; }

      /* ── Skip non-content lines ── */
      if (!line.trim())                        return;
      if (/^#/.test(line))                     return;
      if (line === '---')                      return;
      if (/^\*Generated/.test(line))           return;
      if (/^\*\(No pages/.test(line))          return;
      if (/^\*\(Empty\)/.test(line))           return;

      /* ── Site / Utility sections ── */
      if (section === 'site' || section === 'utility') {
        var arr       = section === 'site' ? flatSite    : flatUtility;
        var boldStack = section === 'site' ? boldStackSite : boldStackUtil;

        // Element line takes priority (checked before bold)
        var mElem = reElement.exec(line);
        if (mElem) {
          var elemIndent  = mElem[1].length;
          var parentDepth = Math.floor(elemIndent / 2) - 1;
          if (parentDepth >= 0 && boldStack[parentDepth]) {
            boldStack[parentDepth].nestedItems.push({
              title:       mElem[2].trim(),
              description: mElem[3] ? mElem[3].trim() : ''
            });
          }
          return;
        }

        var mBold = reBold.exec(line);
        if (mBold) {
          var depth = Math.floor(mBold[1].length / 2);
          var node = {
            title:       mBold[2].trim(),
            description: mBold[3] ? mBold[3].trim() : '',
            depth:       depth,
            nestedItems: []
          };
          arr.push(node);
          boldStack[depth] = node;
          boldStack.length = depth + 1;
          return;
        }
      }

      /* ── Element Box section ── */
      if (section === 'eb') {
        var mEb = reEbItem.exec(line);
        if (mEb) {
          ebItems.push({
            title:       mEb[1].trim(),
            description: mEb[2] ? mEb[2].trim() : ''
          });
        }
      }
    });

    if (!flatSite.length && !flatUtility.length && !ebItems.length) {
      throw new Error('No content found. Is this a valid IA Helper export?');
    }

    return { flatSite: flatSite, flatUtility: flatUtility, ebItems: ebItems };
  }

  /* ── Build state object from parsed Markdown ─────────────── */
  function buildStateFromMd(parsed) {
    var nextId      = 1;
    var cards       = {};
    var rootIds     = [];
    var utilityIds  = [];
    var ebIds       = [];
    var utilityEnabled = parsed.flatUtility.length > 0;

    function makeId() { return 'c' + (nextId++); }

    // Create a card, attach its nested elements, append to siblings array.
    // Returns the new card id.
    function addNode(node, parentId, siblings) {
      var id = makeId();
      var card = {
        id:          id,
        title:       node.title,
        description: node.description,
        location:    'am',
        parentId:    parentId || null,
        childIds:    [],
        nestedIds:   [],
        nestedInId:  null,
        order:       siblings.length
      };
      cards[id] = card;
      siblings.push(id);

      // Attach nested elements (written before child pages in export)
      node.nestedItems.forEach(function (ni) {
        var nid = makeId();
        cards[nid] = {
          id:          nid,
          title:       ni.title,
          description: ni.description,
          location:    'nested',
          parentId:    null,
          childIds:    [],
          nestedIds:   [],
          nestedInId:  id,
          order:       card.nestedIds.length
        };
        card.nestedIds.push(nid);
      });

      return id;
    }

    // DFS pre-order placement using a depth stack
    function placeNodes(flatNodes, topLevelIds) {
      var idStack = [];
      flatNodes.forEach(function (node) {
        var id, parentId, parent;
        if (node.depth === 0) {
          id = addNode(node, null, topLevelIds);
          idStack[0] = id;
          idStack.length = 1;
        } else {
          parentId = idStack[node.depth - 1];
          parent   = cards[parentId];
          if (!parent) return; // malformed depth — skip
          id = addNode(node, parentId, parent.childIds);
          idStack[node.depth] = id;
          idStack.length = node.depth + 1;
        }
      });
    }

    placeNodes(parsed.flatSite,    rootIds);
    placeNodes(parsed.flatUtility, utilityIds);

    // EB items — flat, no depth
    parsed.ebItems.forEach(function (item) {
      var id = makeId();
      cards[id] = {
        id:          id,
        title:       item.title,
        description: item.description,
        location:    'eb',
        parentId:    null,
        childIds:    [],
        nestedIds:   [],
        nestedInId:  null,
        order:       ebIds.length
      };
      ebIds.push(id);
    });

    return {
      version:        2,
      cards:          cards,
      rootIds:        rootIds,
      ebIds:          ebIds,
      utilityIds:     utilityIds,
      utilityEnabled: utilityEnabled,
      nextId:         nextId
    };
  }

  /* ── JSON validator ──────────────────────────────────────── */
  function parseJson(text) {
    var obj;
    try { obj = JSON.parse(text); } catch (_) { throw new Error('File is not valid JSON.'); }
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
      throw new Error('File is not valid JSON.');
    }

    // Version check / migration
    if (obj.version === 1) {
      obj.utilityIds     = obj.utilityIds     || [];
      obj.utilityEnabled = false;
      obj.version        = 2;
    } else if (obj.version !== 2) {
      throw new Error('Unsupported state version.');
    }

    // Required fields
    if (!obj.cards || typeof obj.cards !== 'object') throw new Error('JSON is missing required fields.');
    if (!Array.isArray(obj.rootIds))                  throw new Error('JSON is missing required fields.');
    if (!Array.isArray(obj.ebIds))                    throw new Error('JSON is missing required fields.');
    if (!Array.isArray(obj.utilityIds))               throw new Error('JSON is missing required fields.');
    if (typeof obj.nextId !== 'number')               throw new Error('JSON is missing required fields.');

    // Referential integrity
    function checkRefs(ids) {
      for (var i = 0; i < ids.length; i++) {
        if (!obj.cards[ids[i]]) throw new Error('JSON contains invalid card references.');
      }
    }
    checkRefs(obj.rootIds);
    checkRefs(obj.ebIds);
    checkRefs(obj.utilityIds);
    var keys = Object.keys(obj.cards);
    for (var i = 0; i < keys.length; i++) {
      var c = obj.cards[keys[i]];
      if (Array.isArray(c.childIds))  checkRefs(c.childIds);
      if (Array.isArray(c.nestedIds)) checkRefs(c.nestedIds);
    }

    return obj;
  }

  /* ── Write state to storage and reload ──────────────────── */
  function applyState(stateObj) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stateObj));
    } catch (_) {
      throw new Error('Could not save to storage.');
    }
    State.load(); // reads localStorage → internal _state; does NOT call _notify()
  }

  /* ── Public entry point ──────────────────────────────────── */
  // handleFile(file, onComplete)
  //   file       — File object from <input type="file">
  //   onComplete — called (no args) after successful import so the caller
  //                can trigger a full re-render (State.load doesn't notify)
  function handleFile(file, onComplete) {
    if (!window.FileReader) {
      showMsg('Your browser does not support file reading.', true);
      return;
    }

    var name = (file && file.name) || '';
    var ext  = name.split('.').pop().toLowerCase();
    if (ext !== 'md' && ext !== 'json') {
      showMsg('Please import a .md or .json file.', true);
      return;
    }

    var reader = new FileReader();

    reader.onerror = function () {
      showMsg('Could not read the file.', true);
    };

    reader.onload = function (e) {
      var text = e.target.result;
      try {
        var stateObj;
        if (ext === 'md') {
          var parsed = parseMd(text);
          stateObj   = buildStateFromMd(parsed);
        } else {
          stateObj = parseJson(text);
        }
        applyState(stateObj);
        if (onComplete) onComplete();
      } catch (err) {
        showMsg(err.message || 'Import failed.', true);
      }
    };

    reader.readAsText(file, 'utf-8');
  }

  window.Import = { handleFile: handleFile };
})();
