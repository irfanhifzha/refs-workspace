# Plan — Refs Workspace

A small web app for learning web development **and** for researching: search scholarly papers via the
Crossref API, read their metadata, follow their references, and keep a personal library of what you're
reading.

Status: MVP implemented. M1–M4 complete, M5 mostly complete. Still unverified: the rendered layout at
320/768/1440 px, Lighthouse scores, and a click-through of search → paper → library. M1's temporary
probe was skipped in favor of building the real search UI in M2.

---

## 1. Goal

Build a single-page app where I can:

1. Search Crossref for papers by title / author / journal.
2. Open a paper and see its title, authors, year, journal, DOI, and **its reference list**.
3. Jump from a reference to the referenced paper (when a DOI is deposited).
4. Save papers to a local "library" and mark them as `to-read`, `reading`, `done`.
5. Copy / export a citation (plain text + BibTeX) for anything I've saved.

The second goal is learning: each milestone should teach one web-dev skill (data fetching, typed API
models, state, routing, persistence, testing) rather than piling on libraries.

## 2. Who it's for

Just me, running locally. Single user, no accounts, no backend for the MVP.

## 3. MVP scope (in)

- Crossref search with pagination ("load more").
- Paper detail view with metadata + reference list.
- Personal library persisted in the browser.
- Reading status + a short note per saved paper.
- Citation copy (APA-ish plain text, BibTeX).

## 4. Non-goals (for now)

- User accounts, sync, or a database.
- Full-text search or PDF hosting (Crossref has neither).
- "Cited by" lists — Crossref's REST API doesn't expose them; that would need OpenCitations/OpenAlex later.
- SSR, offline PWA, or mobile layout polish beyond "doesn't break".
- Abstract rendering beyond stripping JATS tags (many records have no abstract anyway).

## 5. Stack

Already in the repo: **React 19 + TypeScript + Vite + Oxlint**, React Compiler enabled.

Decisions:

| Concern | Choice | Why |
|---|---|---|
| Data fetching | plain `fetch` + a custom hook | no dependency; teaches AbortController, debounce, error states |
| Routing | start with state-based views; add React Router only if URLs matter | keep MVP dependency-free |
| Persistence | `localStorage` behind a small `storage.ts` module | simple, swappable for IndexedDB later |
| Styling | plain CSS in `src/*.css` | matches the template |
| Dates/citations | hand-written formatters | citation styles are a learning exercise; `citation-js` is the fallback if it gets ugly |

No new runtime dependencies expected for the MVP.

## 6. Design, performance, and responsiveness

Non-functional requirements, applied from M1 — not a polish phase at the end.

### Look

- Minimalist: one column, generous whitespace, no nested cards, no gradients, no animation library.
- System font stack, two weights max, fluid headings with `clamp()`.
- One accent color; light/dark already handled by `prefers-color-scheme` in `index.css`.
- No UI kit or icon package; inline SVG only where an icon is genuinely needed.

### Render performance budget

- Route JS < 100 kB gzipped (the current shell is ~69 kB with React 19).
- No runtime deps for fetching, state, or routing. React Router only at M6, with lazy routes.
- `select` on every Crossref call; list views never fetch full work records.
- In-memory `Map` cache for search pages and opened works, so back-navigation is instant.
- No `useEffect` waterfalls: detail fetch begins on click, not after the list re-renders.
- Reserve space for cards (fixed min-height) and set image dimensions to keep CLS < 0.05.
- Targets: Lighthouse mobile performance >= 95, LCP < 1.5 s on a local prod build.

### Responsive rules

- Mobile-first; verify at 320, 375, 768, 1024 and 1440 px.
- Single column below 768 px; at most two columns for results above 1024 px, text <= 70ch.
- Tap targets >= 44x44 px; form inputs at least 16 px font (prevents iOS zoom).
- Long titles and DOIs wrap (`overflow-wrap: anywhere`), and flex/grid children get `min-width: 0`.
- No horizontal scrolling at any width; toolbars wrap instead of clipping.

## 7. Data model

