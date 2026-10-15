# 2.4.31 declared source-ending validation

## Reproduced defect and bounded correction

- The actual private Daylily support candidate retains the reviewed183 melody
 attacks, ending at191, selected source extent192 and the final rest[191,192).
 The frozen2.4.30 validator rejects that rest because it uses only the main
 event endpoint. The supported external-import representation already accepts
 that complete source boundary; source inspection remains a separate proof.
- The original validator is taken from the frozen30 ZIP, SHA
 `5a1beb119edd558ce78b5b5708882829ec087c54bee4365eca1d9b3a4f85e43a`.
 A first private snapshot accidentally captured the in-progress new script;
 its reproduction check caught that and it was replaced with verified ZIP bytes.
 No old-validator claim relies on the mislabeled snapshot.
- Valid finite nonnegative sourceTotalBeats now bounds V2 rhythm windows.
 Main events, both V2 backing layers, rest windows and pickup cannot exceed an
 explicit declaration. Invalid/short declarations are errors, not silently
 enlarged or coerced. Absent metadata retains the legacy event-end fallback.
- Raw timing checks run before main-array early exits, so malformed notes or
 missing arrays cannot hide an independently invalid source declaration.
 Sum overflow is rejected; valid fractional timing is retained without rounding.
- V1 practiceAccompaniment is now explicitly rejected like auto/rhythm because
 the runtime only normalizes these playback layers for V2. Source metadata with
 the same name remains documentation. This does not introduce V1 backing.
- Existing silent/hold, melody overlap and backing-rest rules remain enforced.
 The old last-note/bar-alignment review warning is deliberately unchanged;
 no true rest is deleted or note stretched merely to remove a warning.

## Tests and frozen boundaries

-19 new source-extent regressions plus3 existing fractional checks:22/22 pass.
 Running the new19 against the actual pre-fix validator produces15 failures
 and4 passes, establishing that the tests detect the repaired behavior.
- Current corpus:56 songs/7180 steps/zero errors/606 review warnings, exactly
 the same per-file validation results as before. All56 music JSON, generated
 library, archives, app/audio runtime, preferences, report modules, samples,
 layout and official server remain byte-identical to30.
- Actual unchanged private candidate now validates with zero errors and its
 existing191-beat alignment warning. That is structural acceptance only, not
 adoption of the candidate or a new listening claim.
- Related endpoint/import/report/Daylily run:139 cases,138 pass and one existing
 optional private source-fixture skip. Support/compatibility group45/45 passes.
- Working and clean baseline-plus-patch aggregates pass:1088 runtime cases,
 1085 passed and3 explicit optional private-source skips;15 compiler checks
 passed, plus standalone/syntax checks. Independent all-scripts-plus-compiler
 gate with all three actual private fixtures:1105/1105,zero failures or skips.
 Final validator SHA is de45533d67d395c285823f3dcff631f9772c194b735a7be91aac7db653c3152e.

## Actual own-cloud webpage check

- Normal update30→31 completed. Actual Copy Prompt returned6351 characters,
 exactly matching the rendered textarea's current value, including the explicit
 instruction not to delete a true tail rest to satisfy an old event-end checker.
- Returning to Farewell and using demonstration preparation then pause worked.
 The runtime and music are unchanged; this is a daily-control smoke check, not
 a repeated whole-song listening or per-note acoustic measurement.
- The private interactive host is Python loopback. Official Node routes/MIME
 and internal-archive rejection are independently tested in the aggregate gate.
 No new public service, push, publication or deployment occurred.

See VALIDATOR_SOURCE_EXTENT.md. No score or backing is changed by this release;
source fidelity, actual sound balance and physical ease are separate judgments.
