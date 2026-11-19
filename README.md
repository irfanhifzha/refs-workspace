# Refs Workspace

A small workspace for learning web development while researching: search scholarly papers through the
[Crossref REST API](https://api.crossref.org), read their metadata and references, and keep a personal
reading list.

Planning and status live in [`plan.md`](./plan.md).

## What it does

- Search Crossref papers by title, author, or journal, with debounced requests and load-more paging.
- Open a paper for full metadata, abstract, and its deposited reference list; follow DOI-carrying
  references into the app or out to doi.org.
- Save papers to a local library, track `To read` / `Reading` / `Done`, and attach notes.
- Copy an approximate APA citation or BibTeX, and export the whole library as a `.bib` file.

No backend, no account, no runtime dependencies beyond React.

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
- List/search requests are rate-limited to 1/sec public, 3/sec polite — debounce searches.

## Stack

React 19, TypeScript, Vite, Oxlint, React Compiler (enabled via the Vite Babel plugin).
