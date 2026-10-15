import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { DISPLAY_KEYS, readSongFiles } from "./build-song-library.mjs";
import { analyzeSongTiming } from "./song-report-analysis.mjs";
import { getCustomSongs, getPracticeSongs, getPracticeSongId, getSongArchiveDownload,
  getSongLibrary, getSongAccompanimentProvider, hasMatchingPracticeMelody,
  parseImportedSongs, saveCustomSongs } from "../src/song-store.js";
import { getPracticeTotalBeats } from "../src/practice-loop.js";
import { SONG_SPEED_STORAGE_KEY, readSongSpeed } from "../src/practice-preferences.js";
import { checkTranscriptionEvidence } from "../skills/kalimba-tone-trace-compiler/scripts/check-transcription-evidence.mjs";

const read = path => readFile(new URL(`../${path}`, import.meta.url));
const hash = value => createHash("sha256").update(value).digest("hex");
const song = JSON.parse(await read("data/songs/xuan-cao-hua.json"));
const archivePath = "data/archives/xuan-cao-hua-v2.4.27.json";
const archiveBytes = await read(archivePath), archive = JSON.parse(archiveBytes);
const siblingBytes = await read("data/songs/xuan-cao-hua-chord.json"), sibling = JSON.parse(siblingBytes);
const archiveHash = "e9cd5a2a7ec4912fb208983a279b4f40f05eb524422c2bf5914e77fc4f1e9798";
const siblingHash = "82f43ef27df396c1af0235750a5ea070dbed7997ab821b956d0a1e829a705b57";
const tupleHash = "cae668aa9911d5ce06d4d3d69dae051ccb270631402a23d9eb72c7472fac22cd";
const sourceFixtureHash = "0d53881e02367af6758d767b07d61aa47366ddbe91497a7116cd73598dc6cb09";
const review = song.sourceFeatures.sourceReview, current = review.currentScopeReview;
const rests = [14,17,35,38,47,53,59,71,77,83,110,113,131,134,143,158,161,179,182,191];
const route = [...Array.from({length:32},(_,i)=>17+i),...Array.from({length:16},(_,i)=>17+i),...Array.from({length:16},(_,i)=>49+i)];

