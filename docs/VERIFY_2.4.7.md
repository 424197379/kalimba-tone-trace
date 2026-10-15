# v2.4.7 local preview verification

## Scope

Song cards previously estimated length with the score's historical
`defaultSpeedFactor`, while the player restores per-song speed or starts at
0.55x. For example, the corrected Rain theme card said approximately 32 seconds
although first practice uses approximately 53 seconds. The card now shows the actual starting/remembered multiplier and corresponding whole-song
practice duration, including known final silence and player ring-out, excluding
preparation and repeated loop cycles. Reading cards must not write preferences.

## Verification

Twelve new regressions compare library-card results against the actual app
initialization, speed, accompaniment-selection and ending-clock functions.
They cover all 36 first-practice songs and three remembered speeds per song,
17 legacy chord routes, custom/derived IDs, normalized malformed legacy
backing, source endings, unavailable/corrupt storage, rounding and refresh
handlers. Existing card tests and the related practice tests also pass.
Independent static review found no duration, sorting or support-badge regression.
The app runtime, preference implementation and all 53 song JSON files are
byte-identical to frozen v2.4.6.

In the private cloud browser, the normal update moved v2.4.6 to v2.4.7. Rain’s
card changed from the misleading old 32 seconds to 53 seconds at 0.55x.
After selecting 1.10x, returning to the library shows 27 seconds; a fresh
practice tab restores that speed and shows the same progress maximum.
A separate tab changing speed to 0.75x updates the already-open library to
39 seconds without a reload. Browser Back/pageshow restores the correct
0.65x / 45-second value in a separate check. The final saved preference is
0.55x. The private extra preview tabs were closed.

Stopping the private preview server and reloading retains v2.4.7 and the
53-second card from cache. Final 860×604 and 610×526 browser windows show the
compact badge without hiding the practice button. The actual copy/paste
flow returns all 4803 prompt characters exactly, including the new
same-edition provenance rule. These checks do not claim installed-phone
PWA behavior or global airplane-mode testing.

`npm run check` passes all 295 runtime and 13 compiler-evidence checks,
plus validation, transcription, suitability and syntax gates. Formal-server
HTTP/MIME coverage includes all 42 shell/sample resources and the exact
archive allowlist. A clean baseline patch replay is required for the portable
package; its file hashes are recorded in BUILD-INFO.json.

## Compiler experience

The source audit for 《让我们荡起双桨》 did not authorize changing its selected
vocal edition. An accessible piano edition has a numbered/staff representation
conflict at a held note, while its staff tie supports the existing three-beat
hold. Other ending/register differences remain edition conflicts. The skill and
actual external AI prompt now require inspecting the voice and tie endpoints,
recording the chosen reading, and avoiding both duplicate-source counting and
blanket preference for either notation format. No song data is changed by this
lesson. Raw previews and the scoped comparison remain private.

## Limits

No push/publication, source scan redistribution, phone PWA installation or
physical-kalimba verification. Structural and scheduler tests are distinct from
notation evidence and listening acceptance.
