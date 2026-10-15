# Foreground playback recovery — 2.4.48

## Verified defect and scope

The previous runtime used the same 150 ms limit for stale audio and transport
failure. A deterministic probe of the unchanged runtime, in own-play with
accompaniment disabled, rendered at 0.49 seconds and then delivered the next
frame 200 ms later. It paused at 0.49 before the 0.50-second attack. The same
probe paused after 500 ms and 999.999 ms delays. No input event was required.
Compact CSS hides the metadata row containing the only old status message.
The combination could therefore look like an unexplained frozen board.

This is a reproduced software mechanism, not proof of the cause of an individual
reported browser incident. No timing trace or application exception was captured
from that incident. In the app, song elapsed text and progress fill are written
by the same render function; a separately observed continuing timer must not be
assumed to be the song elapsed field. A separate own-cloud, no-input long-song
run completed normally; spontaneous failure was not reproduced in that run.

## Recovery policy

The existing audio freshness deadline remains **150 ms from the nominal onset**.
An expired attack is consumed without starting its sample or synth fallback.
This check runs before dispatch and again after asynchronous sample resolution.
It cannot stop an otherwise healthy score. A dropped attack is not replayed on
the next frame or on Continue; an intentional seek or repeat may recover it.

A foreground frame gap **below one second** now advances to the current score
position. Key guidance, falling notes and progress use that same position.
Expired attacks are dropped rather than delivered in a stale catch-up burst;
still-fresh attacks retain the existing scheduling behavior. In very dense
passages, several still-fresh attacks can occur together. This is not a
lookahead or sample-accurate scheduler and does not claim to reconstruct
musical spacing lost during a browser delay.

A frame gap **of one second or more** pauses at the last completed visible
checkpoint only if it crosses an unshown onset that is also at least 150 ms old.
Long gaps within a rest or an already-dispatched held note do not trigger that
condition. A new attack less than 150 ms old stays eligible. The one-second
threshold is an explicit product recovery policy, not a measured browser limit
or an assertion about a particular user's device.

Hidden-page and interrupted-audio handling still pause. Every paused session
now has a visible, live-announced board notice with its status and a Continue
instruction, including compact, rotated and fullscreen practice layouts. The
notice clears during restart, reset and prepared Continue. It does not consume
board layout space or cover the controls or keys.

An exception during an animation frame is reported to the developer console,
then stops playback and shows a recoverable display-error pause. Pausing does
not recursively call the failed renderer. The saved checkpoint is committed
only after a successful complete render. This prevents the prior failure mode
where one exception could terminate the sole RAF chain while transport flags
continued to indicate running. It is a defensive exception-path regression,
not evidence that such an exception caused the reported incident.

## Regression coverage

Production-function tests cover:

- Original 200/500/999.999 ms silent-practice reproduction, now continuing
- Dense melody/backing gaps at 100/250/500/999.999/1000/1000.001 ms
- Inclusive 149.999/150/150.001 ms audio freshness boundary without false pauses
- Aged sample success and synth fallback with healthy foreground frames
- Exact actual mocked Web Audio source starts; no expired catch-up starts
- Real long interruption, both A/B boundaries, rest/hold exceptions, Continue
- Progress seeking, direct render/scheduler entry, and pre-RAF control changes
- Notice visibility and clearing for manual, hidden, audio and material-gap pause
- A synthetic renderer exception, preserved checkpoint and successful retry
- Next key-guidance/progress alignment after an intentionally skipped attack
  at 0.35x and 1.40x

Historical stall tests whose stated purpose is a material interruption now
inject a full one-second gap. Tests around the unchanged 150 ms sound deadline
retain their original boundary values and now require that only the late sound
is discarded. No tests are skipped to accommodate the new recovery policy.
These controlled checks do not establish physical-device performance or audio
latency. Final aggregate and real-browser results are recorded separately.