// Frozen from the pre-edit, separately entered source-expectations record,
// never from production at test time. Each entry: editorially counted printed
// measure, attack count, SHA-256 of that bar's absolute [pitch,beat,duration]
// tuples. The source author and independent pixel reader checked the chosen
// edition; hashes protect those decisions, not independently read notation.
const barDecisions = [
  [17,3,"179c75de48fbb9d203406b2fbda3acae753b77e1fd67059c06e2ab6607edfc59"],
  [18,3,"45a90a6a8d24787316b23c32ae3589cf8c68aceedd6505d38b82f193b891a0fc"],
  [19,4,"8ae4efaa3011b8c8b6f8eaa968ea4e4e4e0f402a3477a3eb5a5de154441ea8be"],
  [20,1,"4e23b4f21c87333c0eeb356275744f22dee12c3d2425ec1b475e6d2d7fadb53f"],
  [21,3,"74e007098955dea70d7898b5ad71c9f1ea8cb36b5272b74b9530f200ab551b73"],
  [22,3,"c8cbd04b5b1263d317a7bfccb2cc582769eb0911cc9c177cc97ba6447ebc662d"],
  [23,4,"1fb7a2bc00746db904a8324a271861bce4aed73f5b5c1f86be856e9f0912c21e"],
  [24,3,"d36e6563775f22a4e49649f18bff4daed0c616947e7c02a78c360ed772831e46"],
  [25,3,"2db3d85e59ffb4e8179f672082312ae854940fe9a2eb535e87aeddba33d9c422"],
  [26,3,"2f0b5b3d46315bbb1e8aa715bd95901d6c483692b470e62db16453f487c5a9d1"],
  [27,4,"ae3a85341496ae9cac07dfeeae82fdb36dd9d996758517f3866467cdd48cf233"],
  [28,1,"2a8691b42c68104081e665c94c9f0004f96510bf2aaaf1cc1aa7d1a139f0d59a"],
  [29,3,"be7822c6f87fe00fc8f3d1d49fabfb01689ec995fe97b9a2a2e90fe64266b9fe"],
  [30,4,"f9aa84fc19b2c31a70a2713da15b17b812d2f39f52814aff0f62e55eba5d3f47"],
  [31,4,"c7897f91116f05965f58df6cf4cb287a50f83c9bcf43c71c3742e4985963d541"],
  [32,1,"c3473b43822ecab07cfd163f2d0f4979a0dab0c146c2c0439d99dfb538f34daa"],
  [33,4,"d2e311ccc588ece2c1672981ab666ca1af7af934c31f45d8e78d10f18ef60d28"],
  [34,1,"123562beb76dc7196ede3d029415e5ce0c7f7a1d463e226603a571fd7a7a31d6"],
  [35,5,"4591f61205da055bf3131d394938c1060fb9a1c167559c7b0909e8b0c98136dd"],
  [36,1,"d6581360dec5ab0939371f529cdbd05af6d0f3a47290a4f121515c200ec2a78b"],
  [37,4,"ac4bc1a0812c7bc7318ab78c0e0e1a50695ca98d26377ee2e8aee4a1c44da1f1"],
  [38,3,"9e32f4edeefb3460ba484f658c76a217cba66816ba9bda558181a716ab1f56e4"],
  [39,4,"56fdf116b48e81cec0037b6d46f123ac64ac1c33bc0f1e38cc4aa68eba7e9684"],
  [40,1,"f4b6eaadbb059656c5f5d410808260c090a9520777b98f21b7ca9496aa6a0b86"],
  [41,4,"af783d2b8d5fc4a5ea9325f81f6a90eb5fa157163caf6c906bb10780ccc93a8e"],
  [42,1,"4cdd4e63d9f954db77e89bce63b36e0894e7ad6a53c5ccf9eddbfdbc5ffb59f7"],
  [43,3,"e80e9e18486127842dab683411426d204c8fdae23a477a2bea82f002427ac26c"],
  [44,1,"db7aa450e597d7b5ca08973d3bf97b08a57c251eeebd7f0a4c4f6ee2b6cbb2ed"],
  [45,3,"0f66f4a36f7600422d3d0f938fa8282426eb60e0d9ab8ddd68e572681021f30c"],
  [46,3,"65a562bd8d56d37bfc87fa17d1bdcf93ddb838593ba4fa474d2e7c59e643336b"],
  [47,3,"99a914568e929471a0c5a056367d277ceb1538b428dfca775e44f5074f24bb8d"],
  [48,1,"0307c286b313c67c695fa06d8f92ba499fbe2651041dda7de99e59dc05f6ee97"],
  [17,3,"0610bcbfcd64a62728e5ad8c981c8c8192d75567660ab72b53486ece1b134ed1"],
  [18,3,"84344dbd53472f83ac911ec400c633704ffbcb637e691ff464db43d50a2a2ba3"],
  [19,4,"3139e69dae94aeb341b013d62ebfbe38e87231a0b984016caa89e9b4b5407b5e"],
  [20,1,"4c8196df344a326d86c3be50093ef49b3839e3108e7239adbde2f639c009ae4f"],
  [21,3,"26b79546e2b2f812d30a159f0460c677dd39b27d23aa65c5459361141e55c366"],
  [22,3,"3bb0e37115144337a190f74b6f04e1232ebddda2b823dcffc97efd82551e7f84"],
  [23,4,"7a3d060579a6df1eb831c313cccf622cb91f15d4cccb836addc8e31136239a15"],
  [24,3,"208a58e8a2712cb4f059e177914c35fb69581d26cc0e3d274f4a2c176b23aa62"],
  [25,3,"5edf2677178c84065ba3a696c94bbaac337301e4045a92472a0ba61bf067e79a"],
  [26,3,"c8789eb819de05c2ce4fa366fbb12fcab4723e9bab37e87d128386f3d5e6680b"],
  [27,4,"e8e93a3ffcf72e00790379f184ad4014d9f15c7ff1b4a94eaaa7e250f372f02d"],
  [28,1,"efc9310e8c8e44c0da84bc0aac7edb2d7ac512933e0dda87e11dbc2fcab8f8ce"],
  [29,3,"4f7760d64551036ec34b7cd66d7d4efceb5322b505728d0a698596659a096339"],
  [30,4,"89005743075f75b920285e270d7665314ffbf1725b245fd48b11fd0bc7351aab"],
  [31,4,"15bdd0beadc45261afa5de101ebe41ed5a98a1fe86adacc8425515d7ab0f5ebe"],
  [32,1,"7e5360f4e18887bc78741508f0b3f64b375a314d7cd7e9c19c7676bdbc2becd7"],
  [49,3,"853b6b4cd397a9ad40bef132d84ab3c33779fb5548f3f0d780b128084d2ba66f"],
  [50,3,"a53b4af0499e57bb0cf7e68815510af5ba256f744285543454150548227757e0"],
  [51,4,"d6c9792066d02e2e026c6cb37317263f0d45d57512e8cf33f5fa7a9819a63b35"],
  [52,1,"04f2afd80568d6b4ef8804ebd1b1e0bd70528dd2cc2ef58c35eda069d7d5b940"],
  [53,3,"1f1bacd3e001e9210a38e23cb6a0cf0956bffcfdf2e1b9c50973b9c603949055"],
  [54,3,"eebcad9fe3b8b08786ab325cccd60c3b58904b5ba95240fe005308ed2dce127f"],
  [55,4,"6215b0e4591eb368d0d1d655abc771673ee50e07e29055fe5b8c1333c95ffb4d"],
  [56,3,"70b87f487c0a0db4441ea788e4348138c66c32bb5d223991881a5a8b8b59ae7d"],
  [57,3,"79774029a0bda5eeee7eb6dbbeb80f84283a31f796afa5412f21568c60c306a5"],
  [58,3,"e206083c65415d9dcfb4515456f2b84fa1f1117ad1a2b84a7c72efec428eb21d"],
  [59,4,"26b02b39d26f21abdb2f92332e3acdf2f4dc338e976d3c3f13b6baae4e966d89"],
  [60,1,"ee8d282814231a2b42b6b0235c0821a7ecc6c7f38f7c91625ccbac96ebe838a9"],
  [61,3,"7ee01a1e1cf639104dcbe5287b636566ce811f814783963e4633841c0ed127ac"],
  [62,4,"8a058186d8001c528a1d481f083c9be4885f162cbb83bdcc030ee8cb58e41d4a"],
  [63,4,"9b48c86c71cb0f975f0bef36f316c33051e9bc075f9cacae1d70242717d2c5cb"],
  [64,1,"6c3d37dd13af34dfa8be1f60fe4a43bfc99b0b55ac93b8dc402779d9c19b0826"]
];
const phrase = (value, from, to) => value.steps.filter(([,beat])=>beat>=from&&beat<to);
const eventsFor = steps => steps.map(([name,beat,duration])=>({beat,duration,notes:[{name,role:"melody",judge:true}]}));
const normalized = value => ({...structuredClone(value),baseSongId:value.id,source:"system",
  arrangementKind:"melody",judgementMode:"melody",events:eventsFor(value.steps)});
