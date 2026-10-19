import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import test from "node:test";
import { DISPLAY_KEYS, readSongFiles } from "./build-song-library.mjs";
import { getCustomSongs, getPracticeSongs, getPracticeSongId, getSongArchiveDownload,
  getSongBaseId, getSongVersionRank, getSongLibrary, getSongAccompanimentProvider, hasMatchingPracticeMelody,
  parseImportedSongs, saveCustomSongs } from "../src/song-store.js";
import { getPracticeTotalBeats } from "../src/practice-loop.js";
import { checkTranscriptionEvidence } from "../skills/kalimba-tone-trace-compiler/scripts/check-transcription-evidence.mjs";

const read = path => readFile(new URL(`../${path}`, import.meta.url));
const hash = value => createHash("sha256").update(value).digest("hex");
const song = JSON.parse(await read("data/songs/da-yu.json"));
const archivePath = "data/archives/da-yu-v2.4.21.json";
const archiveBytes = await read(archivePath);
const archive = JSON.parse(archiveBytes);
const archiveHash = "5f3aff34c32bf77aef78df70f8ec54d4181ee88d14f640feda2217395a797397";
const archiveContentHash = "db04d59fa5f0d55fb669bba96338092603fafe40bb4ff995d51ef9b2841688d4";
const oldV2Bytes = await read("data/songs/da-yu-chord.json");
const oldV2 = JSON.parse(oldV2Bytes);
const oldV2Hash = "1c02d483538dd43baeda3ef577d3698c827ac5f6e9c8beea84319ebb092a8f3c";
const review = song.sourceFeatures.sourceReview;
const current = review.currentScopeReview;
const sourceUrl = "https://www.jianpujia.com/jianpu/340541.html";

