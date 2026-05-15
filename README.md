# IAM — Information Architecture Mapper

A browser-based tool for planning and visualising website navigation structures. Build an information architecture by organising page cards into a hierarchy, then preview how it would look across different navigation menu themes.

---

## Workspaces: Element Box and Architecture Map

**IAM** gives you three connected workspaces:

- **Element Box** — a holding area for page/section name cards. Add names one per line, drag them out to build your IA, or drag them back when you change your mind.
- **Architecture Map** — a tree editor where you arrange cards into a hierarchy. Drag cards under other cards to create parent–child relationships. A drop-indicator line shows exactly where each card will land.
-- As you build, a **live preview** at the top of the page renders your IA as a navigation component in your chosen theme. Switch themes and viewport sizes to check how the structure translates across contexts.

---

## Navigation themes

| Button | Style | Notes |
|--------|-------|-------|
| Single row | Default single-bar nav | Hover reveals nested flyout menus. Utility items in the same row as main nav |
| Two row | Utility bar + primary nav | Utility items in a slim bar above |
| Compact | Sticky single-row with flyouts | Two-level flyout panels; good for dense structures |
| Mega | Mega menu showing all menus on hover | Dark panel; columns align under tabs; yellow active indicator; column dimming on hover |
| Rich HTML | Card-style dropdown | Each parent opens a two-column grid of icon + title cards |

Use the **Desktop / Laptop / Mobile** buttons to preview at different viewport widths.

---

## Getting started

IAM runs entirely in your browser by visiting https://dmcwo.github.io/ia-mapper/

You can also run it locally:

1. Visit https://github.com/dmcwo/ia-mapper 
2. Download the repository to your local computer
3. Open the index.html file from your browser

---

## Quick tour

### Loading sample content

Click **Sample IA** in the header to load a real-world information architecture (UC San Diego Library, 7 sections, 40 pages) and see all themes with meaningful content immediately.

### Building your own IA

1. Type page or section names in the **Element Box** input, one per line. Press **Shift+Enter** or click **+ Add**.
2. Drag cards from the Element Box into the **Architecture Map**. Drop onto the root zone to add a top-level page.
3. Drag a card onto the left portion of an existing card to place it **before or after** it; drag onto the right portion to make it a **child** of that card.
4. 	Add items to the **+ Add Utility Menu** area to add a separate utility navigation zone (for items like "Contact", "Login", "Help"). Removing all items from this area will remove it from the live preview.
5. Type a **Site name** in the Architecture Map header — it appears as the brand/logo in every preview theme.

### Editing cards

Cards can be renamed inline. In **Edit mode** (the Edit mode button in the Architecture Map header), action buttons appear on each card for renaming, returning to the Element Box, or deleting.

### Keyboard navigation

IAM aims for full keyboard support.

| Key | Action |
|-----|--------|
| `Tab` | Focus the Architecture Map |
| `↑` / `↓` | Move between cards |
| `→` | Expand subtree or move into first child |
| `←` | Collapse subtree or move up to parent |
| `M` | Pick up focused card to move it |
| `Enter` / `Space` | Drop card at current position |
| `Esc` | Cancel move |
| `E` | Edit card title |
| `B` | Return card to Element Box |
| `Del` | Delete card (children return to Element Box) |
| `Ctrl+Z` | Undo |
| `Ctrl+Y` | Redo |
| `C` | Collapse / expand Element Box |
| `?` | Show keyboard shortcuts panel |

Press **Keyboard Control** in the header for the full reference.

### Import / Export

- **Import** — load a `.md` or `.json` file exported from a previous session.
- **Export .md** — download the current IA as a Markdown outline, ready to paste into a spec or share with a colleague.

State is automatically saved to `localStorage` on every change, so your work persists across page refreshes.

---

## File structure

```
ia-mapper/
├── index.html          # App shell, dialogs, script/style tags
├── css/
│   ├── style.css       # Base design tokens and component styles
│   ├── ui-skin.css     # Warm terracotta theme overrides
│   ├── theme-mega-v2.css        # Mega menu theme
│   ├── theme-4-compact-sticky.css  # Compact sticky theme
│   ├── theme-5-rich-dropdown.css   # Rich HTML card-dropdown theme
│   └── theme-1-utility-dropdown.css # (legacy, unused by current themes)
├── js/
│   ├── state.js        # Immutable state store with undo/redo history
│   ├── eb.js           # Element Box — rendering and drag/drop
│   ├── am.js           # Architecture Map — tree, drag/drop, keyboard nav
│   ├── preview.js      # Live preview — theme builders and viewport switching
│   ├── export.js       # Markdown export
│   ├── import.js       # .md and .json import
│   ├── sample.js       # Sample IA loader (UC San Diego Library)
│   └── app.js          # Bootstrap, global keyboard shortcuts, header wiring
└── README.md
```

---

## Architecture notes

**State** (`js/state.js`) is a single plain object kept in memory, cloned into an undo history array on every mutation. Subscribers (EB, AM, Preview) are notified after each change and re-render from the new state. State is debounce-saved to `localStorage` after 300 ms of quiet.

**Preview themes** are loaded as separate CSS files injected dynamically by `preview.js` when a theme is selected. Each theme uses a namespaced class prefix (`pmega-`, `prich-`, etc.) so theme styles never bleed into the app chrome.

**Drag and drop** uses the native HTML5 Drag and Drop API. Drop target detection (`computeDropTarget` in `am.js`) calculates the target position from the pointer's offset within the card: top strip → before/after sibling; right 67% of card body → child.

---

## Accessibility

- IAM aspires to be WCAG 2.1 AA compliant throughout; key interactive areas target AAA (7:1 contrast).
- Full keyboard navigation with ARIA tree semantics on the Architecture Map.
- Skip-to-main-content link on every page.
- All touch targets meet WCAG 2.5.5 (44 × 44 px minimum).
- Screen reader announcements via `aria-live` regions for drag-and-drop and card actions.
- No motion beyond simple CSS transitions (no auto-playing animations).