const overlap = (beat,duration,start,end) => Math.max(0,Math.min(end,beat+duration)-Math.max(start,beat));
const midi = name => 12*(Number(name.slice(1))+1)+({C:0,D:2,E:4,F:5,G:7,A:9,B:11})[name[0]];
function assertSelectedEdition(value) {
  assert.equal(value.steps.length,183);
  assert.equal(hash(JSON.stringify(value.steps)),tupleHash,"all183 fixed source-decided tuples");
  assert.equal(value.bpm,84,"unchanged editorial practice tempo");
  assert.equal(value.defaultSpeedFactor,.9,"unchanged suggestion, not live speed");
  assert.equal(value.beatsPerMeasure,3);
  assert.equal(value.sourceFeatures.sourceTotalBeats,192);
  assert.deepEqual(value.sourceFeatures.sourceReview.currentScopeReview.melodyOnlyRestWindows.map(r=>[r.beat,r.duration]),rests.map(beat=>[beat,1]));
  assert.deepEqual(barDecisions.map(([measure])=>measure),route);
  for(const [index,[measure,count,fingerprint]] of barDecisions.entries()) {
    const start=index*3, attacks=phrase(value,start,start+3);
    assert.equal(attacks.length,count,`selected bar${index+1}/source m${measure} attacks`);
    assert.equal(hash(JSON.stringify(attacks)),fingerprint,`selected bar${index+1}/source m${measure} exact tuples`);
    const sounding=value.steps.reduce((sum,[,beat,duration])=>sum+overlap(beat,duration,start,start+3),0);
    const silence=rests.reduce((sum,beat)=>sum+overlap(beat,1,start,start+3),0);
    assert.equal(sounding+silence,3,`selected bar${index+1} complete3/4 balance`);
  }
}
function withIsolatedStorage(run) {
  const previous=globalThis.localStorage, values=new Map();
  globalThis.localStorage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value))};
  try{return run(values);}finally{if(previous===undefined)delete globalThis.localStorage;else globalThis.localStorage=previous;}
}

