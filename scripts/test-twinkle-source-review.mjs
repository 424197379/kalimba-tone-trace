import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
const load = async id => JSON.parse(await readFile(new URL(`../data/songs/${id}.json`, import.meta.url), 'utf8'));
const melody = await load('xiao-xing-xing');
const arrangement = await load('xiao-xing-xing-chord');
// Source-pixel decisions from UkuStuff C/F/G7 staff edition, page 1. These
// explicit expectations cannot prove another edition or an unheard arrangement.
const phrases = ['CCGGAAG', 'FFEEDDC', 'GGFFEED', 'GGFFEED', 'CCGGAAG', 'FFEEDDC'];
const expected = phrases.flatMap((phrase, p) => [...phrase].map((note, i) => [`${note}5`, p * 8 + i, i === 6 ? 2 : 1]));
const changes = [[0,'C'],[4,'F'],[6,'C'],[8,'F'],[10,'C'],[12,'G7'],[14,'C'],[16,'C'],[18,'F'],[20,'C'],[22,'G7'],[24,'C'],[26,'F'],[28,'C'],[30,'G7'],[32,'C'],[36,'F'],[38,'C'],[40,'F'],[42,'C'],[44,'G7'],[46,'C']];
const vocabulary = { C: [0,4,7], F: [5,9,0], G7: [7,11,2,5] };
const pc = name => ({ C:0,D:2,E:4,F:5,G:7,A:9,B:11 }[name[0]]);
const intervals = changes.map(([from, chord], i) => ({ from, to: changes[i + 1]?.[0] ?? 48, chord }));
function chordCheck(event) {
  const matches = intervals.filter(c => event.beat < c.to && event.beat + event.duration > c.from);
  assert.equal(matches.length, 1, `event ${event.beat}: source chord boundary crossing`);
  for (const note of event.notes) assert.ok(vocabulary[matches[0].chord].includes(pc(note.name)), `${note.name}@${event.beat} outside ${matches[0].chord}`);
}

test('all 42 Twinkle melody attacks match the chosen full 12-bar staff at one global octave shift', () => {
  assert.deepEqual(melody.steps, expected);
  assert.deepEqual(arrangement.events.map(event => {
    const notes = event.notes.filter(note => note.role === 'melody');
    assert.equal(notes.length, 1);
    return [notes[0].name, event.beat, event.duration];
  }), expected);
  assert.equal(expected.at(-1)[1] + expected.at(-1)[2], 48);
  for(let i=1;i<expected.length;i++) assert.equal(expected[i-1][1]+expected[i-1][2],expected[i][1]);
});

test('the existing sparse 18-event 33-note support already fits every chosen source chord', () => {
  const events = arrangement.practiceAccompaniment.events;
  assert.equal(events.length, 18);
  assert.equal(events.reduce((sum,e)=>sum+e.notes.length,0),33);
  for (const event of events) {
    assert.equal(event.duration,.75);
    chordCheck(event);
    for (const note of event.notes) assert.ok(!expected.some(([name,beat,duration]) => name===note.name && event.beat<beat+duration && event.beat+event.duration>beat));
  }
  for(const [beat,note] of [[20,'C4'],[28,'G3'],[30,'G3']]) assert.deepEqual(events.find(e=>e.beat===beat).notes.map(n=>n.name),[note], 'source agreement does not justify filling the sparse candidate');
});

test('legacy conflicts remain identifiable and must not be promoted back into source-reviewed light support', () => {
  for (const beat of [20,28,30]) {
    const event=arrangement.events.find(e=>e.beat===beat);
    assert.throws(()=>chordCheck({...event,notes:event.notes.filter(n=>n.role!=='melody')}),/outside/);
  }
  assert.throws(()=>chordCheck(arrangement.autoAccompaniment.events.find(e=>e.beat===26)),/outside/);
  assert.equal(arrangement.practiceAccompaniment.events.some(e=>e.beat===26),false);
});