// Independently authored before adoption from the actual source pixels, not
// from production JSON. Literal evidence SHA256 54c50a52fefe6831f6759948c3efb1ce143037d9b3bb6c647a907579c8ea3b3e;
// second reading SHA256 78051c59d4afc993bdf25b926bf067e34c598cb7e14136ef8b136014bc261b68.
// Both cover every occurrence; source linear bars 5–36 become selected bars 1–32.
// Only the selected monophonic attacks are included, never raw source scans,
// lower chord transcriptions, lyrics or the excluded continuation.
const bars = [
  [["E4",0,0.5],["D4",0.5,0.5],["E4",1.0,0.5],["A4",1.5,0.5],["E4",2.0,0.5],["D4",2.5,0.5],["E4",3.0,0.5],["B4",3.5,0.5]],
  [["E4",4,0.5],["D4",4.5,0.5],["E4",5.0,0.5],["C5",5.5,0.5],["B4",6.0,1.0],["G4",7.0,1.0]],
  [["E4",8,0.5],["D4",8.5,0.5],["E4",9.0,0.5],["A4",9.5,0.5],["E4",10.0,0.5],["D4",10.5,0.5],["E4",11.0,0.5],["B4",11.5,0.5]],
  [["G4",12,4.0]],
  [["E4",16,0.5],["D4",16.5,0.5],["E4",17.0,0.5],["A4",17.5,0.5],["E4",18.0,0.5],["D4",18.5,0.5],["E4",19.0,0.5],["B4",19.5,0.5]],
  [["E4",20,0.5],["D4",20.5,0.5],["E4",21.0,0.5],["C5",21.5,0.5],["B4",22.0,1.0],["G4",23.0,1.0]],
  [["D4",24,0.5],["E4",24.5,0.5],["A3",25.0,1.0],["D4",26.0,0.5],["E4",26.5,0.5],["A3",27.0,0.5],["G3",27.5,0.5]],
  [["A3",28,4.0]],
  [["A3",32,0.5],["C4",32.5,0.5],["C4",33.0,0.5],["D4",33.5,0.5],["D4",34.0,0.5],["E4",34.5,0.5],["E4",35.0,0.5],["A4",35.5,0.5]],
  [["G4",36,1.5],["E4",37.5,0.5],["D4",38.0,2.0]],
  [["A3",40,0.5],["C4",40.5,0.5],["C4",41.0,0.5],["D4",41.5,0.5],["D4",42.0,0.5],["E4",42.5,0.5],["E4",43.0,1.0]],
  [["A3",44,1.0],["G3",45.0,3.0]],
  [["A3",48,0.5],["C4",48.5,0.5],["C4",49.0,0.5],["D4",49.5,0.5],["D4",50.0,0.5],["E4",50.5,0.5],["E4",51.0,0.5],["A4",51.5,0.5]],
  [["G4",52,1.5],["E4",53.5,0.5],["D4",54.0,2.0]],
  [["D4",56,0.5],["E4",56.5,0.5],["A3",57.0,1.0],["D4",58.0,0.5],["E4",58.5,0.5],["A3",59.0,0.5],["G3",59.5,0.5]],
  [["A3",60,3.0],["A3",63.0,0.5],["C4",63.5,0.5]],
  [["D4",64,1.5],["C4",65.5,0.5],["A3",66.0,1.0],["A3",67.0,0.5],["C4",67.5,0.5]],
  [["D4",68,1.5],["C4",69.5,0.5],["E4",70.0,1.0],["E4",71.0,0.5],["G4",71.5,0.5]],
  [["A4",72,1.0],["A4",73.0,0.5],["G4",73.5,0.5],["E4",74.0,0.5],["D4",74.5,0.5],["C4",75.0,1.0]],
  [["D4",76,0.5],["E4",76.5,2.5],["A3",79.0,0.5],["C4",79.5,0.5]],
  [["D4",80,1.5],["C4",81.5,0.5],["A3",82.0,1.0],["A3",83.0,0.5],["C4",83.5,0.5]],
  [["D4",84,1.5],["C4",85.5,0.5],["E4",86.0,2.0]],
  [["D4",88,0.5],["E4",88.5,0.5],["A3",89.0,1.0],["D4",90.0,0.5],["E4",90.5,0.5],["A3",91.0,0.5],["G3",91.5,0.5]],
  [["A3",92,3.0],["E4",95.0,0.5],["G4",95.5,0.5]],
  [["C5",96,1.5],["B4",97.5,0.5],["E4",98.0,1.0],["E4",99.0,0.5],["D4",99.5,0.5]],
  [["C4",100,1.0],["C4",101.0,0.5],["D4",101.5,0.5],["E4",102.0,1.0],["E4",103.0,0.5],["D4",103.5,0.5]],
  [["C4",104,1.0],["A4",105.0,0.5],["C5",105.5,0.5],["B4",106.0,0.5],["A4",106.5,0.5],["G4",107.0,0.5],["D4",107.5,0.5]],
  [["E4",108,3.0],["E4",111.0,0.5],["G4",111.5,0.5]],
  [["C5",112,1.5],["B4",113.5,0.5],["E4",114.0,1.0],["E4",115.0,0.5],["D4",115.5,0.5]],
  [["C4",116,1.0],["C4",117.0,0.5],["D4",117.5,0.5],["E4",118.0,2.0]],
  [["D4",120,0.5],["E4",120.5,0.5],["A3",121.0,1.0],["D4",122.0,0.5],["E4",122.5,0.5],["A3",123.0,0.5],["G3",123.5,0.5]],
  [["A3",124,4.0]],
];
const expected = bars.flat();
const phrase = (from,to,steps=song.steps) => steps.filter(([,beat]) => beat>=from && beat<to);
const evidence = {
  songId: "da-yu", source: { reference: sourceUrl, scope: "Explicit single numbered melody: 前奏1, 前奏2, 主歌, 桥段, first 副歌 only." },
  melodySpans: [{ from: 0, to: 128, attacks: expected }], sourceTotalBeats: 128,
  pitchFit: { sourcePitchClasses: [0,1,3,5,8,10], semitoneShift: -1 }
};
const eventsFor = steps => steps.map(([name,beat,duration]) => ({beat,duration,notes:[{name,role:"melody",judge:true}]}));
const normalized = value => ({...structuredClone(value),baseSongId:value.id,arrangementKind:"melody",judgementMode:"melody",source:"system",events:eventsFor(value.steps)});
function withIsolatedStorage(run) {
  const before=globalThis.localStorage, values=new Map();
  globalThis.localStorage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value))};
  try { return run(); } finally { if(before===undefined) delete globalThis.localStorage; else globalThis.localStorage=before; }
}