test("selected complete vocal edition retains183 source-decided attacks across64 complete3/4 bars",()=>{
  assertSelectedEdition(song);
  assert.equal(song.id,"xuan-cao-hua");assert.equal(song.schemaVersion,1);
  assert.equal(song.title,"《萱草花》（声乐版）");
  assert.equal(song.practiceTitle,`${song.title}练习轨道`);assert.equal(song.scoreTitle,`${song.title}简谱进度`);
  assert.match(song.hint,/山山.*183.*64.*3\/4.*192/);assert.match(song.hint,/84 BPM为练习设定/);
  assert.doesNotMatch(song.hint,/旧版|还原|更容易|原唱全曲/);
  assert.equal(song.sourceFeatures.sourceMeasureCount,64);
  assert.equal(current.distinctPrintedVocalMeasures,48);
  assert.deepEqual(current.reviewedBeatRanges,[[0,192]]);
  assert.deepEqual(current.selectedRoute,[{sourceMeasures:[17,48],beats:[0,96],attacks:89},
    {sourceMeasures:[17,32],beats:[96,144],attacks:47},{sourceMeasures:[49,64],beats:[144,192],attacks:47}]);
  assert.deepEqual(current.selectedRoute.map(({beats:[a,b]})=>phrase(song,a,b).length),[89,47,47]);
  assert.deepEqual(phrase(song,96,144).map(([n,b,d])=>[n,b-96,d]),phrase(song,0,48));
  assert.equal(current.pickupBeats,0);assert.equal(current.initialMelodyRestBeats,0);
  assert.equal(song.sourceFeatures.hasRepeats,true);
});

test("independent repeated E4 attacks and edition-specific notes are never guessed as ties",()=>{
  for(const start of [0,24,96,120,144,168])assert.deepEqual(phrase(song,start,start+3),[
    ["E4",start,1],["E4",start+1,1],["E4",start+2,1]]);
  assert.deepEqual(current.ties,[]);assert.equal(current.tieContinuationCount,0);
  assert.deepEqual(song.steps.find(([,b])=>b===13),["A3",13,1]);
  assert.deepEqual(phrase(song,84,87),[["A4",84,1.5],["B4",85.5,.5],["C5",86,1]]);
  assert.deepEqual(song.steps.at(-1),["C4",189,2]);
  assert.equal(current.selectedEndIsSelectedEditionVocalEnding,true);
  assert.equal(current.selectedEndIsFullSongEnding,false);
});

test("twenty vocal-only rests including191–192 remain distinct from all-layer silence",()=>{
  const analysis=analyzeSongTiming(song);
  assert.deepEqual(analysis.melodyGaps.map(({beat,duration})=>[beat,duration]),rests.map(b=>[b,1]));
  assert.equal(analysis.claims.melodyOnly.length,20);assert.equal(analysis.claims.allLayerSilent.length,0);
  assert.ok(analysis.melodyGaps.every(({declarations})=>declarations.length===1&&declarations[0].meaning==="declared-melody-only-rest"));
  assert.deepEqual(analysis.unannotatedLongGaps,[]);assert.deepEqual(analysis.issues,[]);
  assert.ok(current.melodyOnlyRestWindows.every(({voice})=>voice==="selected-vocal-only"));
  assert.equal(current.allLayerSilenceClaim,false);assert.equal(current.silentWindows,undefined);
  assert.equal(current.endingRestBeats,1);
  for(const beat of rests)assert.ok(song.steps.every(([,b,d])=>b>=beat+1||b+d<=beat));
  assert.equal(song.steps.reduce((sum,[,,d])=>sum+d,0)+rests.length,192);
  assert.equal(getPracticeTotalBeats(eventsFor(song.steps),song),192);
  for(const field of ["events","rhythm","autoAccompaniment","practiceAccompaniment"])assert.equal(song[field],undefined);
});

