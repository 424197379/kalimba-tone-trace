import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {getSongReviewNotice,shouldExpandSongReviewNotice} from '../src/song-store.js';
const hash = v => createHash('sha256').update(v).digest('hex');
const raw=JSON.parse(await readFile(new URL('../data/songs/bluebird.json',import.meta.url),'utf8'));
const scope=raw.sourceFeatures.sourceReview.currentScopeReview;
test('Bluebird keeps all 82 old tuples and can reconstruct original metadata bytes',()=>{
 assert.equal(raw.steps.length,82);
 assert.equal(hash(JSON.stringify(raw.steps)),'3427f55b1b2d8a1bfcab50edabc5b2310c469e5c2aed96a56333957d9b80de2b');
 const old={...raw.sourceFeatures.sourceReview.historicalSongMetadata,steps:raw.steps};
 // Restore original property order: steps preceded schemaVersion.
 const ordered={};for(const [key,value] of Object.entries(old)){if(key==='schemaVersion')ordered.steps=raw.steps;if(key!=='steps')ordered[key]=value;}
 assert.equal(hash(JSON.stringify(ordered,null,2)+'\n'),'aaaf6290337fa76f6c5924164992ed812566930a575ab533526afea6328f5463');
 assert.equal(raw.bpm,146);assert.equal(raw.defaultSpeedFactor,.8);
});
test('comparison preview is not silently adopted or used to naturalize an unidentified voice',()=>{
 assert.equal(scope.changedTupleCount,0);
 assert.equal(scope.inspectedComparison.printedQuarterBpm,144);
 assert.match(scope.inspectedComparison.scope,/not adopted melody/);
 assert.match(scope.chromaticBoundary,/inner chord pitch/);
 assert.match(scope.chromaticBoundary,/cannot alone establish/);
 assert.match(scope.requiredEvidence,/main voice/);
 assert.equal(raw.sourceFeatures.sourceTotalBeats,undefined);
});
test('unverified simplification is visible instead of an unsupported beginner promise',()=>{
 assert.match(raw.title,/待核简化版/);assert.doesNotMatch(raw.hint,/新手副歌简化练习版/);
 assert.match(getSongReviewNotice(raw),/待核简化版.*82.*来源.*未.*确认/);
 assert.equal(shouldExpandSongReviewNotice(raw),true);
});

test('historical source sibling remains byte-frozen',async()=>{
 const bytes=await readFile(new URL('../data/songs/bluebird-chord.json',import.meta.url));
 assert.equal(hash(bytes),'0adaf36fa7ad1d68d3fcc3a9c02c219b42171389fb1713cb9addd9f56d228b9b');
});