// Fixed raw-byte fingerprints read from the frozen v2.4.21 delivery ZIP before
// this edit, not from the evolving working tree. No extra JSON record is added.
const frozenOtherFiles = {
  "bie-kan-wo-zhi-shi-yi-zhi-yang.json": "a5a82465317132a9d1b366aae43a4986643f98af032ad2dc9577f0483baa0780",
  "birthday-chord.json": "ccb1f867508e2452f1a0b24ea7ac398155cd23c01eece9a70f43e4028332c345",
  "birthday.json": "ffbf4fa0a7ed757e91da151e1a8132ec4f1800a30118a08b48919843fda1415a",
  "bluebird-chord.json": "0adaf36fa7ad1d68d3fcc3a9c02c219b42171389fb1713cb9addd9f56d228b9b",
  "bluebird.json": "d05d2ae83b89d0a85b15649a163a9cfb57791280f6dab938d61523db36d83f4a",
  "da-yu-chord.json": "1c02d483538dd43baeda3ef577d3698c827ac5f6e9c8beea84319ebb092a8f3c",
  "da-yu-xiao-yu.json": "da9cd3a9e6c400d80620e14ef0f6193226ea01dd02b3c0caaddbb070de9965ab",
  "fu-shi-shan-xia.json": "25e83b9d7cc8626497520e1868115dad6cf52eae7eef29efd6e32daa2933c8ce",
  "gao-bai-qi-qiu.json": "0222034b507118306009efb8cd6923bbbcdedf4d6462eeddaaf1bd9799e7c80c",
  "hong-yan.json": "a1793a1d4108dcc926f660bf65025d3958deb44b58baf762261fe53be7234b54",
  "interstellar-main-theme-chord.json": "3b28eec6bc38685b9116f23766f9665e66435538b60240e060cfeaf977780e36",
  "interstellar-main-theme.json": "d273814a619aab0531ffacdea7947839020a7ac71729f1934cb0a99da7462841",
  "jasmine-chord.json": "ebbf3d54f58c4d4dd374114ab66d06d651841e85e020d84a408ac6787a17f721",
  "jasmine.json": "fe4fbfbd630362782a18f71b2d58a0dfa28a5ec25fde23a3d06a0df7e60713f9",
  "jie-wang.json": "a83876a5946833710e70e7ed36dc6f7f47f113cc2bf1ef60175d582a100d3860",
  "ju-ci-lang-de-xia-tian.json": "d9217930906156ca047d542d1008cdcfe0c681fcdde829d8b71709275b078d3d",
  "jue-bie-shu-chord.json": "e441e4c36f41d1cb2315b24b4ce837e6adb66d0cd3656f62aba9c8896f8a004a",
  "jue-bie-shu.json": "d25e64984938aa71106508fcefbcc68f5f9a436da3c0ceeafa6d4cf836bacf97",
  "katyusha-chord.json": "de452ca36de8add09257934ec3cb1e59f09c0f8b181ba14fb02fefe19367640c",
  "katyusha.json": "2dbf685d9ef3bae64ba715c451e592b8b4686eb6e9ea845c6d5fbae43519245a",
  "ling-er-xiang-ding-dang-chord.json": "c28df5631e09a1dcce5e28fc7b32c3ec86d1ff858c2032daff9c91de888bafa8",
  "ling-er-xiang-ding-dang-reviewed-support.json": "b9e41164110482d30bf4493b44563a08127beea3c3e40fd6020076fe349a9636",
  "ling-er-xiang-ding-dang.json": "42802e264082e1ee8812b0c8110c96b31908320310999de749ec8ad07157abfc",
  "meng-zhong-de-hun-li.json": "4d2d0ab4836a94642252c9ff41f68a977c7342e073bba2e8546508dc97fa26e8",
  "mi-xue-bing-cheng-theme-chord.json": "df1100d1587c3b297ab0f6cc60a6a78696f00bf0b8c37e98e26bebcacf7b247e",
  "mi-xue-bing-cheng-theme.json": "3596e1587982a7b1692963094413d62881d4d9c89691bf743d0f99b979d5bd52",
  "mo-he-wu-ting-verse.json": "68f63b9afd5695d381e323f7d37c1e90df6fac07873025b2fedab23eefe7d3a5",
  "one-summers-day.json": "7c6eb0c24c80ce48791cd8a286129bf93c1a47ed75218e082d25459ee3c25be6",
  "ping-fan-zhi-lu.json": "6098bdc9bffbc2c3e3097c6a7d4343556a679f52a2151564c0b99cd2bebcbd4b",
  "qi-feng-le.json": "72293416b2d9226ed23c5bf643a54a0ea17888f31a28c1e5ffa027aa1c06c27e",
  "qing-cheng-shan-xia-bai-su-zhen.json": "60ef963602fd3a4a7cd83d340d60ff424af4e04d7ab5d69497f37c322c1df7c9",
  "qing-hua-ci-reviewed-support.json": "e8551849ca63c2ed36d2480a459be50b0006ebc86340fbe7308bfd0480b2c94c",
  "qing-hua-ci.json": "1c7162c13e5d4e843016dba7f37acaa725a98870a304ce6b649f7269f041e64e",
  "rang-wo-men-dang-qi-shuang-jiang.json": "62a0aa1a5621116ebb8d0b10691f8aaeccc0ff90ee4291019ca95b40aa795052",
  "see-you-again-chord.json": "f22f7a54d6ee3d9caa20dc21925470337bd43cf3d134e4e912b261ddcabe76fb",
  "see-you-again-reviewed-support.json": "4294e4ee659afe8749588d9ab5c0c61e5c054c9bffa6942ecc3a7771fc79a7b9",
  "see-you-again.json": "2b456fbbc7d1862be5bd9e5e06f02e443e4da43dcfcb1c53a590f7a31709e2e5",
  "sheng-sheng-man.json": "3409453b57ca4c84bc62657bb54f8f3afaca34309664006834220d5a9ffdc7e8",
  "song-bie-chord.json": "dd575f1e2db95a54b010d3e9eca6e1f273f58190743fec68e7db55490e61c35c",
  "song-bie.json": "31042a1c640d60dbf2cabfd880aa451d6d2f142916c169fa5bc5eabca19c0a26",
  "tai-yang-zhao-chang-sheng-qi-chord.json": "32dea134fc4a85418044dac13b7014d594fcf879f2874d8c4bbe421f1f894199",
  "tai-yang-zhao-chang-sheng-qi.json": "bcf57e601f7959532b6756a772eb89ee8271ce35d32889e427418e222f43ada1",
  "tian-kong-zhi-cheng-chord.json": "71cdc1822b3acff569023047fc4de8a5a5e963a064f3ce47a19519faa020eb4f",
  "tian-kong-zhi-cheng.json": "87cec5397ef34eb01264939c1e15d3e2f2649ec28c678566a59968a9d783b1a6",
  "tong-hua-zhen.json": "e15f403a2aebdb5199ac57641963d92f2a75ae98afa4ae1b652e14bf9e94da8c",
  "tong-nian-chord.json": "f370fb5ddb5e936afd7c16f5c8f9eaa4dab789b4ce5e052b071c6200a4fe8260",
  "tong-nian.json": "1261f31f6d1194b07fdff52a4bd5ec35b44c4426262575a01698b5fad6bb1ce4",
  "xiao-xing-xing-chord.json": "124a61271dd0180be0b28ab15b598fb6eaffdf68af323b697562dd9a9d3f9d6e",
  "xiao-xing-xing.json": "2e8ec5df1af00f068d96ccf40289d5783c19a04c3178fddc52b6c3084e2b7a74",
  "xuan-cao-hua-chord.json": "82f43ef27df396c1af0235750a5ea070dbed7997ab821b956d0a1e829a705b57",
  "xuan-cao-hua.json": "e9cd5a2a7ec4912fb208983a279b4f40f05eb524422c2bf5914e77fc4f1e9798",
  "ye-de-gang-qin-qu-wu.json": "2df0ffabd75551783e0384328764ca56be7220cc2eeb63bbb9b9078b5c67e890",
  "yun-yan-cheng-yu.json": "c3dbfbfd9398e5956d0c4c42f5c29d625b928ff8c45c1646192f9db03de16480",
  "zhu-zhu-xia-theme-chord.json": "a73e734e50f5cb5e878cce202c324acce34dfbd10892f9dabd51384b6d750b30",
  "zhu-zhu-xia-theme.json": "6942f5ff9ae7844f4d2dc52ad5f80a889ce662f9e0196455b785101a9c36318b"
};