test("unchanged pitch register and actual layout support conditional practice advice only",()=>{
  const keys=new Set(DISPLAY_KEYS.map(k=>k.name));for(const[n]of song.steps)assert.ok(keys.has(n));
  assert.deepEqual([...new Set(song.steps.map(([n])=>midi(n)%12))].sort((a,b)=>a-b),[0,2,4,7,9,11]);
  assert.deepEqual([Math.min(...song.steps.map(([n])=>midi(n))),Math.max(...song.steps.map(([n])=>midi(n)))],[55,72]);
  assert.equal(current.transpositionSemitones,0);assert.equal(current.globalOctaveShift,0);assert.equal(current.octaveFolding,false);
  assert.deepEqual(current.localPitchAlterations,[]);assert.deepEqual(current.melodyAccidentals,[]);
  assert.equal(song.key,"C");assert.equal(song.tuning,"21-key-c");
  const positions=new Map(DISPLAY_KEYS.map(({name},i)=>[name,i])),side=n=>Math.sign(positions.get(n)-10);
  assert.equal(Math.max(...song.steps.slice(1).map(([n],i)=>Math.abs(midi(n)-midi(song.steps[i][0])))),9);
  assert.equal(Math.max(...song.steps.slice(1).map(([n],i)=>Math.abs(positions.get(n)-positions.get(song.steps[i][0])))),11);
  assert.equal(song.steps.slice(1).filter(([n,b],i)=>b-song.steps[i][1]===.5&&side(n)===side(song.steps[i][0])).length,39);
  assert.equal(Math.min(...song.steps.slice(1).map(([,b],i)=>b-song.steps[i][1])),.5);
  assert.ok(Math.abs(.5*60000/song.bpm-357.14285714285717)<1e-9);
  assert.ok(Math.abs(.5*60000/(song.bpm*song.defaultSpeedFactor)-396.8253968253968)<1e-9);
  assert.equal(song.bpm,archive.bpm);assert.equal(song.defaultSpeedFactor,archive.defaultSpeedFactor);
  assert.equal(song.difficulty,"medium");assert.match(current.difficultyDecision,/editorial conditional.*not a source marking/);
  assert.equal(song.sourceFeatures.suitability.status,"conditional");
});

test("current provenance is scoped to the selected source and retains historical uncertainty",()=>{
  assert.equal(current.status,"reviewed-selected-complete-vocal-edition");assert.equal(current.adoptedInVersion,"2.4.28");
  assert.equal(current.sourceUrl,"https://www.21qupu.com/guitar/45750.html");
  assert.deepEqual(current.sourceAssetHashes,{page1Sha256:"c76f6f616781e867855ccfba5ab13426fef41fb3cc5c4ad788a76cc27481ce9f",page2Sha256:"3f1e9ad3e7078f50ab53c78af3778bc9f778a93d18f6751787c05a02e4c4bce1"});
  assert.equal(current.sourceVoice,"explicit-lyric-aligned-numbered-vocal-line");
  assert.equal(current.sourceMeter,"3/4");assert.equal(current.beatUnit,"quarter-note");
  assert.equal(current.sourceKey,"1=C");assert.equal(current.sourceOriginalKeyLabel,"1=Bb");
  assert.equal(current.sourceTempoPrinted,false);assert.equal(current.sourceQuarterBpm,null);
  assert.match(current.tempoDecision,/84 BPM is an editorial practice choice/);
  assert.equal(current.oldEditionReverified,false);assert.equal(current.historicalSourceImageIdentityVerified,false);
  assert.equal(current.independentSourcesVerified,false);
  assert.match(current.versionDecision,/not proof that the old78-attack edition is wrong/);
  assert.deepEqual(review.historicalSourceFeatures,archive.sourceFeatures);
  assert.equal(current.publicDistributionRights,"unestablished-private-preview-only");
  assert.equal(current.referenceListening,"not-performed");assert.equal(current.browserAudio,"not-performed-at-data-adoption");
  assert.equal(current.physicalKalimba,"not-performed");
});

