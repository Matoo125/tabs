# Catalog — a bookmark manager extension

A personal link manager that lives in your browser toolbar. Save the tab
you're on, tag it, search across titles/URLs/tags, and jump back to any
link in a click.

## Install

### Chrome / Edge / Brave (any Chromium browser)

1. Unzip `catalog-extension.zip` somewhere permanent (don't delete the
   folder afterward — the browser loads the extension from it directly).
2. Go to `chrome://extensions`.
3. Turn on **Developer mode** (top right toggle).
4. Click **Load unpacked** and select the unzipped `catalog-extension`
   folder.
5. Pin the "Catalog" icon to your toolbar for quick access.

### Firefox

1. Unzip `catalog-extension.zip` somewhere permanent.
2. Open Firefox and go to `about:debugging`.
3. Click **This Firefox** in the sidebar.
4. Click **Load Temporary Add-on...**
5. Select any file inside the unzipped folder (e.g., `manifest.json`).
6. Pin the "Catalog" icon to your toolbar for quick access.

## Using it

- **Save the current tab** — click the extension icon, then **+ Save tab**,
  or press `Ctrl+Shift+S` (`Cmd+Shift+S` on Mac) from anywhere.
- **Save a specific link on a page** — right-click the link → *Save link
  to Catalog*.
- **Save the whole page from a right-click** — right-click empty space on
  a page → *Save page to Catalog*.
- **Tag a link** — click **+ tag** on any card, type one or more
  comma-separated tags, press Enter.
- **Remove a tag** — click the tag chip on the card.
- **Filter by tag** — use the tag rail under the search box.
- **Search** — matches title, URL, and tags as you type.
- **Delete a link** — the `×` on the right of its card.

All data is stored locally in the browser via `chrome.storage.local` —
nothing leaves your machine.

## Files

- `manifest.json` — extension configuration (Manifest V3)
- `popup.html` / `popup.css` / `popup.js` — the toolbar popup UI and logic
- `background.js` — context-menu items and the keyboard shortcut
- `icons/` — toolbar icons

## Notes / possible next steps

- Storage is local per-browser-profile; there's no sync across devices yet.
  Chrome's `chrome.storage.sync` could replace `chrome.storage.local` if
  you want it to follow you between machines (has stricter size limits).
- No import/export yet — easy to add as a JSON download/upload button if
  useful.