test("all 162 independently source-authored tuples describe the selected numbered melody",()=>{
  assert.equal(expected.length,162);
  assert.equal(song.schemaVersion,1);
  assert.equal(song.id,"da-yu");
  assert.deepEqual(song.steps,expected);
  assert.equal(song.title,"《大鱼》（前奏至副歌选段）");
  assert.equal(song.practiceTitle,`${song.title}练习轨道`);
  assert.equal(song.scoreTitle,`${song.title}简谱进度`);
  assert.match(song.hint,/简谱家.*前奏1至首段副歌.*32小节.*162/);
  assert.match(song.hint,/G3–C5.*80 BPM为练习设定.*谱面未印速度/);
  assert.doesNotMatch(song.hint,/旧版|还原|更简单|更好听|实体琴验收/);
  assert.equal(checkTranscriptionEvidence(song,evidence).checkedAttacks,162);
});

test("every selected bar has its own exact attacks and continuous four-beat coverage",()=>{
  assert.equal(bars.length,32);
  assert.equal(song.beatsPerMeasure,4);
  for(const [index,attacks] of bars.entries()) {
    const start=index*4,end=start+4;
    assert.deepEqual(phrase(start,end),attacks,`selected m${index+1} / linear source m${index+5}`);
    let cursor=start;
    for(const [,beat,duration] of attacks) { assert.equal(beat,cursor); cursor=beat+duration; }
    assert.equal(cursor,end);
  }
  assert.equal(song.sourceFeatures.sourceMeasureCount,32);
  assert.deepEqual(current.sourceMeasureRange,[5,36]);
  assert.deepEqual(current.sourceBeatRange,[16,144]);
  assert.equal(current.sourceToExcerptBeatOffset,-16);
  assert.equal(current.pickupBeats,0);
  assert.deepEqual(current.reviewedBeatRanges,[[0,128]]);
  assert.deepEqual(current.selectedSections.map(({label})=>label),["前奏1","前奏2","主歌","桥段","首段副歌"]);
  assert.deepEqual(current.selectedSections.map(({beats})=>beats),[[0,16],[16,32],[32,64],[64,96],[96,128]]);
  assert.equal(current.excludedSections.length,5);
  assert.match(current.repeatExpansion,/none.*later printed repeat route excluded/);
  assert.equal(song.sourceFeatures.hasRepeats,false,"no route expansion within this selected cut");
});