test("the historical78-attack archive preserves exact bytes, lexical numbers and metadata without a new card or route",async()=>{
  assert.equal(hash(archiveBytes),archiveHash);
  assert.match(archiveBytes.toString(),/\n      0\.0,/);
  assert.notEqual(hash(JSON.stringify(archive,null,2)+"\n"),archiveHash,"never replace raw bytes with reserialized numeric lexemes");
  assert.equal(archive.id,song.id);assert.equal(archive.steps.length,78);
  assert.equal(hash(JSON.stringify(archive.steps)),"517466aa84aab6b573c6d68f4a292ad240b12457fc920dd2f8cad474cc99ca1f");
  assert.equal(archive.bpm,84);assert.equal(archive.beatsPerMeasure,4);assert.equal(archive.defaultSpeedFactor,.9);
  assert.deepEqual(archive.steps.at(-1),["G4",112,4]);
  assert.equal(review.archivedEdition.file,archivePath);assert.equal(review.archivedEdition.fileSha256,archiveHash);
  assert.equal(current.archiveImportPath,undefined);assert.equal(getSongArchiveDownload(song),null);
  const files=await readSongFiles();assert.equal(files.filter(({song:s})=>s.id===song.id).length,1);
  assert.ok(files.every(({fileName})=>fileName!=="xuan-cao-hua-v2.4.27.json"));
  for(const file of ["service-worker.js","serve-kalimba.js","src/app.js","src/song-library.js"])
    assert.ok(!(await read(file)).toString().includes("xuan-cao-hua-v2.4.27.json"),`${file} must not expose or precache archive`);
});

test("real importer/storage restore all historical music separately without changing current song or saved speed",()=>{
  withIsolatedStorage(values=>{
    const speedBytes=JSON.stringify({schemaVersion:1,songs:{"xuan-cao-hua":{speed:.65}}});
    values.set(SONG_SPEED_STORAGE_KEY,speedBytes);
    const library=getSongLibrary();library[song.id]=normalized(song);
    const before=JSON.stringify(library),previousIds=getPracticeSongs(library).map(s=>s.id).sort();
    assert.equal(previousIds.length,36);
    const imported=parseImportedSongs(archiveBytes.toString(),library);assert.equal(imported.length,1);
    const restored=imported[0];assert.deepEqual(restored.steps,archive.steps);
    assert.deepEqual(restored.sourceFeatures,archive.sourceFeatures);assert.equal(restored.schemaVersion,2);
    assert.equal(restored.source,"local");assert.notEqual(restored.id,song.id);assert.notEqual(restored.baseSongId,song.id);
    assert.equal(restored.bpm,84);assert.equal(restored.beatsPerMeasure,4);assert.equal(restored.defaultSpeedFactor,.9);
    assert.equal(getPracticeTotalBeats(restored.events,restored),116);
    saveCustomSongs([restored]);const [saved]=getCustomSongs();
    assert.deepEqual(saved.steps,archive.steps);assert.deepEqual(saved.sourceFeatures,archive.sourceFeatures);
    const normalizedFields=new Set(["schemaVersion","id","uploader","practiceTitle","scoreTitle"]);
    const reconstructed=Object.fromEntries(Object.keys(archive).map(key=>[key,normalizedFields.has(key)?archive[key]:saved[key]]));
    assert.deepEqual(reconstructed,archive,"all old values recover after documented identity/schema/display normalization; archive alone preserves original lexical bytes");
    assert.equal(JSON.stringify(library),before);assert.equal(library[song.id].steps.length,183);
    assert.deepEqual(getPracticeSongs(library).map(s=>s.id).sort(),previousIds);
    const merged={...library,[restored.id]:restored};assert.equal(getPracticeSongs(merged).length,37);
    assert.equal(getPracticeSongId(merged,restored.id),restored.id);
    const [again]=parseImportedSongs(archiveBytes.toString(),merged);assert.notEqual(again.id,restored.id);assert.deepEqual(again.steps,archive.steps);
    const [selected]=parseImportedSongs(JSON.stringify(song),merged);assertSelectedEdition(selected);
    assert.deepEqual(selected.events.map(e=>[e.notes[0].name,e.beat,e.duration]),song.steps);
    assert.equal(getPracticeTotalBeats(selected.events,selected),192);
    assert.equal(values.get(SONG_SPEED_STORAGE_KEY),speedBytes);assert.deepEqual(readSongSpeed(globalThis.localStorage,song.id),{speed:.65});
  });
});

