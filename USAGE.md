# API usage and limits

Refs Workspace talks to the public [Crossref REST API](https://api.crossref.org) directly from the
browser. There is no API key, no backend proxy, and no paid plan. That means the app lives inside
Crossref's shared rate limits, and this document explains those limits and exactly how the app behaves
when it reaches them.

## Crossref's limits

Limits changed in July 2026 and now depend on **request type** and **pool**:

| Request type | Public pool | Polite pool (`mailto`) |
|---|---|---|
| Single record (one DOI) | 5 requests/sec, concurrency 1 | 10 requests/sec, concurrency 3 |
| List/search (`/works?...`) | 1 request/sec, concurrency 1 | 3 requests/sec, concurrency 3 |

Requests beyond the limit receive **HTTP 429**. Concurrency limits mean long-running requests must
finish before another starts. Crossref returns the live values in headers:

- `x-rate-limit-limit` — requests allowed per interval
- `x-rate-limit-interval` — the interval (`1s`)
- `x-concurrency-limit` — simultaneous requests allowed
- `x-api-pool` — which pool served the request (`public-single`, `polite-array`, …)

The app does not read these headers today; the table above is the operating assumption.

## Joining the polite pool

Put an email in `.env.local` (copy `.env.example`):

```
VITE_CROSSREF_MAILTO=you@example.com
```

`src/lib/crossref.ts` appends it as `mailto=` to every request. This triples the list rate limit and
lets Crossref contact you if your traffic causes problems. It is per-email, so using many addresses to
dodge limits is explicitly discouraged by Crossref.

## What costs a request

| Action | Requests | Cache |
|---|---|---|
| Typing in the search box | 0 — the input is local until you press Enter | — |
| Submitting a search (Enter) | 1, once the query is 3+ characters | Search page cached by the full criteria |
| Changing a filter or sort | 1 per change, once the query is 3+ characters | Search page cached by the full criteria |
| Dismissing a search (under 3 chars, clearing) | 0 | — |
| Re-running a recent search | 0 if the criteria are still cached; otherwise 1 | `localStorage` list, plus the memory cache |
| "Load more" | 1 | Next offset cached |
| Opening a paper from results | 1 — the list record lacks references, so the detail view fetches the full record | Detail cached by DOI |
| Opening a paper from a reference or the library | 1 (unless already cached) | Detail cached by DOI |
| Clicking "Find related papers" | 1 per paper, only when clicked | Related results cached by DOI |
| Clicking between search and library | 0 | Returning to the same search URL is served from the search cache |
| Saving / removing / editing notes | 0 | `localStorage` only |
| Copying a citation / exporting BibTeX | 0 | Local formatting only |

Search requests use a `select` list (no references, no licenses) to keep responses small. Detail
requests fetch the full record because references are only available there.

## How the app reacts

### While you search

- **Enter submits; typing does not.** The input only updates local state, so a whole sentence costs one
  request instead of one per pause. The submitted query is what appears in the URL (`?q=…`).
- **3-character minimum.** Shorter queries cause no traffic at all.
- **Automatic abort.** Submitting a new search aborts the in-flight request with `AbortController`; the
  aborted request never reaches the UI. Crossref may still have counted a request that already left
  the browser.
- **Stale results are dropped.** Each request carries an incrementing id, and only the response for the
  latest query is applied, so out-of-order responses cannot overwrite newer results.
- **Old results are replaced by a skeleton** as soon as the submitted query changes, rather than
  showing results for a query you no longer have searched.
- **Repeated submissions are cached.** Re-submitting the same query (or navigating back to it) is
  served from memory without another request.
- **Filters and sort are part of the search.** Changing a year, type, availability toggle, or sort
  control immediately re-runs the current query with the new criteria; each change can cost one
  request. Changing a filter with a query shorter than 3 characters costs nothing.
- **Related papers are opt-in.** Opening a detail page does not fetch them; the "Find related papers"
  button issues one title/author search and caches the result by DOI for the session.

### Search filters

Filters are sent to Crossref as a single comma-separated `filter` parameter and AND-ed together:

| Control | Crossref filter |
|---|---|
| From year | `from-pub-date:YYYY-01-01` |
| To year | `until-pub-date:YYYY-12-31` |
| Publication type | `type:journal-article` (or another `/types` value) |
| Has abstract | `has-abstract:true` |
| Has references | `has-references:true` |
| Has full-text link | `has-full-text:true` |

"Has full-text link" means the deposited metadata includes a full-text `<resource>` link; it is not a
promise that the text is free to read. Every filter stays server-side, so adding one does not add a
request.

### While paging

- "Load more" sends one request for the next offset.
- Starting a new search aborts an unfinished "load more".
- Pages are merged and deduplicated by DOI, so overlapping Crossref offsets cannot produce duplicate
  cards.

### Caching

`src/lib/crossref.ts` keeps three in-memory maps:

- search pages keyed by the complete criteria (query, year range, type, sort, offset)
- works keyed by lowercase DOI
- related-paper results keyed by lowercase DOI

Each map is capped at **80 entries** and evicts the oldest insertion. Opening a paper again, or
returning to an earlier search page, is served from memory. The cache is per page load: a refresh or a
new tab starts empty, and nothing is persisted.

### On HTTP 429

The request layer converts it into a `CrossrefError` with status 429 and the message:

> Crossref is busy right now (rate limit). Wait a few seconds and try again.

The UI shows that message in place of results, with a **Try again** button. There is **no automatic
retry loop**, no exponential backoff, and no queue — this is deliberate, because retrying a
rate-limited request immediately makes the shared pool worse.

### On network or HTTP errors

- Network failure: "Could not reach Crossref. Check your connection and try again."
- Other non-2xx: "Crossref returned an error (`status`)."

Both use the same error panel and manual retry. A failed "load more" currently replaces the result list
with the error panel; **Try again** restarts from the first page rather than resuming at the failed
offset.

### User-triggered retry

**Try again** resets the view to a loading state and issues a fresh request. It also bypasses any cached
*failure* (failures are not cached), but a cached success for the same query/offset is still returned.

## What the app does not do

Honest gaps, useful to know before scaling usage:

- No request queue or serialization to stay at exactly 1/sec public or 3/sec polite.
- No use of `Retry-After`, even when Crossref sends it.
- No reading of `x-rate-limit-*` headers to adapt behavior.
- No server-side cache, shared cache, or persistence of Crossref data beyond saved library metadata.
- No request coalescing: two components asking for the same DOI in the same tick can issue two requests
  (rare in practice; the detail view is single-instance).
- Opening several references quickly can exceed the single-record concurrency limit.

For normal single-user browsing this is fine: a search costs one request, and each paper you open costs
at most one more.

## If you start seeing 429s

1. Set `VITE_CROSSREF_MAILTO` and restart the dev server.
2. Pause a few seconds and use **Try again** — do not reload repeatedly.
3. Avoid pressing Enter repeatedly or scripting the app; each submit costs one request. Typing alone
   no longer does.
4. If you build batch features (e.g. resolving every reference at once), add a serial queue limited to
   1 request/sec public or 3/sec polite, and honor `Retry-After` before retrying.
5. For sustained production traffic, Crossref expects you to use a backend proxy with caching (and
   Metadata Plus for higher limits); the browser-direct design here is for a single local user.

## Tuning points

| Setting | Location | Current value |
|---|---|---|
| Minimum query length | `src/hooks/useCrossrefSearch.ts` — `MIN_QUERY_LENGTH` | 3 |
| Page size | `src/lib/crossref.ts` — `PAGE_SIZE` | 20 |
| Cache size | `src/lib/crossref.ts` — `remember()` | 80 entries each |
| Polite-pool email | `.env.local` — `VITE_CROSSREF_MAILTO` | unset |
