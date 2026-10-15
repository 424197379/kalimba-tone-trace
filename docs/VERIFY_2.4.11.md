# v2.4.11 local preview verification

## Result

Practice now pauses on a delivered hidden/pagehide or non-running audio-context
state. Returning to visibility does not start it. The existing pause control
becomes Continue, preserving mode and position; an explicit click gives one
silent preparation before transport resumes. Historical held-note attacks are
not repeated. Paused seek, speed and A–B edits retain a valid Continue target.
Pending starts, note loads and stale gestures cannot restart a retired session.
The complete dry/wet output is retired, including suspended-context tails.
See `PRACTICE_LIFECYCLE_2.4.11.md` for policy, audio timings and boundaries.

All 53 source song JSON files are byte-identical to frozen 2.4.10. No melody,
backing, physical chord target or song order changes in this stage. The source
review gap ledger records unresolved editions without adopting their candidates;
compiler guidance and the actual AI prompt share that rule.

## Automated and independent checks

`npm run check`: 437 runtime tests plus 14 compiler evidence tests pass,
including 82 lifecycle probes using extracted production functions. Validation,
transcription, suitability and syntax checks also pass. Independent execution
includes two additional standalone scripts: 453 tests pass. The independent
review found no remaining static lifecycle/audio issue within this scope.

The lifecycle probes cover hidden/delayed-hidden/direct-render delivery,
non-running contexts, pending awaits, sample success/fallback generations,
complete dry/wet retirement, interrupted preparation, fixed resume position,
mode preservation, A–B/seek/speed/reset changes and stale pointer capture.
The formal Node server gate checks all 42 shell/sample HTTP resources and MIME,
the one public archive, and rejection of unrelated raw/private data. Python
visual preview is not used as proof of the release server's behavior.

## Actual own-cloud browser checks

Normal in-app update from 2.4.10 to 2.4.11 succeeded. Manual pause becomes
Continue. An active demo paused at displayed second 14 and the fresh preparation
held second 14; later playback completed normally. Pausing initial preparation
and continuing gave a fresh preparation at zero. Own-play continued into
“练习中”, retaining its mode. An enabled phrase paused at second 4; moving A
and changing speed to 0.60x kept Continue available at second 6; preparation
held that target, then own-play advanced within the phrase. Pause, loop exit
and keyboard seeking kept Continue available. Speed was restored to 0.55x.
Screenshots cover 607×524 and 860×404; all 21 keys remain in the board.

The actual copy button pasted 4,982 characters and the new rule that a pending
comparison is not an adopted edition. Temporary pasted text was cleared.
With the private server stopped, the cached practice page reloaded as 2.4.11,
with 21 keys, idle state and the working new Continue control after manual
pause. The server was restarted. Reload intentionally starts a fresh session;
this version does not persist playhead across closing/reloading a page.

### Cloud visibility limitation

Native selection of our blank tab and native window minimization were both
visually observed, but this managed Chromium still reported `document.hidden`
false and continued transport. Those actions therefore did not establish a
real hidden-event transition. No browser policy or security setting was changed.
The controlled lifecycle tests pass; genuine background delivery, phone calls,
lock-screen and OS audio interruption remain unverified on a real device.
Do not describe desktop tab/minimize observations as a passed background test.

## Package, run and remaining limits

The portable patch replays baseline
73041efc803b6c4f16046c8fc0ceaefc08fcc507; clean replay passes the same full
check before packaging. Source bytes are compared between working tree,
replay and ZIP, with BUILD-INFO hashes. Branch local/practice-focus remains at
zero new commits. Node.js 24/npm; no dependency installation: `npm start` and
`npm run check`. No push or publication, and no raw score scans in the package.

A long frame stall while visible with audio running can still dispatch overdue
attacks together. This version does not claim to solve that separate scheduling
case. Real acoustic fade quality, reference listening, physical kalimba playing
and actual phone PWA install/upgrade remain unverified. Existing score-source
limitations remain listed in the repository.
