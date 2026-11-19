# Guide — working with Refs Workspace

This is the how-to guide: a short first run, the core research loop, a few complete workflows, and a
seed library you can import as a starting point.

For API limits and exactly what costs a request, read [`USAGE.md`](./USAGE.md). For features and
project status, read [`README.md`](./README.md).

---

## 1. First run

```bash
npm install
cp .env.example .env.local   # optional but recommended
npm run dev
```

In `.env.local`:

- `VITE_CROSSREF_MAILTO` — your email; joins Crossref's polite pool and triples the search rate limit.
- `VITE_UNPAYWALL_EMAIL` — optional contact email for open-access PDF lookups (falls back to the
  Crossref email).

Everything is local: no account, no backend, no sync. Your library lives in this browser (IndexedDB),
so export a JSON backup before clearing site data.

### Seed the workspace (optional, 30 seconds)

1. Open the **Library** tab.
2. Choose **Import file**.
3. Pick [`seed/example-library.json`](./seed/example-library.json).
4. Review the preview (5 new papers, 0 duplicates) and press **Import 5**.

The seed adds five classic papers with varied statuses and notes, so the queue, filters, notes, and
citation tools all have something to act on. Edit the JSON if you want your own starter list; the
format is the same one **Export JSON** produces.

---

## 2. The core loop

1. **Search.** Type a title, author, or journal and press **Enter** (typing alone sends nothing).
   Use the filters for year, type, abstract/references/full-text availability, and a sort order.
2. **Open.** Click a result. References with a DOI can be followed **in the app** or out to
   **doi.org**. *Find related papers* is one opt-in request, cached for the session.
3. **Save.** **Save to library** starts every paper as *To read*.
4. **Triage.** In the Library, set *To read* / *Reading* / *Done*, add a note, and reorder the
   *To read* tab with the ↑/↓ buttons — that order is the reading queue.
5. **Use it.** Copy APA, Chicago, Harvard, IEEE, MLA, Vancouver, or BibTeX; export the library as
   `.bib` or JSON.

The five seed entries are already triaged this way: one *reading*, one *done*, three *to-read*.

---

## 3. Workflows

### Literature triage (about 30 minutes)

1. Search a topic, then turn on **Has abstract** and **Has references** so you only get records you can
   evaluate.
2. Sort by **Most cited** for the landmarks, or **Newest first** for current work.
3. Open and save 10–15 papers; do not write notes yet.
4. In **Library → To read**, use ↑/↓ to put the five you will actually read first at the top.
5. Set those to *Reading* as you start them, and mark *Done* when finished.

Result: a small, honest queue instead of 200 open tabs.

### Turn a seed list into a bibliography

1. Import `seed/example-library.json` (or your own export).
2. Update statuses while reading; add a one-line note to each paper you will cite
   ("why this matters").
3. Use **Copy citation** with your target style, or **Export BibTeX** for LaTeX/Pandoc.

The seed's notes are written as examples of that "why this matters" note.

### Move a reading list to another device

1. **Library → Copy share link**.
2. Send it. The recipient opens it and gets a review panel before anything is added.
3. They press **Add to library**.

Share links cap at 40 papers and include DOI, title, up to three authors, year, journal, type, and
status. Notes, added dates, and full reference lists are deliberately excluded. For an exact backup,
use **Export JSON** instead.

### Read on a phone / on the train

1. Open the app in a mobile browser and choose **Install app** / **Add to Home Screen**.
2. On small screens the main navigation moves to a fixed bottom bar; the theme picker stays in the
   header.
3. The installable app caches its shell and reads the IndexedDB library offline.

Offline coverage is the shell plus the saved library. Opening a paper's metadata, references, related
papers, or a PDF still needs a connection.

### Keep metadata fresh

Saved records are snapshots. The Library shows **Refresh N entries** when anything is older than 30
days; pressing it re-fetches those records one at a time through the request queue and stamps each with
"Metadata updated …". Nothing refreshes in the background.

### Paste straight into a paper

Paste a bare DOI (`10.1103/RevModPhys.20.367`), a `doi.org` URL, or a Crossref JSON blob into the
search box and press **Enter**. The app skips search and opens the detail view.

### Find a PDF

- If Crossref deposited a PDF link, the detail page shows **Open PDF** at no extra request.
- Otherwise, with `VITE_UNPAYWALL_EMAIL` set, press **Find open-access PDF** for one Unpaywall lookup
  per DOI. No email configured means the button is hidden; no open copy found means a short notice.

---

## 4. Keyboard, focus, and themes

- **Skip to content** is the first Tab stop.
- Search: **Enter** submits; **↑/↓** recall recent searches, and the draft returns when you pass the
  newest one.
- Result cards, reference links, and the queue arrows are buttons/links, so Tab and Enter/Space work
  throughout.
- Opening a paper moves focus to its title for screen readers.
- The theme picker offers **System, Light, Dark, Sepia, High contrast** and remembers the choice.
- Loading and empty states announce themselves; reference links have descriptive labels.

This is a structural and automated audit, not a substitute for testing with NVDA/VoiceOver on your own
setup.

---

## 5. Developer shortcuts

```bash
npm test          # Vitest unit tests
npm run test:e2e  # Playwright happy paths (uses installed Chrome)
npm run lint
npm run build
```

- **`/dev`** renders every component state (loading, empty, error/429, import review, citation tools,
  error log) on one page. The footer links it in development builds only.
- **Error log** — uncaught errors are recorded locally in development and never sent anywhere; the
  gallery shows the newest entries and can clear them.
- **Local data** — IndexedDB database `refs-workspace` (store `entries`), with `localStorage` used for
  the theme, search history, and as a fallback when IndexedDB is unavailable.

---

## 6. Troubleshooting

| Symptom | Cause and fix |
|---|---|
| "Crossref is busy right now (rate limit)…" | A 429 paused new requests for its `Retry-After` window; wait and press **Try again**. |
| Library is empty in another browser/profile | Data is local. Use **Export JSON** / **Import file**, or a share link for a reading list. |
| **Find open-access PDF** is missing | No deposited PDF link and no `VITE_UNPAYWALL_EMAIL` (or `VITE_CROSSREF_MAILTO`). |
| Shared link shows fewer papers than expected | Links cap at 40. Export JSON for a full backup. |
| Notes missing after a share-link import | Intentional: share links exclude notes. |
| Offline detail page fails | Only the shell and saved library are offline; metadata and references need the network. |
| Duplicate import warnings | Entries merge by DOI; the review step shows duplicates before applying anything. |

## 7. Good citizenship

A search costs one request, a paper costs one more, related papers and PDF lookups are opt-in, and all
Crossref calls go through a single-flight queue that follows `x-rate-limit-*` headers and
`Retry-After`. Keep `VITE_CROSSREF_MAILTO` set, avoid scripting repeated searches, and treat batch
features as explicit, rate-limited actions. Details: [`USAGE.md`](./USAGE.md).
