# Nav Theme CSS — Four Generalized Patterns

Four de-branded, generalized CSS files for a nav menu planning app.
Each file is a standalone theme derived from structural analysis of
university and academic library navigation patterns.

---

## Theme Overview

| File | Pattern | Utility Nav | Dropdown Type | Sticky |
|------|---------|-------------|---------------|--------|
| `theme-1-utility-dropdown.css` | Utility bar + horizontal primary nav | ✅ Top bar | Flyout list | ❌ |
| `theme-2-panel-nav.css` | Interactive mega-panels (Ask, Hours) | Inline actions | Rich panels | ❌ |
| `theme-3-university-homepage.css` | University homepage style with CTAs | ✅ Strip + search | Flyout list | ❌ |
| `theme-4-compact-sticky.css` | Compact sticky single-row bar | Inline utility | Flyout + search drawer | ✅ |

---

## Theme 1 — Utility Bar + Horizontal Dropdown Nav
**Inspired by:** UCLA Library  
**Pattern:** Two-tier layout. Slim utility bar sits above a taller primary nav bar. 
Primary items open standard flyout dropdown lists. Active state uses a bottom-border 
indicator on primary links.

**Key structural classes:**
- `.utility-bar` / `.utility-nav__list` / `.utility-nav__link--cta`
- `.primary-header` / `.primary-nav__list` / `.primary-nav__item--has-dropdown`
- `.dropdown-menu` / `.dropdown-menu__link`
- `.nav-toggle` (hamburger)

---

## Theme 2 — Interactive Panel Nav
**Inspired by:** Harvard Library  
**Pattern:** Single nav row where items open rich contextual panels — not just 
link lists. Panels include an "Ask a librarian" input form, a live hours widget, 
and standard link lists. The CTA account link is styled as a filled button.

**Key structural classes:**
- `.primary-nav__item--has-panel` / `.primary-nav__link--trigger`
- `.nav-panel` / `.nav-panel--action` / `.nav-panel--hours`
- `.action-panel__input-row` / `.action-panel__submit`
- `.hours-panel__list` / `.hours-panel__time--closed`
- `.primary-nav__link--cta`

---

## Theme 3 — University Homepage Nav
**Inspired by:** UCSD.edu  
**Pattern:** A bolder university-site approach. Utility strip contains a 
live search input that expands on focus, plus explicit CTA buttons (Give, Apply Now). 
Primary nav is taller with more visual weight. Dropdown links use a left-border 
hover indicator.

**Key structural classes:**
- `.utility-strip` / `.utility-search` / `.utility-ctas`
- `.utility-cta--plain` / `.utility-cta--primary`
- `.primary-header` / `.primary-nav__list`
- `.dropdown-menu__link` (left-border hover variant)

---

## Theme 4 — Compact Sticky Nav
**Inspired by:** UCSD Library (approximated) + hybrid pattern  
**Pattern:** Everything in one compact row that sticks on scroll. Primary nav 
and utility links share a single bar. A search icon toggles a sliding search 
drawer beneath the header. Utility links collapse on tablet and reappear in the 
mobile drawer.

**Key structural classes:**
- `.site-header--sticky` / `.is-scrolled` (scroll state)
- `.nav-shell` (combined nav + utility wrapper)
- `.utility-actions` / `.utility-action` / `.search-toggle`
- `.search-drawer` / `.search-form__options` (scoped search)
- `.skip-link` (accessibility)

---

## Shared Conventions Across All Themes

### CSS Custom Properties
Every theme uses `--nav-*` CSS custom properties at `:root`. To apply branding, 
override these properties — no selector changes needed.

```css
:root {
  --nav-primary-bg: #your-color;
  --nav-primary-active-indicator: #your-brand-color;
  --nav-logo-max-height: 48px;
  /* ...etc */
}
```

### Responsive Breakpoints
All themes use the same breakpoint scale:

| Breakpoint | Behavior |
|-----------|----------|
| > 1024px | Full desktop layout |
| 768–1024px | Compact desktop (smaller padding/font sizes) |
| < 768px | Mobile: hamburger + vertical drawer |

Theme 4 uses 640px as its mobile breakpoint due to the compact single-row layout.

### Accessibility
- All interactive nav items use `aria-expanded` / `aria-hidden` / `aria-controls`
- Focus-visible styles on every interactive element
- `.sr-only` utility class included in each file
- `.skip-link` included in Theme 4; add to others as needed
- Dropdown menus use `role="menu"` / `role="menuitem"` pattern where noted

### JavaScript Expectations
These are CSS-only files. A thin JS layer is expected to:
- Toggle `aria-expanded` on buttons
- Toggle `.is-open` on the nav container
- Toggle `aria-hidden` on panels/drawers/dropdowns
- Add `.is-scrolled` to `.site-header--sticky` on scroll (Theme 4)

---

## File Structure

```
nav-themes/
├── theme-1-utility-dropdown.css     UCLA Library pattern
├── theme-2-panel-nav.css            Harvard Library pattern
├── theme-3-university-homepage.css  UCSD.edu pattern
├── theme-4-compact-sticky.css       UCSD Library / hybrid pattern
└── README.md                        This file
```