```ts
// Crossref returns arrays for these fields because a work can have several.
type CrossrefWork = {
  DOI: string
  title?: string[]
  author?: { given?: string; family?: string; name?: string }[]
  editor?: { given?: string; family?: string }[]
  'container-title'?: string[]
  'short-container-title'?: string[]
  issued?: { 'date-parts': number[][] }
  published?: { 'date-parts': number[][] }
  type?: string
  publisher?: string
  volume?: string
  issue?: string
  page?: string
  URL?: string
  abstract?: string            // often JATS XML
  ISSN?: string[]
  'is-referenced-by-count'?: number
  'reference-count'?: number
  reference?: CrossrefReference[]
}

type CrossrefReference = {
  key?: string
  DOI?: string
  'article-title'?: string
  'journal-title'?: string
  author?: string
  year?: string
  volume?: string
  'first-page'?: string
  unstructured?: string        // free-text reference, no structured fields
}

// App-local, not from Crossref
type LibraryEntry = {
  doi: string
  work: CrossrefWork          // snapshot, so the library works offline
  status: 'to-read' | 'reading' | 'done'
  note: string
  addedAt: string             // ISO
}
```

Key mapping functions live in `src/lib/crossref.ts`:

- `normalizeWork(raw)` — guarantee `title[0]`, sort authors, parse `issued` to a year.
- `parseYear(work)` — `issued.date-parts[0][0]` with fallbacks.
- `authorLine(work)` — "Feynman, R. P.; Wheeler, J. A."
- `formatApa(work)` / `toBibtex(work)` — exporters.

## 8. Crossref integration contract

Base URL: `https://api.crossref.org`. CORS is open (`access-control-allow-origin: *`), so the browser
can call it directly. Verified against the live API on 2026-11-18.

### Endpoints used

| Use | Request |
|---|---|
| Search | `GET /works?query.bibliographic=<q>&rows=20&offset=0&select=...&mailto=...` |
| One paper | `GET /works/<doi>` (DOI must be `encodeURIComponent`-ed) |
| Journal browse (stretch) | `GET /journals/<issn>/works` |

### Always send

- `select=DOI,title,author,container-title,issued,type,URL,abstract,reference,reference-count,is-referenced-by-count,publisher,volume,issue,page` — the default record is several KB of licenses/links per item.
- `mailto=<my email>` via `VITE_CROSSREF_MAILTO` — polite pool, 3× the list rate limit. Never commit the real address; document it in `.env.example`.

### Rate limits (current, July 2026 rules)

| Request type | Public | Polite (`mailto`) |
|---|---|---|
| Single DOI | 5/sec, concurrency 1 | 10/sec, concurrency 3 |
| List / search | 1/sec, concurrency 1 | 3/sec, concurrency 3 |

Rules for the client:

- Debounce the search box (~400 ms).
- One in-flight request; abort the previous with `AbortController` on new input.
- On `429`: show "Crossref is busy, retrying shortly", wait ≥1 s (honor `Retry-After` if present), never retry in a tight loop.
- Read `x-rate-limit-limit` / `x-rate-limit-interval` / `x-api-pool` from response headers in dev to confirm which pool is being used.

### Response shape

```jsonc
{ "status": "ok",
  "message": { "total-results": 128433, "items-per-page": 20, "items": [ /* CrossrefWork */ ] } }
```

Detail responses put the work directly in `message`.

### Known quirks to handle

- `title`, `container-title`, `author`, `issued` are arrays.
- `abstract` may be JATS XML (`<jats:p>…`) — strip tags before rendering.
- Reference entries are only present if the publisher deposited them; check `reference-count` and show
  an empty state otherwise. Some entries have only `unstructured`.
- Papers without a DOI in a reference can't be linked — render them as plain text.
- Some titles contain HTML entities/tags — decode and sanitize via text nodes (never `dangerouslySetInnerHTML`).

## 9. Screens and structure

```
src/
  main.tsx
  App.tsx                 // view switch: search | paper | library
  lib/
    crossref.ts           // fetch wrapper, params, types, normalizers
    citations.ts          // APA + BibTeX
    storage.ts            // localStorage read/write with versioning
    jats.ts               // strip JATS tags -> plain text
  hooks/
    useCrossrefSearch.ts  // query -> { items, total, loading, error, loadMore }
    useWork.ts            // doi -> work detail
    useLibrary.ts         // entries, add/remove, setStatus, setNote
  components/
    SearchBar.tsx
    WorkList.tsx / WorkCard.tsx
    WorkDetail.tsx
    ReferenceList.tsx
    CitationActions.tsx
    LibraryView.tsx
```

