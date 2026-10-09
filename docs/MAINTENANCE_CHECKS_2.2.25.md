# Maintenance checks — 2.2.25

## Scope

Reviewed the practice runtime, audio and input paths, song normalization and
local storage, library UI, PWA update/cache paths, local HTTP server and
validation/build entrypoints. This remains a static frontend with a local
development server; no production backend, framework or dependency was added.
CSS, built-in song data, audio samples and audio synthesis/processing are
unchanged. This review does not certify that every possible defect is absent.

## Reproduced problems and fixes

| Before | After |
| --- | --- |
| Fresh storage is converted from `null` to zero, displaying 72% key width. Denied key-width storage aborts startup with zero keys. | Missing preferences use the documented 100% width. Unavailable storage does not block practice or width controls. |
| At 4 seconds, changing 0.55x to 1.1x moves the score from `translateX(72.08px)` to `translateX(-88.08px)`. | Speed changes preserve the musical beat in paused and playing states. |
| Start demo with sample requests delayed, then reset; releasing downloads starts the cancelled demo. | A request generation prevents stale asynchronous starts after reset, version changes or a newer practice/demo request. |
| A stored record with steps but no id throws on `endsWith` and prevents the whole library from loading. | Invalid records are skipped for display; save/delete preserve unrelated raw records, including unknown schema versions. Unreadable storage cannot be overwritten by import. |
| Deletion quota errors escape the UI handler. | Failed writes leave storage intact and display a retryable error. |
| `?song=__proto__` selects an inherited property and crashes startup. | The library dictionary has no prototype; unknown links use the existing default song. |
| Numeric `degree: 0` is rejected; durations near a minute boundary can display `1:60`. | Numeric zero is treated as a rest; minutes and seconds use one rounded total. |
| A successful offline page can be overwritten by a 503 navigation response. Background writes have no event lifetime or rejection handler. | Only successful complete responses are cached. Writes extend the event lifetime; cache write failures preserve network responses. Existing navigation/asset strategies are retained. |
| The LAN development server returns `.git/config`, `AI_PROJECT.md` and private scripts with status 200. | Only application entry files and `src`/`assets` are served. Private, hidden, escaping and non-public symlink targets are denied. GET/HEAD remain supported. |

## Refactoring

- Reuse song base-id and version-ranking rules between practice and library.
- Sort each library version group once.
- Compute event end beats and note lane spans when selecting a song, rather
  than allocating arrays and rescanning them on every frame.
- Read note-track width once per render, outside the per-note DOM writes.
  Instrumented chord rendering reduced this read from 25 times to once.
- Expose local server construction for isolated HTTP tests, while retaining
  `npm start` and port 8123 for normal use.
- Declare the existing `src` JavaScript as ES modules for Node tests, while
  keeping the root local server in CommonJS. No runtime conversion is needed.

## Verification

- Ten automated runtime tests cover imports, numeric rests, invalid records,
  duplicate ids, raw data preservation, quota errors, local HTTP routes,
  offline-page preservation, worker lifetimes and failed cache writes.
- Twenty-seven browser checks cover denied storage, speed changes, invalid
  links, delayed demo cancellation, search, import/reload, duration rounding,
  failed deletion and subsequent successful deletion. No page errors.
- The prior mobile progress test passes all 74 assertions on the new runtime.
- All 53 normalized built-in versions compare equal to v2.2.24. The audio
  implementation from context creation through sample and synth playback is
  textually identical after line-ending normalization.
- At 1280 × 800, 844 × 390 and 390 × 844, old/new chord note geometry and markup
  compare equal at the same paused position and stored key width. Both mobile
  layout screenshots compare byte-for-byte equal after disabling transitions;
  the desktop initial-state screenshot also compares equal. CSS is unchanged.
- Complete old/new birthday demos at 1.4x produce the same sequence: 46
  sample starts in the melody version (including its enabled accompaniment),
  and 52 in the chord version. All 21 samples decode in each run. Maximum
  relative onset differences are about 51 ms / 32 ms across separate browser
  runs; these are browser scheduling measurements, not a latency guarantee.
- A real Service Worker at a fixture origin was installed, followed by a 503
  navigation and offline reload. All 36 grouped song cards remained available;
  cached sample bytes, 21 keys and 75% progress seeking worked offline.
- An existing v2.2.24 local cache upgraded to v2.2.25 using the song-library
  refresh button. Offline reload still rendered 21 keys; only the new cache
  remained. Song/build/check commands passed with 53 versions, 7127 notes,
  zero errors and 154 existing warnings; transcription and suitability
  regressions also passed.

Run `npm run check` for song, runtime and syntax checks. Browser scenarios use
isolated contexts and private fixture scripts; they do not modify a user's
existing browser songs. Physical HarmonyOS/iOS/Android devices and subjective
listening on a real kalimba have not been tested.