test("the m20 same-pitch tie is one 2.5-beat attack, while genuine repeated attacks survive",()=>{
  assert.deepEqual(phrase(76,80),[["D4",76,.5],["E4",76.5,2.5],["A3",79,.5],["C4",79.5,.5]]);
  assert.deepEqual(current.ties.map(({mergedAttack})=>mergedAttack),[["E4",76.5,2.5]]);
  assert.deepEqual(current.ties[0].segments,[["E4",76.5,.5],["E4",77,2]]);
  assert.equal(current.ties[0].crossPage,false);
  assert.equal(current.ties[0].crossSystem,false);
  for(const onset of [77,78,78.5]) assert.equal(song.steps.some(([,beat])=>beat===onset),false);
  for(const [a,b] of current.separateAttackExamples) {
    assert.ok(song.steps.some(step=>JSON.stringify(step)===JSON.stringify(a)));
    assert.ok(song.steps.some(step=>JSON.stringify(step)===JSON.stringify(b)));
    assert.equal(a[0],b[0]); assert.equal(a[1]+a[2],b[1]);
  }
  assert.deepEqual(phrase(32.5,35.5),[["C4",32.5,.5],["C4",33,.5],["D4",33.5,.5],["D4",34,.5],["E4",34.5,.5],["E4",35,.5]]);
});

test("later occurrences retain literal octave dots rather than copied first-chorus patterns",()=>{
  const at=beat=>song.steps.find(([,onset])=>onset===beat);
  for(const beat of [96,112]) assert.equal(at(beat)[0],"C5");
  for(const beat of [100,104,116]) assert.equal(at(beat)[0],"C4");
  assert.equal(at(105)[0],"A4"); assert.equal(at(105.5)[0],"C5");
  assert.deepEqual(phrase(116,120),[["C4",116,1],["C4",117,.5],["D4",117.5,.5],["E4",118,2]]);
  assert.notDeepEqual(phrase(116,120).map(([name,beat,duration])=>[name,beat-16,duration]),phrase(100,104));
  assert.deepEqual(phrase(56,60).map(([name,beat,duration])=>[name,beat-32,duration]),phrase(24,28));
  assert.match(current.octaveReading,/Literal dots are clear/);
  assert.match(current.octaveReading,/No missing dot or engraving error is established/);
  assert.equal(current.octaveIntentStatus,"same-edition-reference-performance-unverified");
  assert.deepEqual(song.sourceFeatures.unsureMeasures,[],"clear pixels are not unresolved OCR; intent has a separate status");
});

test("the 128-beat cut has no invented source rests, final silence, ending expansion or backing",()=>{
  assert.deepEqual(current.melodyRestWindows,[]);
  assert.equal(song.sourceFeatures.sourceTotalBeats,128);
  assert.equal(getPracticeTotalBeats(eventsFor(song.steps),song),128);
  assert.deepEqual(song.steps.at(-1),["A3",124,4]);
  assert.equal(current.endingRestBeats,0);
  assert.equal(current.selectedEndIsFullSongEnding,false);
  assert.match(current.endingDecision,/selected cut.*not the complete song ending/);
  for(const field of ["events","rhythm","autoAccompaniment","practiceAccompaniment"]) assert.equal(song[field],undefined);
  // The old inferred[78.5,79) gap is not adopted as source silence.
  assert.equal(song.steps.some(([,beat,duration])=>beat<=78.5 && beat+duration>=79),true);
});