Screens:

1. **Search** — search bar, result count, cards (title, authors, year, journal, citation count), "load more".
2. **Paper** — metadata block, citation actions, reference list with DOI links, "save to library".
3. **Library** — tabs by status, note editing, remove, export all as BibTeX.

State stays in `App.tsx` for navigation plus the library hook; nothing global until it hurts.

## 10. Milestones

Each milestone ends in something runnable and is a deliberate learning step.

### M1 — API spike (½ day)
- [x] `lib/crossref.ts` with typed `searchWorks()` and `getWork()`.
- [x] ~~Temporary button in `App.tsx`~~ — superseded by the M2 search UI.
- [x] Corrected `select` field name to `references-count` (Crossref rejects `reference-count` with a 400) and verified CORS + polite-pool `mailto` against the live API.
- Learn: typed fetch wrappers, reading headers, JSON shape.

### M2 — Search UI (1 day)
- [x] `useCrossrefSearch` with debounce + abort.
- [x] `SearchBar`, `WorkList`, loading / empty / error / 429 states.
- [x] "Load more" via `offset`, dedupe by DOI.
- Learn: effects, cleanups, race conditions.

### M3 — Paper detail + references (1 day)
- [x] `useWork(doi)`; clicking a card opens detail.
- [x] `ReferenceList` with DOI badges and internal navigation.
- [x] JATS stripping; empty state when the record has no deposited references.
- Learn: conditional rendering, list keys, URL state.

### M4 — Library persistence (1 day)
- [x] `useLibrary` + `storage.ts` with a schema version.
- [x] Save/remove, status control, note field with debounced save.
- [x] Library screen with tabs and BibTeX export of saved entries.
- Learn: localStorage pitfalls, migrations, controlled inputs.

### M5 — Citations + polish (½–1 day)
- [x] `formatApa` and `toBibtex`, copy-to-clipboard with feedback.
- [ ] Responsive pass at 320/768/1440 px — CSS is in place, not visually verified yet.
- [x] Error boundary + `aria-live` for result counts.
- [ ] Measure the prod build: Lighthouse mobile perf/a11y >= 95, CLS < 0.05.
- Learn: formatting edge cases, accessibility, performance measurement.

### M6 — Stretch (optional)
- [ ] URL routing (`/paper/:doi`, `/library`) with React Router.
- [ ] Related papers via shared references.
- [ ] Cited-by via OpenCitations if it proves worthwhile.
- [ ] Minimal tests with Vitest for normalizers and citation formatters.

## 11. Risks / open questions

- **Rate limits** are low for list queries. Mitigation: debounce, cache search results in memory, keep `mailto` set. If the app ever leaves localhost, add a tiny proxy with caching.
- **Reference coverage is uneven.** Some publishers deposit nothing. Decide whether to show a "no references deposited" note or fall back to OpenCitations for that DOI (M6).
- **Citation formatting scope** can balloon (hundreds of styles). MVP: one APA-ish style + BibTeX, clearly labeled "approximate".
- **localStorage limits** (~5 MB) are fine for a few hundred works with `select`-trimmed records; revisit if snapshots include abstracts/references.
- **Should the library snapshot full work records or just DOIs?** Snapshot for offline reading, but that stores references too — consider stripping `reference` when saving.

## 12. Definition of done (MVP)

- Searching "feynman path integral" returns results in under a second on a warm connection.
- Opening a paper shows its title, authors, year, DOI, and reference list; DOI-carrying references are clickable.
- Saved papers survive a reload and show their status and notes.
- Copy APA and Copy BibTeX produce usable output for at least 10 varied records (book chapter, article, no author, no date).
- No unhandled promise rejections, no `429` retry storms, empty/error states exist on every screen.
- Usable from 320 px to 1440 px with no horizontal scroll and >= 44 px tap targets.
- Lighthouse mobile: performance and accessibility >= 95 on the production build; CLS < 0.05.
- Back-navigation to a previously opened paper renders from cache without a network request.
- `npm run build` and `npm run lint` pass.
