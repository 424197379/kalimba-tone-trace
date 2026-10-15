# 2.4.27 source-backed mixed-meter card label

Local display-only stage. Interstellar now has a validated 3/4 → 4/4 card label;
this does not add a meter-based scheduler or extend melody-source approval.

## Automated and source acceptance

- Working and clean baseline-plus-patch `npm run check`: 940 runtime cases,
  939 passed and one optional private Summer source-fixture skipped, plus 15
  compiler checks and existing standalone/syntax checks passed.
- Independent final all-script gate with the actual Summer private source fixture:
  957/957 passed, zero failures or skips. A first attempt lost its executor
  transport and had no recoverable output; that attempt is not counted as pass.
- Independent reviewer actually re-viewed EOP5180 opening 3/4, quarter=90 and
  m42 4/4 symbols. No new approval of m42–43 notes or earlier voices follows.
- Compared with frozen 2.4.26, all 56 music timelines, speeds, backing data,
  app runtime, preferences, old archives, samples and formal server are frozen.
  Only two Interstellar display-metadata fields were added. All 56 generated
  records exactly equal source JSON; 36 canonical practice cards remain.
- New actual createSongCard VM regressions cover valid text, malformed/unsafe
  fallback, imports, source selection and unchanged speed/duration badges.
  Loop regression remains onset-based, including 1/6-beat triplet endpoints.
- Historical full-file and library snapshot hashes remain protected by exact
  reconstruction removing only the two new display fields. Existing published
  source hashes are not replaced with new expected values to hide differences.
- Actual AI prompt has executable wording checks separating a label from source
  timing, note approval and loop behavior. Formal HTTP/MIME and archive rejection
  checks remain part of the clean aggregate gate.

## Actual webpage follow-through

The original CUA request did not return, so that attempt remains unverified.
After the supported JavaScript-session reset, the existing library visibly
remained on 2.4.26. Its normal update button successfully updated directly to
2.4.28. In that combined acceptance pass the Interstellar card visibly showed
`3/4 → 4/4`, 290 notes and 90 BPM, with its earlier voice/register warning intact.
Ordinary 4/4 cards remained correct. No separate intermediate 2.4.27 installation
is claimed. See VERIFY_2.4.28.md for the actual playback and layout checks.
