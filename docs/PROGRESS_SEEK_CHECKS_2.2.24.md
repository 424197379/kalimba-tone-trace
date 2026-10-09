# Progress seek checks — 2.2.24

## Reproduction and fix

In a 390 × 844 portrait viewport, enter the practice page from the library
(`index.html?fromLibrary=1`). The page rotates 90 degrees clockwise. In 2.2.23,
tapping 25%, 50%, and 75% along the visible progress track selects 50% each time.
The handler uses `clientX` and the rotated bounding rectangle's width, which
measures the track's thickness rather than its length.

The handler now uses `clientY`, rectangle top and height for the existing
`software-landscape` layout. Native landscape and desktop keep the horizontal
mapping. No playback or cache strategy changes are required.

## Browser verification

Chromium browser tests passed 74 position and playback assertions across:

- 390 × 844, mobile touch, automatically rotated practice layout.
- 844 × 390, mobile touch, native landscape.
- 1280 × 800, desktop mouse and keyboard.

Tests exercise touch taps or mouse clicks at seven positions, continuous
forward and backward dragging, captured movement outside the rail, clamping
at both ends, release and paused-position stability, touch cancellation,
Home/End/ArrowRight, and seeking during practice and demo playback followed
by continued playback and pause. No page errors occurred.

Touch drags use Chromium's input protocol rather than synthetic DOM pointer
events. Each dispatched movement allows a frame to deliver coalesced input
before checking the rendered position. Active playback checks allow for the
clock continuing to advance.

An existing v2.2.23 local Service Worker was upgraded using the library's
refresh button. The page reported v2.2.24, selected 75% correctly online,
and selected 25% correctly after an offline reload. Only the v2.2.24 cache
remained. Song validation, library generation and `npm run check` passed:
53 versions, 7127 notes, zero errors and 154 existing song-data warnings;
15 transcription regressions and suitability checks passed.

This is browser mobile emulation; physical HarmonyOS/iOS/Android devices have
not been tested. On an installed PWA, use the refresh button in the song
library to update to v2.2.24 before checking the fix.
