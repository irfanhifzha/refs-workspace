# Refs Workspace

A small workspace for learning web development while researching: search scholarly papers through the
[Crossref REST API](https://api.crossref.org), read their metadata and references, and keep a personal
reading list.

Planning and status live in [`plan.md`](./plan.md).

## What it does

- Search Crossref papers by title, author, or journal on Enter, with load-more paging.
- Open a paper for full metadata, abstract, and its deposited reference list; follow DOI-carrying
  references into the app or out to doi.org.
- Save papers to a local library, track `To read` / `Reading` / `Done`, and attach notes.
- Copy an approximate APA citation or BibTeX, and export the whole library as a `.bib` file.
- Back up and restore the library as JSON, merging imports by DOI.
- Keep every view in the URL — `/` (with `?q=`), `/library`, and `/paper?doi=…` — so reloads,
  bookmarks, and back/forward navigation work.

No backend, no account, no runtime dependencies beyond React.

## API usage philosophy

This is a small, single-user workspace — not a crawler, a bulk harvester, or a public service. The
goal is to fetch only what a person is actively looking at, stay comfortably inside Crossref's shared
rate limits, and not be the traffic that makes the API worse for everyone else. Information without
causing concern.

What that means in practice:

- **Search runs on Enter, not on every keystroke.** Typing, backspacing, and clearing the box cost zero
  requests; one deliberate search costs one.
- **List responses fetch metadata only.** The `select` parameter excludes references, licenses, and
  links, keeping each response small.
- **One paper at a time.** A detail record is fetched only when a paper is opened, never preloaded in
  the background.
- **Everything is cached in memory**, keyed by `query|offset` and DOI, so back/forward navigation,
  repeated queries, and re-opening a paper cost nothing.
- **The polite pool is expected.** Set `VITE_CROSSREF_MAILTO`; it raises the limit and gives Crossref
  a way to contact you instead of silently throttling.
- **Limits are never worked around.** No auto-retry loops, no parallel firehose, no rotating emails, no
  scraping. A 429 becomes a manual "Try again".
- **The library stores only what it needs.** Snapshots drop deposited reference lists; they are
  re-fetched from Crossref only when that paper's detail screen is opened.

For future features, the same budget applies: anything that needs more than a request or two per
screen, or that runs in the background, needs a queue and caching first, and batch operations
(resolving every reference, building a citation graph, fetching "cited by" for a whole library) must
stay explicit, opt-in, and rate-limited.

## Scripts

```bash
npm install
npm run dev      # dev server
npm run build    # typecheck + production build
npm run lint     # oxlint
npm run preview  # serve the build
```

## Crossref notes

- No sign-up or API key needed; the browser can call the API directly (CORS is open).
- Add `mailto=you@example.com` to requests for the polite pool and higher rate limits.
- Set it locally with `VITE_CROSSREF_MAILTO` in `.env.local`.
- List/search requests are rate-limited to 1/sec public, 3/sec polite — submit searches deliberately
  (search runs on Enter, not while typing).

## Stack

React 19, TypeScript, Vite, Oxlint, React Compiler (enabled via the Vite Babel plugin).

## Roadmap

Where the project could go next. This is a brainstorm, not a commitment — the ordering is loose, and
the point is to keep a menu of ideas that each teach something or solve a real annoyance. Anything
marked **[learning]** is a skill this project would pick up along the way. Every idea is also weighed
against the API-usage philosophy above: anything that multiplies requests needs caching and a queue
before it ships.

Recently shipped: Enter-to-search, URL routing for all three views, JSON library import/export, and
reference-free library snapshots (references are re-fetched on the detail screen).

### Near-term (the obvious next steps)

- **Tests that pay for themselves** — Vitest for `normalizeWork`, `parseYear`, `formatApa`, `toBibtex`,
  and `jats.ts`, plus one Playwright happy path (search → open → save → reload). **[learning: unit vs. e2e]**
- **Verify the responsive + Lighthouse targets** that `plan.md` still marks unverified, and fix what
  fails. Boring, but the README currently promises behavior nobody has measured.
- **Request queue** — serialize Crossref calls at the polite-pool rate, honor `Retry-After`, and read
  `x-rate-limit-*` headers instead of hard-coding limits. This unlocks every batch feature below.
  **[learning: scheduling, backoff]**
- **Paste a DOI → open the paper.** One input that accepts a DOI, a doi.org URL, or a Crossref JSON
  blob. Cheap, and the fastest path into the detail view.
- **RIS/BibTeX import** so an existing Zotero or Mendeley export can seed the library (JSON backup and
  restore already exist). **[learning: format parsing]**
- **Import review step** — preview which imported entries are new or duplicate before applying them,
  instead of merging immediately.

### Search and discovery

- **Filters** on the existing `/works` endpoint: year range, type (article, book chapter, proceedings),
  publisher, and open-access status. Then facet chips so filters are visible and removable.
- **Sorting**: relevance (default), newest, oldest, most cited (`is-referenced-by-count`).
- **Author and journal jumps** — click an author to search their works; click a journal to browse
  `GET /journals/<issn>/works`.
- **Saved searches** with a name, so recurring topics are one click away.
- **Search history** with keyboard recall, stored locally.
- **"Cited by" section** — Crossref can't do it, but OpenCitations and OpenAlex can. This was already
  a non-goal; it is the single biggest missing feature for research. **[learning: a second API, ID mapping]**
- **Related / similar papers** — score by shared references, shared authors, or shared subject terms.
  A purely local computation over records already fetched is a nice constrained problem.
- **Frontier / citation graph view** — a small canvas or SVG graph of papers and reference edges,
  clickable to navigate. Fun, visual, and hard in the right way. **[learning: data viz]**
- **Fallback sources** when Crossref has no abstract or references: OpenAlex, Semantic Scholar, arXiv,
  or Europe PMC. Show *which* source answered.
- **Preprint ↔ published matching** — detect when a DOI is a preprint version of a journal article and
  link the pair.

### Reading, notes, and library

- **Tags / collections** — multiple named lists per paper, not just one status. "Thesis", "Methods",
  "To cite in chapter 2".
- **Markdown notes** with a preview toggle, and a per-reference note ("why this matters").
  **[learning: safe markdown rendering]**
- **Highlights/quotes** — save short quoted snippets with the page number, since we don't host PDFs.
- **Reading queue** — drag-to-reorder the `To read` list, or sort it by priority/added date.
- **Bulk actions** — select many, set status, tag, export, or remove.
- **Duplicate detection** by DOI and by normalized title+authors, so an import doesn't double everything.
- **Reading stats** — papers added per month, status breakdown, most-cited in the library, streaks.
  A tiny dashboard is a good excuse to practice derived state and charts.
- **Full-text search across notes** (local, simple `includes` or a small index) so notes stay usable
  past ~100 entries.
- **PDF links** — resolve an open-access PDF URL (Unpaywall/OpenAlex) and open it in a new tab. We
  don't host PDFs, but linking to a legal copy is a big quality-of-life win.

### Citations and writing

- **More styles** — Chicago, MLA, IEEE, Vancouver, Harvard. Either hand-write two more, or adopt a CSL
  engine + style files and get all of them at once. **[learning: Citation Style Language]**
- **CSL-JSON / RIS / EndNote export** alongside `.bib`, plus per-collection exports.
- **Stable citation keys** (`feynman1965path`) — generated once, editable, collision-checked, and used
  in both BibTeX and copy-as-citation. Essential the moment you cite the same paper twice.
- **Copy as footnote / in-text citation** (`(Feynman & Wheeler, 1965)`) to round out the writing flow.
- **Citation formatting options** — et al. thresholds, page ranges, DOI/URL inclusion, "accessed" date.
- **Pandoc-friendly export** — a `references.bib` with keys that match what you'd write in Markdown.

### Data, offline, and continuity

- **IndexedDB instead of `localStorage`** — removes the size ceiling and the synchronous-write jank;
  the `storage.ts` seam already exists for exactly this swap. **[learning: async storage, migrations]**
- **Offline-first PWA** — service worker caches the shell and the last N work records; the library is
  readable with no connection. Already a non-goal for the MVP, but a natural next chapter.
- **Snapshot refresh** — re-fetch saved works older than N days so metadata, citation counts, and
  references don't silently rot. Show a "last updated" date per entry.
- **Cross-device sync** — the honest version needs a backend (or a sync service), which changes the
  whole no-backend premise. Options: export/import files, a user-owned sync folder, or GitHub Gist. Any
  of these is a big design decision, not a weekend tweak.

### Platform and reach

- **Browser extension** — "save this paper" from a DOI page or a journal site, adding to the same library.
- **Desktop wrapper** (Tauri/Electron) for a real local-first app; mostly a packaging exercise.
- **Mobile-friendly library** — an installable PWA with a bottom nav, which makes "read later on the
  train" actually work.
- **Peer / shared library links** — encode a small library in a URL hash for sharing a reading list.
- **Small backend proxy** (only if the app ever leaves localhost) — server-side Crossref cache, shared
  polite-pool identity, and higher limits via Metadata Plus. **[learning: caching, deployment]**

### Engineering and craft

- **Error boundary + telemetry-lite** — capture client errors in dev to a local log rather than a
  third-party service.
- **Accessibility pass** — keyboard navigation for results and references, focus management when the
  detail view opens, and screen-reader checks on the loading/empty/error states.
- **Design tokens** — move the ad-hoc CSS values into a few custom properties so themes (light/dark,
  high contrast, maybe sepia for long reading sessions) are a variable swap.
- **i18n seam** — even English-only, routing strings through a tiny dictionary makes a later
  translation cheap.
- **Storybook-less component gallery** maybe not; but a `/dev` route that renders every component in
  every state (loading, empty, error, 429) would make visual review much faster.

### Deliberately not planned

- Accounts, cloud sync, and team features — they turn a single-user local tool into a product with
  auth, privacy, and operations problems.
- Hosting PDFs or full text — Crossref doesn't provide it, and the legal/bandwidth surface is huge.
- Hundreds of citation styles hand-written — use CSL if this becomes real.
- A component library or design system — the hand-written CSS is part of the learning goal.

**Picking the next one:** the highest value-per-effort items are URL routing, library import/export,
and the Crossref request queue. The flashiest is the citation graph; the most useful in daily research
is probably "cited by" plus a stable citation key.
