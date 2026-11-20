# Refs Workspace

A small workspace for learning web development while researching: search scholarly papers through the
[Crossref REST API](https://api.crossref.org), read their metadata and references, and keep a personal
reading list.

New here? Read the workflow guide in [`guide.md`](./guide.md), which includes a seed library to import
as a starting point. Planning and status live in [`plan.md`](./plan.md).

## What it does

- Search Crossref papers by title, author, or journal on Enter, with load-more paging.
- Paste a DOI, a doi.org URL, or a Crossref JSON blob to jump straight to that paper.
- Narrow results by publication year, type, and metadata availability (abstract, references,
  full-text link), and sort by relevance, date, or citation count.
- Re-run recent searches from a local history (last 10), or recall them with the arrow keys in the
  search box.
- Open a paper for full metadata, abstract, and its deposited reference list; follow DOI-carrying
  references into the app or out to doi.org.
- Save papers to a library stored in IndexedDB (with a `localStorage` fallback), track `To read` /
  `Reading` / `Done`, attach notes, and reorder the `To read` queue by hand.
- Move a reading list between browsers by downloading the library as JSON or copying it to the
  clipboard, then importing from a file or a paste; notes, statuses, and queue order travel with it.
- Refresh stale metadata snapshots from Crossref on demand, with a "last updated" date per entry.
- Open a PDF when Crossref deposits a link, or look one up through Unpaywall.
- Copy APA, Chicago, Harvard, IEEE, MLA, or Vancouver citations (or BibTeX), and export the whole
  library as a `.bib` file.
- Ask for related papers on a detail page — one opt-in Crossref request, reranked by shared subject
  terms and citation overlap, cached by DOI.
- Seed the library from a BibTeX or RIS export. Imports — file or pasted JSON — are previewed
  before merging, with new and duplicate entries counted and deduplicated by DOI.
- Keep every view and every search criterion in the URL — `/` (with `?q=`), `/library`, and `/paper?doi=…` — so reloads,
  bookmarks, and back/forward navigation work.

No backend, no account, no runtime dependencies beyond React. It installs as a PWA with an offline
app shell, a bottom tab bar on small screens, and light, dark, sepia, and high-contrast themes.

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
- **Availability filters stay server-side.** Abstract, references, and full-text-link filters are
  Crossref `has-*` filters, so narrowing a search costs no extra requests.
- **One paper at a time.** A detail record is fetched only when a paper is opened, never preloaded in
  the background.
- **Requests are serialized.** One Crossref call is in flight at a time, spaced from the API's own
  `x-rate-limit-*` headers, so paging and related-paper requests cannot stack up.
- **Everything is cached in memory**, keyed by the full search criteria (query, year range, type,
  availability filters, sort) and DOI, so back/forward navigation, repeated queries, and re-opening a
  paper cost nothing.
- **Related papers are opt-in.** The detail page only searches for similar work when asked, uses a
  single title/author query, and caches the result by DOI.
- **PDF lookups are one request at most.** A deposited Crossref PDF link costs nothing extra; otherwise
  Unpaywall is queried only when you ask, once per DOI, and needs a contact email.
- **Metadata refresh is explicit.** Stale snapshots are re-fetched only when you press Refresh, one
  queued request per entry — never in the background.
- **The polite pool is expected.** Set `VITE_CROSSREF_MAILTO`; it raises the limit and gives Crossref
  a way to contact you instead of silently throttling.
- **Limits are never worked around.** No auto-retry loops, no parallel firehose, no rotating emails, no
  scraping. A 429 pauses new requests for its `Retry-After` window, then becomes a manual "Try again".
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
npm test         # Vitest unit tests
npm run test:e2e # Playwright happy path (needs Chrome)
npm run preview  # serve the build
```

## Desktop and Android (Tauri)

The same Vite build ships in a native window and on Android through Tauri 2. Each package has its
own webview storage, so the browser, desktop app, and phone do **not** share a library — move one
with **Export → Download JSON** / **Copy JSON** and **Import**.

```bash
npm run desktop:build         # Desktop installers (.dmg on macOS, .exe/.msi on Windows)
npm run android:build         # release APK (unsigned)
npm run android:build:windows # Windows arm64 APK, signed with the local debug key
```

Desktop output lands in `src-tauri/target/release/bundle/` (`dmg/` and `macos/` on macOS, `msi/` and `nsis/` on Windows). Android output lands
in `src-tauri/gen/android/app/build/outputs/apk/<abi>/<buildType>/`.

On Windows, the Tauri CLI needs Developer Mode to create the `jniLibs` symlink, so
`android:build:windows` reuses the compiled library and assembles the arm64 APK with Gradle. It signs
with `keystore.properties` when present (as in the release workflow) and otherwise falls back to
`~/.android/debug.keystore` for sideloading. Use your own keystore before distributing it. Both
routes need JDK 17, Android SDK platform 36 with build-tools 36, NDK `27.0.12077973`, the Android Rust
targets, and `NDK_HOME` pointing at the NDK:

```bash
rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android
export NDK_HOME="$ANDROID_HOME/ndk/27.0.12077973"
```

The standard `android:build` route produces an unsigned release APK; sign it with your own keystore
before distributing. The app skips service worker registration inside Tauri, where the wrapper
already serves the built assets.

## Releases

Push a version tag to build and publish a GitHub Release:

```bash
git tag v0.1.0
git push origin v0.1.0
```

`.github/workflows/release.yml` builds the macOS `.dmg`, Windows MSI/NSIS installers, and a signed arm64 APK, sets
the app version from the tag, and attaches both to the release. Android signing uses the repository
secrets `ANDROID_KEY_BASE64`, `ANDROID_KEY_ALIAS`, `ANDROID_KEYSTORE_PASSWORD`, and
`ANDROID_KEY_PASSWORD`; without them the APK is unsigned. The keystore and passwords are kept locally
under `src-tauri/gen/android/keystore/` (gitignored) — back that folder up, because losing it means
future APKs cannot update an installed app in place.

## Crossref notes

- No sign-up or API key needed; the browser can call the API directly (CORS is open).
- Add `mailto=you@example.com` to requests for the polite pool and higher rate limits.
- Set it locally with `VITE_CROSSREF_MAILTO` in `.env.local`.
- Open-access PDF lookups use [Unpaywall](https://unpaywall.org/products/api), which also requires a
  contact email: set `VITE_UNPAYWALL_EMAIL` (it falls back to `VITE_CROSSREF_MAILTO`).
- List/search requests are rate-limited to 1/sec public, 3/sec polite — submit searches deliberately
  (search runs on Enter, not while typing).

## Stack

React 19, TypeScript, Vite, Oxlint, React Compiler (enabled via the Vite Babel plugin), and Tauri 2
for the desktop and Android packages.

## Roadmap

Where the project could go next. This is a brainstorm, not a commitment — the ordering is loose, and
the point is to keep a menu of ideas that each teach something or solve a real annoyance. Anything
marked **[learning]** is a skill this project would pick up along the way. Every idea is also weighed
against the API-usage philosophy above: anything that multiplies requests needs caching and a queue
before it ships.

Recently shipped: Enter-to-search, URL routing for all three views, filters and sorting,
metadata-availability filters, local search history with arrow-key recall, pasting a DOI/URL/Crossref
JSON to open a paper, opt-in related papers reranked by subject overlap, JSON/BibTeX/RIS import with a
review step, reference-free library snapshots, a serialized request queue that follows Crossref's
rate-limit headers, a manual reading queue, PDF links via Crossref/Unpaywall, six citation styles, an
on-demand metadata refresh with per-entry dates, a local dev-only error log, a focus/ARIA accessibility
pass, shared design tokens, a `/dev` component gallery, an IndexedDB library with localStorage
migration/fallback, JSON export/import by file or paste, sepia/high-contrast themes, an installable PWA with
an offline shell and mobile bottom nav, Vitest and Playwright coverage, and a sharp-edged, grid-based
responsive layout verified at 320–1440 px with Lighthouse performance/accessibility at 100.

### Search and discovery

- **More filters** — publisher, open-access status, and language, with removable facet chips. Year,
  type, and metadata-availability filters are already in place.
- **Author and journal jumps** — click an author to search their works; click a journal to browse
  `GET /journals/<issn>/works`.
- **Saved searches** with a name (beyond the anonymous recent-history list), so recurring topics are
  one click away.
- **"Cited by" section** — Crossref can't do it, but OpenCitations and OpenAlex can. This was already
  a non-goal; it is the single biggest missing feature for research. **[learning: a second API, ID mapping]**
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
- **Bulk actions** — select many, set status, tag, export, or remove.
- **Near-duplicate detection** by normalized title+authors, so an import catches the same paper
  deposited under two DOIs. Exact DOI dedupe already applies on add and import.
- **Reading stats** — papers added per month, status breakdown, most-cited in the library, streaks.
  A tiny dashboard is a good excuse to practice derived state and charts.
- **Full-text search across notes** (local, simple `includes` or a small index) so notes stay usable
  past ~100 entries.
- **Drag to reorder** the reading queue, replacing the current up/down buttons.

### Citations and writing

- **CSL engine** — beyond the six hand-written styles, adopt Citation Style Language + style files to
  get the rest at once. **[learning: Citation Style Language]**
- **CSL-JSON / RIS / EndNote export** alongside `.bib`, plus per-collection exports.
- **Stable citation keys** (`feynman1965path`) — generated once, editable, collision-checked, and used
  in both BibTeX and copy-as-citation. Essential the moment you cite the same paper twice.
- **Copy as footnote / in-text citation** (`(Feynman & Wheeler, 1965)`) to round out the writing flow.
- **Citation formatting options** — et al. thresholds, page ranges, DOI/URL inclusion, "accessed" date.
- **Pandoc-friendly export** — a `references.bib` with keys that match what you'd write in Markdown.

### Data, offline, and continuity

- **Offline paper cache** — the service worker caches the shell and the library; extend it to cache
  opened work records so detail pages also work with no connection.
- **Cross-device sync** — the honest version needs a backend (or a sync service), which changes the
  whole no-backend premise. Options: export/import files, a user-owned sync folder, or GitHub Gist. Any
  of these is a big design decision, not a weekend tweak.

### Platform and reach

- **Browser extension** — "save this paper" from a DOI page or a journal site, adding to the same library.
- **Desktop wrapper** (Tauri/Electron) for a real local-first app; mostly a packaging exercise.
- **Small backend proxy** (only if the app ever leaves localhost) — server-side Crossref cache, shared
  polite-pool identity, and higher limits via Metadata Plus. **[learning: caching, deployment]**

### Engineering and craft

- **i18n seam** — even English-only, routing strings through a tiny dictionary makes a later
  translation cheap.
- **Assistive-technology testing** — a real NVDA/VoiceOver session with a keyboard-only user, beyond
  the current structural audit and automated checks.

### Deliberately not planned

- Accounts, cloud sync, and team features — they turn a single-user local tool into a product with
  auth, privacy, and operations problems.
- Hosting PDFs or full text — Crossref doesn't provide it, and the legal/bandwidth surface is huge.
- Hundreds of citation styles hand-written — use CSL if this becomes real.
- A component library or design system — the hand-written CSS is part of the learning goal.

**Picking the next one:** the highest value-per-effort items are "cited by" via OpenCitations, tags and
collections, and an offline cache for opened papers. The flashiest is the citation graph; the most
useful in daily research is probably "cited by" plus a stable citation key.
