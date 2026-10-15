# 2.4.42 — Retain the current tab's raw import draft

Private own-cloud local preview. No new commit, push or public deployment.
The preceding2.4.41 delivery remains separately frozen.

## User-visible change

Previously, an unsaved JSON draft disappeared when the user chose a song and
returned through Change song to a new library document. Updating the app also
replaces its document. Saved songs were unaffected; browser Back could sometimes
recover an old form, so this is not described as universally irreversible loss.

The library now retains the complete raw text in a separate sessionStorage key.
It restores the current tab's draft, visibly opens the editor and explains that
restoration is not proof the score has never been saved. Raw invalid JSON,
whitespace, duplicate fields and unsupported notes are retained without parsing,
trimming, normalization, uploads or writes to the saved-song collection.

Failed or unverified draft storage blocks the app's own practice navigation and
update reload, preserving the editor and selection. Browser-initiated leaving
requests its standard warning where applicable; forced closure and browser
policies are not under absolute app control. A successful song save and a failed
subsequent draft cleanup are reported separately, avoiding duplicate-save advice.

History restoration tracks actual unsynchronized input independently of native
form replay. A newer draft or completed cleanup cannot be silently replaced by
an older history form. Conflicting real drafts remain distinct, including edits
made during restoration. A Save binds the raw input at the click, not another
document's draft that appears while the transaction waits. Completion advances
its own revision so a late history callback cannot undo a committed result while
the brief busy feedback remains visible. See `IMPORT_DRAFT_RETENTION.md`.

This protects pages running the new code, not already-open old pages. Before the
first upgrade, copy any unsaved draft in an older page. Closing a tab or clearing
browser storage is not promised as durable backup; keep important source files.

## Music and import semantics

All57 raw song records, all13 internal archives, all21 MP3 samples and generated
song bytes are unchanged from2.4.41. Playback, loop, speed and accompaniment
implementation are unchanged. The song-store change is only the app version;
the7049-character AI prompt, importer validation and compiler skill remain intact.
Restoring raw text does not approve its music or bypass whole-input validation.
No old music-version recovery control is introduced.

The36 mono cards and existing selected-scope evidence retain their precise
meaning. Source-image musical review and executable structural checks are still
separate; this release does not certify any additional melody or backing.

## Reproducible gates

-59 new complete-entry draft/update-handler regressions pass. The identical suite
 against the frozen41 entries gives3 passes and56 failures. Subsequent targeted
 negative controls also expose the intermediate native-history ordering and
 transaction-completion failures, rather than only detecting a missing feature.
- An independent reviewer exercised13 additional state-order models, including
 native form replay before/after pageshow, real conflicting input, read failures,
 duplicate restoration and completed-save callbacks. All13 pass on final code.
- Final independent offline `npm run check`:1724/1724 runtime and16/16 compiler,
 zero failures or skips. All nine actual private source-evidence gates pass.
- A fresh clean baseline replay independently runs the complete portable check:
 1715 runtime passes, nine explicit missing-private-source skips, zero failures;
 16 compiler passes. Private source fixtures and images are intentionally not
 distributed. Those skips are not claimed as image review by a recipient.
- Song validation reports57 records/7633 steps, zero errors and607 existing
 warnings. Full transcription, suitability and syntax gates complete.
- Offline process settings disable unrelated npm update/audit/funding traffic.
 Earlier incomplete or failed development runs are not counted as final passes.
 Legacy focused test harnesses now provide the new entry dependencies and real
 input events; original source-text, storage, selection and filter assertions
 remain, with the intended draft-restoration expansion made explicit.

## Actual own-cloud browser and official server

Final normal2.4.42 in cloud Chromium passed: raw A -> practice -> new library B ->
edit B -> Back twice retains full B, including whitespace; duplicate-events input
is rejected at both locations while raw input and local count remain unchanged;
a valid synthetic score saves once, clears its draft and is directly playable.
Pause held the visible position across reads more than10 seconds apart and
Continue returned to running. Change song returned with empty draft. The synthetic
score was then deleted through its named confirmation. At the observed narrow
viewport, clientWidth and scrollWidth were both600: no horizontal overflow.

A separate non-instrumented synthetic-data application copy completed an actual
PWA update9.42.2 ->9.42.3 through the normal update button. Raw Unicode/whitespace
was identical afterward, with the existing local synthetic song retained. It also
passed newer-draft Back recovery and successful-save/Back cleanup. These are QA
version labels, not public releases. The handler matched the final implementation
apart from one later independently tested guard for a real dirty draft whose text
happens to equal an older synchronized value; final production then passed the
normal browser checks above. Diagnostic trace code and temporary copies are not
included in this release.

The formal `npm start` server was separately started and accessed through real
HTTP in its shell environment. All22 app-shell resources and21 samples returned
200, the expected MIME and exact current bytes. Private documents and the internal
Shengshengman archive returned403. Python/private preview results are not used as
an equivalent formal-server claim.

Final normal browser state is Shengshengman at0.65x, loopoff, no backing, stopped;
all original song data is untouched. Visual transport checks do not constitute
subjective listening or physical-instrument acceptance.

## Frozen delivery

328 source files passed the final clean and independent gates. Only this verify
report was added afterward, making329 delivered source files. The cumulative
binary patch is against73041efc803b6c4f16046c8fc0ceaefc08fcc507; a separate fresh
baseline replay and ZIP contents match the final repository source byte for byte.
The archive excludes source images, private source fixtures, browser traces and
all temporary QA application copies. Final artifact hashes are recorded alongside
the delivery outside the archive; previous frozen deliveries remain available
internally without adding a user-facing old-edition restoration entry.