test("one disclosed semitone shift preserves pitches and fits G3–C5 without octave folding",()=>{
  const allowed=new Set(DISPLAY_KEYS.map(({name})=>name));
  const pitch={C:0,D:2,E:4,F:5,G:7,A:9,B:11};
  const midi=name=>12*(Number(name.slice(1))+1)+pitch[name[0]];
  for(const [name] of song.steps) assert.ok(allowed.has(name));
  assert.deepEqual([...new Set(song.steps.map(([name])=>pitch[name[0]]))].sort((a,b)=>a-b),[0,2,4,7,9,11]);
  const numbers=song.steps.map(([name])=>midi(name));
  assert.deepEqual([Math.min(...numbers),Math.max(...numbers)],[55,72]);
  assert.equal(Math.min(...song.steps.slice(1).map(([,beat],i)=>beat-song.steps[i][1])),.5);
  assert.equal(song.difficulty,"medium"); assert.equal(song.difficulty,archive.difficulty);
  assert.equal(song.key,"C"); assert.equal(song.tuning,"21-key-c");
  assert.equal(current.transpositionSemitones,-1); assert.equal(current.globalOctaveShift,0);
  assert.deepEqual(current.sourceRange,["G#3","C#5"]); assert.deepEqual(current.compiledRange,["G3","C5"]);
  assert.deepEqual(current.sourcePitchClasses,[0,1,3,5,8,10]);
  assert.equal(current.octaveFolding,false); assert.deepEqual(current.localPitchAlterations,[]);
  assert.deepEqual(current.melodyAccidentals,[]);
  assert.match(current.melodyAccidentalScope,/lower chord symbol/);
  assert.match(current.registerConvention,/unmarked 1=C4.*unmarked 1=C#4/);
  assert.equal(song.sourceFeatures.suitability.status,"conditional");
  assert.match(song.sourceFeatures.suitability.reason,/不保证更简单或更好听/);
});

test("tempo, voice, provenance and acceptance claims stay bounded to the chosen edition",()=>{
  assert.equal(current.status,"reviewed-selected-numbered-melody-excerpt");
  assert.equal(current.selectedEdition,"jianpujia-340541-jianhepu-preludes-through-first-chorus");
  assert.equal(current.adoptedInVersion,"2.4.22");
  assert.equal(current.sourceUrl,sourceUrl);
  assert.equal(current.sourceVoice,"explicit-single-numbered-melody");
  assert.match(current.voiceDecision,/lower circled numbers are chord symbols/);
  assert.equal(song.bpm,80); assert.equal(current.practiceBpmChoice,80);
  assert.equal(current.sourceQuarterBpm,null); assert.equal(current.sourceTempoPrinted,false);
  assert.equal(song.sourceFeatures.tempoStatus,"unprinted-practice-choice");
  assert.equal(song.defaultSpeedFactor,.9); assert.equal(song.defaultSpeedFactor,archive.defaultSpeedFactor);
  assert.equal(current.oldEditionReverified,false);
  assert.equal(current.historicalSourceImageIdentityVerified,false);
  assert.equal(current.independentSourcesVerified,false);
  assert.match(current.versionDecision,/not proof that the old edition is wrong/);
  assert.equal(current.sourceAssetHashes.scoreImageSha256,"d3665ec8d9c3155122e440ed36f860213971b86c34265fda78b47ebced441e25");
  assert.equal(current.publicDistributionRights,"unestablished-local-preview-only");
  assert.match(current.rightsNotice,/Public preview\/download access does not establish/);
  for(const field of ["referenceListening","browserAudio","physicalKalimba"]) assert.equal(current[field],"not-performed");
});

test("the complete historical 200-attack JSON is byte-exact and only three bars match",()=>{
  assert.equal(hash(archiveBytes),archiveHash);
  assert.equal(hash(JSON.stringify(archive)),archiveContentHash,"full parsed historical content fingerprint");
  assert.equal(archive.id,song.id); assert.equal(archive.title,"《大鱼》");
  assert.equal(archive.steps.length,200); assert.equal(archive.bpm,80);
  assert.equal(archive.sourceFeatures.sourceTotalBeats,undefined);
  assert.deepEqual(archive.sourceFeatures.unsureMeasures,["m7","m15-m16","m30"]);
  assert.deepEqual(review.historicalSourceFeatures,archive.sourceFeatures);
  assert.deepEqual(archive.steps.at(-1),["A4",124,4]);
  assert.deepEqual(Array.from({length:32},(_,i)=>i+1).filter(m=>JSON.stringify(phrase((m-1)*4,m*4))===JSON.stringify(phrase((m-1)*4,m*4,archive.steps))),[1,3,5]);
  assert.deepEqual(current.legacyComparison.identicalMeasures,[1,3,5]);
  assert.equal(current.legacyComparison.differingMeasureCount,29);
  assert.equal(review.archivedEdition.file,archivePath); assert.equal(review.archivedEdition.fileSha256,archiveHash);
  assert.equal(current.archiveImportPath,undefined); assert.equal(getSongArchiveDownload(song),null);
});

test("all 55 other source files retain frozen 21 bytes, and the archive is excluded from the 56-record source library",async()=>{
  const files=(await readSongFiles()).filter(({fileName})=>fileName!=="xuan-cao-hua-reviewed-support.json");
  assert.equal(files.length,56); assert.equal(Object.keys(frozenOtherFiles).length,55);
  assert.deepEqual(files.map(({fileName})=>fileName).sort(),[...Object.keys(frozenOtherFiles),"da-yu.json"].sort());
  for(const [fileName,expectedHash] of Object.entries(frozenOtherFiles)) {
    const path = fileName === "ping-fan-zhi-lu.json" ? "data/archives/ping-fan-zhi-lu-v2.4.23.json"
      : fileName === "tian-kong-zhi-cheng.json" ? "data/archives/tian-kong-zhi-cheng-v2.4.52.json"
      : fileName === "hong-yan.json" ? "data/archives/hong-yan-v2.4.36.json"
      : fileName === "tong-nian.json" ? "data/archives/tong-nian-v2.4.37.json"
      : fileName === "sheng-sheng-man.json" ? "data/archives/sheng-sheng-man-v2.4.40.json"
      : fileName === "ju-ci-lang-de-xia-tian.json" ? "data/archives/ju-ci-lang-de-xia-tian-v2.4.25.json"
      : fileName === "song-bie.json" ? "data/archives/song-bie-v2.4.28.json"
      : fileName === "qing-cheng-shan-xia-bai-su-zhen.json" ? "data/archives/qing-cheng-shan-xia-bai-su-zhen-v2.4.35.json"
      : fileName === "rang-wo-men-dang-qi-shuang-jiang.json" ? "data/archives/rang-wo-men-dang-qi-shuang-jiang-v2.4.34.json"
      : fileName === "xuan-cao-hua.json" ? "data/archives/xuan-cao-hua-v2.4.27.json" : `data/songs/${fileName}`;
    let historicalBytes = await read(path);
    if (fileName === "interstellar-main-theme.json") {
      const historical = JSON.parse(historicalBytes);
      delete historical.sourceFeatures.meterDisplay;
      delete historical.sourceFeatures.meterDisplayReview;
      historicalBytes = Buffer.from(`${JSON.stringify(historical, null, 2)}\n`);
    }
    // Disclosure-only2.4.43 metadata is not part of this older frozen snapshot.
    if (fileName === "jue-bie-shu.json") {
      const historical = JSON.parse(historicalBytes);
      delete historical.sourceFeatures.sourceReview.currentScopeReview;
      historicalBytes = Buffer.from(`${JSON.stringify(historical, null, 2)}\n`);
    }
    assert.equal(hash(historicalBytes),expectedHash,fileName);
  }
  assert.equal(files.filter(({song:item})=>item.id==="da-yu").length,1);
  assert.ok(files.every(({fileName})=>fileName!=="da-yu-v2.4.21.json"));
  for(const file of ["service-worker.js","serve-kalimba.js","src/song-library.js","src/app.js"]) assert.ok(!(await read(file)).toString().includes("da-yu-v2.4.21.json"),`${file} must not expose/precache internal archive`);
});

test("actual archive parser and isolated save restore an independent local song without replacing 36 canonical cards",()=>{
  withIsolatedStorage(()=>{
    const library=getSongLibrary(); library[song.id]=normalized(song);
    const prior=JSON.stringify(library), ids=getPracticeSongs(library).map(({id})=>id).sort();
    assert.equal(ids.length,36);
    assert.equal(getPracticeSongId(library,"da-yu"),"da-yu");
    assert.equal(getPracticeSongId(library,"da-yu-chord"),"da-yu","old arrangement link resolves to the new canonical melody");
    const [restored]=parseImportedSongs(archiveBytes.toString(),library);
    assert.deepEqual(restored.steps,archive.steps); assert.deepEqual(restored.sourceFeatures,archive.sourceFeatures);
    assert.equal(restored.title,archive.title); assert.equal(restored.practiceTitle,`${archive.title}主旋律版练习轨道`);
    assert.equal(restored.scoreTitle,`${archive.title}主旋律版简谱进度`); assert.equal(restored.hint,archive.hint);
    assert.equal(restored.bpm,archive.bpm); assert.equal(restored.defaultSpeedFactor,archive.defaultSpeedFactor);
    assert.equal(restored.difficulty,archive.difficulty); assert.equal(restored.beatsPerMeasure,archive.beatsPerMeasure);
    assert.equal(restored.source,"local"); assert.equal(restored.schemaVersion,2);
    assert.notEqual(restored.id,song.id); assert.notEqual(restored.baseSongId,song.id);
    assert.ok(restored.events.every(event=>event.notes.length===1 && event.notes[0].role==="melody" && event.notes[0].judge));
    saveCustomSongs([restored]); const [saved]=getCustomSongs();
    assert.deepEqual(saved.steps,archive.steps); assert.deepEqual(saved.sourceFeatures,archive.sourceFeatures);
    const reconstructed={...archive,steps:saved.steps,sourceFeatures:saved.sourceFeatures};
    assert.equal(hash(JSON.stringify(reconstructed)),archiveContentHash,"restored music and source history reconstruct the complete parsed archive");
    assert.equal(JSON.stringify(library),prior); assert.equal(library[song.id].steps.length,162);
    assert.deepEqual(getPracticeSongs(library).map(({id})=>id).sort(),ids);
    const merged={...library,[restored.id]:restored}; assert.equal(getPracticeSongs(merged).length,37);
    assert.equal(getPracticeSongId(merged,restored.id),restored.id);
    const [again]=parseImportedSongs(archiveBytes.toString(),merged); assert.notEqual(again.id,restored.id);
    assert.deepEqual(again.steps,archive.steps);
  });
});

test("old V2 and its 62 auto events stay byte-frozen and cannot match the new melody",()=>{
  assert.equal(hash(oldV2Bytes),oldV2Hash); assert.equal(oldV2.events.length,200);
  assert.equal(oldV2.autoAccompaniment.events.length,62); assert.equal(oldV2.practiceAccompaniment,undefined);
  assert.deepEqual(oldV2.events.map(({beat,duration,notes})=>[notes.find(note=>note.role==="melody").name,beat,duration]),archive.steps);
  assert.equal(hasMatchingPracticeMelody(archive,oldV2),true,"historical layers share one old transcription, not independent evidence");
  assert.equal(hasMatchingPracticeMelody(song,song),true);
  assert.equal(hasMatchingPracticeMelody(song,archive),false); assert.equal(hasMatchingPracticeMelody(song,oldV2),false);
  assert.equal(song.bpm,oldV2.bpm,"same tempo does not hide 162-versus-200 mismatch");
  assert.equal(getPracticeTotalBeats(eventsFor(song.steps),song),getPracticeTotalBeats(oldV2.events,oldV2),"same 128-beat extent does not hide changed content");
});

test("actual app support selection rejects a synthetic reduced copy of legacy backing",async()=>{
  const app=(await read("src/app.js")).toString();
  const helpers=["getSongVariants","getPracticeAccompanimentSource"].map(name=>{
    const source=app.match(new RegExp(`^    function ${name}\\([^]*?^    }`,"m"))?.[0]; assert.ok(source); return source;
  }).join("\n");
  const selected=normalized(song);
  const legacy={...structuredClone(oldV2),steps:archive.steps};
  // Old file has no reduced support: this copy only proves that adding a
  // candidate with the same title/id would still fail the real content guard.
  legacy.practiceAccompaniment=structuredClone(oldV2.autoAccompaniment);
  const context={songLibrary:{[song.id]:selected,[legacy.id]:legacy},getSongBaseId,getSongVersionRank,getSongAccompanimentProvider,hasMatchingPracticeMelody};
  runInNewContext(helpers,context);
  assert.equal(context.getPracticeAccompanimentSource(selected),null);
  assert.equal(context.getPracticeAccompanimentSource(normalized(archive)).id,legacy.id,"positive control exercises the actual provider path");
});

const mutations={
  "split-m20-tie":value=>{const i=value.steps.findIndex(([,beat])=>beat===76.5);value.steps.splice(i,1,["E4",76.5,.5],["E4",77,2]);},
  "invent-old-gap":value=>{value.steps.find(([,beat])=>beat===76.5)[2]=2;},
  "merge-genuine-m16-repluck":value=>{const i=value.steps.findIndex(([,beat])=>beat===60);value.steps.splice(i,2,["A3",60,3.5]);},
  "merge-genuine-m28-repluck":value=>{const i=value.steps.findIndex(([,beat])=>beat===108);value.steps.splice(i,2,["E4",108,3.5]);},
  "add-unprinted-m26-octave-dot":value=>{value.steps.find(([,beat])=>beat===100)[0]="C5";},
  "erase-printed-m27-paired-octave-dot":value=>{value.steps.find(([,beat])=>beat===105.5)[0]="C4";},
  "copy-m26-into-later-m30":value=>{value.steps=value.steps.filter(([,beat])=>beat<116||beat>=120).concat(bars[25].map(([name,beat,duration])=>[name,beat+16,duration])).sort((a,b)=>a[1]-b[1]);},
  "naturalize-lower-chord-sharp-into-melody":value=>{value.steps.find(([,beat])=>beat===86)[0]="F4";},
  "shorten-final-written-hold":value=>{value.steps.at(-1)[2]=3;},
  "invent-final-rest-extent":value=>{value.sourceFeatures.sourceTotalBeats=129;}
};
for(const [label,mutate] of Object.entries(mutations)) test(`independent source fixture rejects ${label}`,()=>{
  const changed=structuredClone(song); mutate(changed); assert.throws(()=>checkTranscriptionEvidence(changed,evidence));
});
