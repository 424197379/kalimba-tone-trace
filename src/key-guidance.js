/**
 * Pure screen-key guidance. The caller owns transport time, preview length and
 * any display-pass bookkeeping; neither judgement nor audio state is changed.
 * Only explicitly supplied judgeLanes participate. Event intervals are [on,end).
 */
export function selectKeyGuidance(events, seconds, scaledBeatSeconds, options = {}) {
  const empty = () => ({ keys: [], heldEventIds: [], nextEventIds: [], darkEvents: [] });
  if (!Array.isArray(events) || !Number.isFinite(seconds)
    || !Number.isFinite(scaledBeatSeconds) || scaledBeatSeconds <= 0) return empty();

  const { range = null, previewSeconds = 1.2 } = options && typeof options === "object" ? options : {};
  const preview = Number.isFinite(previewSeconds) && previewSeconds > 0 ? previewSeconds : 0;
  if (range != null && (!Number.isFinite(range.startBeat) || range.startBeat < 0
    || !Number.isFinite(range.endBeat) || range.endBeat <= range.startBeat)) return empty();
  const loopEnd = range == null ? Infinity : range.endBeat * scaledBeatSeconds;
  if (range != null && (!Number.isFinite(loopEnd) || seconds >= loopEnd)) return empty();

  // Work on owned records so frozen inputs and unsorted imported arrays are safe.
  // An unmarked accompaniment event must not supply a cue or shorten a dark gap.
  const eligible = [];
  events.forEach((event, index) => {
    if (!event || !Number.isFinite(event.beat) || event.beat < 0
      || !Number.isFinite(event.duration) || event.duration <= 0
      || !Array.isArray(event.judgeLanes)
      || (range != null && (event.beat < range.startBeat || event.beat >= range.endBeat))) return;
    const lanes = [...new Set(event.judgeLanes.filter(lane => Number.isSafeInteger(lane) && lane >= 0))];
    if (!lanes.length) return;
    const onset = event.beat * scaledBeatSeconds;
    const naturalEnd = (event.beat + event.duration) * scaledBeatSeconds;
    const end = Math.min(naturalEnd, loopEnd);
    if (!Number.isFinite(onset) || !Number.isFinite(naturalEnd) || end <= onset) return;
    const id = typeof event.id === "string" || Number.isFinite(event.id) ? event.id : index;
    eligible.push({ id, beat: event.beat, lanes, onset, end, index });
  });
  eligible.sort((a, b) => a.onset - b.onset || a.index - b.index);

  // Simultaneous events share an onset, but retain their individual identities.
  const groups = [];
  for (const event of eligible) {
    if (!groups.length || groups.at(-1).onset !== event.onset) {
      groups.push({ onset: event.onset, events: [] });
    }
    groups.at(-1).events.push(event);
  }
  const held = eligible.filter(event => event.onset <= seconds && seconds < event.end);
  const upcoming = groups.filter(group => group.onset > seconds).slice(0, held.length ? 1 : 2);
  const roles = new Map(held.map(event => [event, "primary"]));
  const next = [];
  for (let index = 0; index < upcoming.length; index++) {
    const group = upcoming[index];
    // Check each onset independently; do not pull a far second event into view.
    if (group.onset - seconds > preview) break;
    for (const event of group.events) {
      roles.set(event, held.length || index > 0 ? "secondary" : "primary");
      next.push(event);
    }
  }

  const keys = new Map();
  const firstSelectedOnset = new Map();
  const darkEvents = [];
  const phasePriority = { "secondary-edge": 0, "preview-outline": 1, "active-fill": 2, "pre-onset-dark": 3 };
  for (let groupIndex = 0; groupIndex < groups.length; groupIndex++) {
    const group = groups[groupIndex];
    const previous = groups[groupIndex - 1];
    const darkLead = Math.min(0.06, previous ? (group.onset - previous.onset) * 0.2 : Infinity);
    for (const event of group.events) {
      const role = roles.get(event);
      if (!role) continue;
      const heldNow = event.onset <= seconds && seconds < event.end;
      const dark = !heldNow && seconds >= event.onset - darkLead;
      const phase = heldNow ? "active-fill" : dark ? "pre-onset-dark"
        : role === "primary" || held.length ? "preview-outline" : "secondary-edge";
      if (dark) {
        darkEvents.push({
          id: event.id, beat: event.beat, lanes: [...event.lanes],
          startBeat: event.beat - darkLead / scaledBeatSeconds
        });
      }
      for (const lane of event.lanes) {
        const existing = keys.get(lane);
        if (existing) {
          if (role === "primary") existing.role = "primary";
          // A real repeated strike may briefly darken its own still-held key.
          // Other held lanes remain filled, and one tied event never retriggers.
          if (phasePriority[phase] > phasePriority[existing.phase]) existing.phase = phase;
          existing.held ||= heldNow;
          // Sorted sources imply a future event at a later onset is a real
          // pending re-strike. Past overlapping holds or simultaneous duplicate
          // lanes alone must not announce another strike.
          existing.repeat ||= !heldNow && event.onset > firstSelectedOnset.get(lane);
          existing.eventIds.push(event.id);
        } else {
          firstSelectedOnset.set(lane, event.onset);
          keys.set(lane, {
            lane, phase, role, held: heldNow, repeat: false,
            eventIds: [event.id]
          });
        }
      }
    }
  }

  return {
    keys: [...keys.values()].sort((a, b) => a.lane - b.lane),
    heldEventIds: held.map(event => event.id),
    nextEventIds: next.map(event => event.id),
    darkEvents
  };
}