test("byte-frozen old V2 cannot supply either backing layer to the reviewed vocal edition",()=>{
  assert.equal(hash(siblingBytes),siblingHash);assert.equal(sibling.schemaVersion,2);
  assert.equal(hasMatchingPracticeMelody(song,sibling),false);
  assert.equal(hasMatchingPracticeMelody(song,archive),false);
  assert.equal(getSongAccompanimentProvider(normalized(song),[sibling]),null);
  assert.equal(getSongAccompanimentProvider(normalized(song),[sibling],true),null);
});

const mutations={
  "invent-opening-tie":s=>{s.steps[0][2]=3;s.steps.splice(1,2);},
  "merge-coda-E4-repeats":s=>{const i=s.steps.findIndex(([,b])=>b===144);s.steps.splice(i,3,["E4",144,3]);},
  "blend-other-edition-held-A3":s=>{s.steps.find(([,b])=>b===13)[2]=2;},
  "blend-other-edition-low-A3":s=>{s.steps.find(([,b])=>b===84)[0]="A3";},
  "stretch-to-old-four-beat-meter":s=>{s.steps=s.steps.map(([n,b,d])=>[n,b*4/3,d*4/3]);},
  "drop-repeat-and-coda":s=>{s.steps=s.steps.filter(([,b])=>b<96);s.sourceFeatures.sourceTotalBeats=96;},
  "wrong-repeat-ending-route":s=>{s.steps=s.steps.filter(([,b])=>b<144).concat(phrase(s,48,96).map(([n,b,d])=>[n,b+96,d]));},
  "stretch-final-C4-over-vocal-rest":s=>{s.steps.at(-1)[2]=3;},
  "truncate-final-rest":s=>{s.sourceFeatures.sourceTotalBeats=191;},
  "erase-vocal-rest-declaration":s=>{s.sourceFeatures.sourceReview.currentScopeReview.melodyOnlyRestWindows.pop();},
  "retain-old-meter":s=>{s.beatsPerMeasure=4;},
  "invent-source-tempo":s=>{s.bpm=90;},
  "overwrite-speed-suggestion":s=>{s.defaultSpeedFactor=.55;}
};
for(const [name,mutate] of Object.entries(mutations))test(`source-decision locks reject ${name}`,()=>{
  const changed=structuredClone(song);mutate(changed);assert.throws(()=>assertSelectedEdition(changed));
});

// Optional private record is kept outside public packages. Its text predates
// independent-person review; the separate full-pixel review is provenance,
// not something this executable checker can repeat. Missing input is SKIPPED.
const sourceEvidencePath=process.env.DAYLILY_SOURCE_EVIDENCE_PATH;
test("explicit private source-authored fixture matches all183 attacks across64 spans",{skip:!sourceEvidencePath},async()=>{
  const bytes=await readFile(sourceEvidencePath);assert.equal(hash(bytes),sourceFixtureHash);
  const evidence=JSON.parse(bytes);assert.equal(evidence.songId,song.id);
  assert.equal(evidence.melodySpans.length,64);assert.equal(evidence.sourceTotalBeats,192);
  assert.deepEqual(evidence.melodySpans.map(s=>s.countedPrintedMeasure),route);
  assert.equal(hash(JSON.stringify(evidence.melodySpans.flatMap(s=>s.attacks))),tupleHash);
  assert.deepEqual(evidence.melodyOnlyRestWindows.map(r=>[r.beat,r.duration]),rests.map(b=>[b,1]));
  assert.equal(evidence.silentWindows,undefined);
  const result=checkTranscriptionEvidence(song,evidence);assert.equal(result.checkedAttacks,183);
  for(const [name,mutate]of Object.entries(mutations)){
    const changed=structuredClone(song);mutate(changed);
    assert.throws(()=>{checkTranscriptionEvidence(changed,evidence);assertSelectedEdition(changed);},name);
  }
});
