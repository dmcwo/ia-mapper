/* ── Sample IA loader ───────────────────────────────────────────
   Builds a fresh state from the UC San Diego Library nav structure
   and loads it via State.replace().
   Exposes: window.Sample.load()
   ─────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  var SAMPLE_SITE_NAME = 'UC San Diego Library';

  var SAMPLE_IA = [
    { title: 'Research & Collections', children: [
      'Find Books, Articles & More',
      'About the Collections',
      'Special Collections & Archives',
      'Scholarly Communication',
      'Research Data',
      'Digital Initiatives Division',
      'Undergraduate Library Research Prize',
      'Help Build Our Collections'
    ]},
    { title: 'Borrow & Request', children: [
      'Borrowing',
      'Library Cards & Checkout Periods',
      'Course Reserves',
      'Interlibrary Loan',
      'My Library Account',
      'Fines & Fees',
      'Billing Appeal Form'
    ]},
    { title: 'Computing & Technology', children: [
      'Print & Scan',
      'Connect to Library Resources',
      'Computing',
      'Tech Lending',
      'Data & GIS Lab'
    ]},
    { title: 'Visit', children: [
      'Study Spaces',
      'Reserve a Space',
      'Library Workshops',
      'Library Maps',
      'Library Tours',
      'Library De-Stress Activities'
    ]},
    { title: 'Get Help', children: [
      'Getting Started',
      'Email Us',
      'Schedule a Consultation',
      '24/7 Chat',
      'Request Library Instruction',
      'Library Suggestions',
      'Persons with Disabilities'
    ]},
    { title: 'About', children: [
      'News & Events',
      'Contact Us',
      'Geisel Library & Sally T. WongAvery Library',
      'Strategy & Partnerships',
      'Library Jobs',
      'Library Policies',
      'Support the Library'
    ]},
    { title: 'Hours', children: [
      'Service Desk Hours'
    ]}
  ];

  function buildState() {
    var nextId = 1;
    function uid() { return 'c' + (nextId++); }

    var state = {
      version: 2,
      cards: {},
      rootIds: [],
      ebIds: [],
      utilityIds: [],
      utilityEnabled: false,
      nextId: 1
    };

    SAMPLE_IA.forEach(function (item, parentOrder) {
      var parentId  = uid();
      var childIds  = item.children.map(function (childTitle, childOrder) {
        var childId = uid();
        state.cards[childId] = {
          id: childId, title: childTitle, description: '',
          location: 'am', parentId: parentId,
          childIds: [], nestedIds: [], nestedInId: null,
          order: childOrder
        };
        return childId;
      });

      state.cards[parentId] = {
        id: parentId, title: item.title, description: '',
        location: 'am', parentId: null,
        childIds: childIds, nestedIds: [], nestedInId: null,
        order: parentOrder
      };
      state.rootIds.push(parentId);
    });

    state.nextId = nextId;
    return state;
  }

  function load() {
    State.replace(buildState());

    var input = document.getElementById('preview-site-name-input');
    if (input) {
      input.value = SAMPLE_SITE_NAME;
      input.dispatchEvent(new Event('input'));
    }
  }

  window.Sample = { load: load };
})();
