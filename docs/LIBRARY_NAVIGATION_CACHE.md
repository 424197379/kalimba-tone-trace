# Fast, version-consistent library navigation

## v2.4.49 correction: redirected cached HTML

The v2.4.48 cache-first implementation was withdrawn after the public test site
failed with `ERR_FAILED` following an update. Its initial unit fixtures used
constructed `Response` objects, which cannot reproduce a fetched redirect chain.
The successful controlled timings below were therefore insufficient release
evidence. A plain local server returning HTML with status 200 also missed this
host-specific failure.

The public host returns `307 /index.html -> /` and
`307 /songs.html -> /songs`, preserving query parameters. Precache fetches follow
these redirects and Cache clones retain `Response.redirected === true`. Browser
navigation uses manual redirect handling. The [Fetch standard's HTTP fetch
algorithm](https://fetch.spec.whatwg.org/#http-fetch) rejects a service-worker
response with a multi-URL chain when the request redirect mode is not `follow`.

v2.4.49 reconstructs a redirected cached HTML response using its unchanged body,
status, status text, and headers. The new response has no redirect chain. This
conversion is limited to a successful, nonempty/nonpartial HTML response whose
final URL maps to the same exact same-origin shell page. A different page, origin,
or content type falls back to the network rather than being presented as the app.
The user's navigation URL and song selection remain unchanged.

An affected v48 page may fail before its Update button can load. After the
complete v49 shell and all samples install successfully, v49 alone calls
`skipWaiting` if a v48 cache exists. This is a bounded recovery exception: no
automatic page reload, no song/draft/Web Storage changes, and no automatic
activation for an ordinary v47 upgrade or a future release. Failed installation
does not activate the candidate or delete the current cache. On successful
activation, normal old-cache cleanup and `clients.claim` still run.

Verification before hosted-browser acceptance:

- 18 Service Worker tests passed; 220 focused navigation/library/draft tests
  passed.
- The new redirect regression uses a real local HTTP server returning 307, then
  the real Fetch implementation, rather than setting a property on a mock.
  It proves the cached clone is redirected and the returned v49 navigation
  response is not, with identical HTML and headers and preserved query state.
- Running that same regression against the unchanged faulty v48 worker fails
  on `redirected: true !== false`.
- Failed installation, failed sample download, ordinary v47 upgrades, future
  releases, wrong-origin/page/type redirects, and the slow-network optimization
  all have explicit coverage.

These checks establish the code correction. They are not a claim that the
already affected public browser has recovered. Acceptance must include the
existing affected profile without clearing site data, ordinary reload, and
practice/library/back navigation on the actual host.

## Problem and scope

The Change Song action already pauses playback and assigns the library URL
immediately. It does not wait for the version checker. Previously, the Service
Worker put a network-first request in front of every HTML navigation, including
the already precached library. A slow or pending response therefore blocked the
page even when its full installed shell was available offline.

The public v2.4.47 test site completed one cloud-browser Change Song observation
in approximately one second on 2026-10-13. The user's long delay was not reproduced
on that connection. The blocking mechanism was independently reproduced with
the production Service Worker and controlled browser API substitutes.

## Change in v2.4.48

- Return known HTML pages from the active worker's versioned cache first.
- Recognize exact scoped HTML routes, the scope root, and the extensionless
  aliases used by Sites, such as `/songs`.
- Keep `song`, `selected`, and update query parameters on the navigation request;
  they do not produce separate copies of static HTML in the cache.
- Do not use a waiting worker's cache, an unrelated cache, or a nested path with
  a coincidentally matching filename.
- Do not send an unknown route the practice index as an offline fallback.
- Do not intercept cross-origin or non-GET requests.
- If the shell entry is missing or unreadable, use the network. Successful known
  page recovery uses its canonical cache key; errors, 204, and partial responses
  do not replace working entries.

No background HTML refresh is introduced: an older shell must not silently mix
new server HTML with its cached JS. The update path is unchanged: version checks
use `no-store`, a new worker installs its complete shell, the existing update
control activates it, and the subsequent reload uses that new version's cache.
Automatic activation after all old clients close also continues to work.

This change does not alter audio, song storage, draft retention, or navigation
guards. A first visit or a failed/unavailable installation can still require
network access. This fix removes network waiting from navigation when the page's
installed cache entry is available; it does not guarantee instant cold starts.

## Verification

`node --test scripts/test-service-worker.mjs` passes 13 tests. These cover a
permanently hanging network without a timing race, aliases and query state,
active/waiting cache separation, activation/update reload, uncached version
checks, unknown and cross-origin routes, HTTP failure protection, canonical
recovery, cache errors, write lifetime, and existing archive precache assets.

Combined with `test-practice-navigation.mjs`, `test-library-flow-recovery.mjs`,
and `test-import-draft-retention.mjs`, the focused suite passes 215 tests.

A controlled execution of the before/after production Service Worker, with
the same installed library and a simulated 3,000 ms network response, measured:

- Before: 3,004.75 ms to navigation response, one network request.
- After: 0.26 ms to navigation response, zero network requests.

These are Node VM measurements using substitute Fetch and Cache APIs, not
real-browser rendering timings or measurements on the user's phone. They
demonstrate removal of the network dependency. Real test-site update and
navigation acceptance should be checked after deployment; this source change
does not itself publish a site.
