import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {hasMatchingPracticeMelody} from '../src/song-store.js';
const hash = value => createHash('sha256').update(value).digest('hex');
const bytes = await readFile(new URL('../data/songs/zhu-zhu-xia-theme.json',import.meta.url));
const song = JSON.parse(bytes);
const siblingBytes = await readFile(new URL('../data/songs/zhu-zhu-xia-theme-chord.json',import.meta.url));
const current = song.sourceFeatures.sourceReview.currentScopeReview;
const part = (s,a,b) => s.steps.filter(([,beat])=>beat>=a&&beat<b);
function checkEnding(s) {assert.deepEqual(part(s,35.75,40),[['D5',35.75,4.25]]);}
function checkPhrase(s) {
  assert.deepEqual(part(s,4,6),[['D4',4,.25],['D4',4.25,.75],['A4',5,.5],['D4',5.5,.25],['D4',5.75,1.25]]);
  assert.deepEqual(part(s,20,22),[['D4',20,.25],['D4',20.25,.5],['D4',20.75,.25],['A4',21,.5],['D4',21.5,.25],['D4',21.75,1.25]]);
  assert.equal(s.steps.find(([,beat])=>beat===27.75)[0],'B4');
}
test('Pig theme retains all 76 existing tuples and reconstructs the complete old JSON',()=>{
 assert.equal(song.steps.length,76);
 assert.equal(hash(JSON.stringify(song.steps)),'2029214c61b51acc3ec7736d9702dee9c24a50495946a9878038cb9622702058');
 const old=structuredClone(song);old.sourceFeatures=old.sourceFeatures.sourceReview.historicalReviewNotes;
 assert.equal(hash(JSON.stringify(old,null,2)+'\n'),'787ee9e79b44ff36749103695da421a25a89e693ccec6ea6cf41725c072c7f29');
 assert.equal(hash(siblingBytes),'a73e734e50f5cb5e878cce202c324acce34dfbd10892f9dabd51384b6d750b30');
 assert.equal(hasMatchingPracticeMelody(song,JSON.parse(siblingBytes)),true,'compatibility alone does not approve harmony');
});
test('source extent is 40 with the final cross-bar 4.25-beat tie intact',()=>{
 checkEnding(song);assert.equal(song.sourceFeatures.sourceTotalBeats,40);
 assert.equal(Math.max(...song.steps.map(([,beat,duration])=>beat+duration)),40);
 assert.equal(current.tieChainCount,13);assert.equal(current.tieContinuationCount,14);
 const split=structuredClone(song);split.steps.splice(split.steps.length-1,1,['D5',35.75,.25],['D5',36,2],['D5',38,2]);
 assert.throws(()=>checkEnding(split));
});
test('similar later phrases preserve their source-specific rhythm and pitch',()=>{
 checkPhrase(song);
 const copied=structuredClone(song);copied.steps=copied.steps.filter(([,b])=>b<20||b>=22).concat(part(song,4,6).map(([n,b,d])=>[n,b+16,d])).sort((a,b)=>a[1]-b[1]);
 assert.throws(()=>checkPhrase(copied));
});
test('four reviewed rests are melody-only and do not mute other source voices',()=>{
 assert.deepEqual(current.melodyOnlyRestWindows,[[7,1],[15,1],[23,1],[31,.25]]);
 for(const [from,duration] of current.melodyOnlyRestWindows) assert.ok(!song.steps.some(([,b,d])=>Math.min(b+d,from+duration)-Math.max(b,from)>1e-9));
 assert.equal(song.rhythm,undefined);
 assert.ok(current.scopeLimits.some(s=>s.includes('do not assert')));
});
test('source metadata retains printed key, meter, tempo and conditional scope without naturalization',()=>{
 assert.equal(song.bpm,68);assert.equal(song.beatsPerMeasure,2);assert.equal(song.key,'C');
 assert.equal(song.sourceFeatures.transpositionSemitones,0);
 assert.deepEqual(song.sourceFeatures.sourceMeasureRange,[16,35]);
 assert.equal(song.sourceFeatures.suitability.status,'conditional');
 assert.equal(current.changedTupleCount,0);assert.equal(current.sameEditionFormats,true);
 assert.ok(song.sourceFeatures.unsupported.some(s=>s.includes('没有升降音替换')));
 assert.ok(current.scopeLimits.some(s=>s.includes('V2 harmony')));
});
