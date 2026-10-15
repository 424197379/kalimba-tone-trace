import { getSongDisplayTitle } from "../src/song-presentation.js";
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import { getSongAccompanimentProvider, hasMatchingPracticeMelody, getSongPracticeHint, getSongBaseId, getSongVersionRank, getSongReviewNotice, shouldExpandSongReviewNotice, getSongArchiveDownload, getSongLibrary, getPracticeSongId, parseImportedSongs } from '../src/song-store.js';
const base = { id:'same-name',schemaVersion:1,bpm:88,steps:[['C4',0,1],['D4',1,1]] };
const counterpart = () => ({...base,schemaVersion:2,steps:undefined,events:base.steps.map(([name,beat,duration])=>({beat,duration,notes:[{name:'C6',role:'harmony',judge:true},{name,role:'melody',judge:true}]}))});

test('support inheritance compares explicit melody content, never the highest note or matching name',()=>{
 const candidate=counterpart();
 assert.equal(hasMatchingPracticeMelody(base,candidate),true);
 assert.equal(hasMatchingPracticeMelody({...base,id:'different-id'},candidate),true);
 candidate.events[1].notes[1].name='E4';
 assert.equal(hasMatchingPracticeMelody(base,candidate),false);
});

test('different timebase, durations, tempo and ending rests cannot borrow sibling backing',()=>{
 for(const change of [c=>c.events[1].beat+=.25,c=>c.events[1].duration+=.5,c=>c.bpm=90,c=>c.events.pop(),c=>c.sourceFeatures={sourceTotalBeats:3}]){
  const c=counterpart();change(c);assert.equal(hasMatchingPracticeMelody(base,c),false);
 }
 const rounded=counterpart();rounded.events[1].beat+=1e-12;assert.equal(hasMatchingPracticeMelody(base,rounded),true);
});

test('ambiguous roles and malformed melodies fail compatibility without guessing or throwing',()=>{
 for(const change of [c=>c.events[0].notes[0].role='melody',c=>c.events[0].notes.forEach(n=>n.role='bass'),c=>c.events[0].notes[1].judge=false,c=>c.events[0].duration=NaN,c=>c.events[0].notes[1].name='C#4']){
  const c=counterpart();change(c);assert.equal(hasMatchingPracticeMelody(base,c),false);
 }
 for(const candidate of [null,{}, {bpm:88,steps:[]}, {...base,steps:[['C4',0,Infinity]]}]) assert.equal(hasMatchingPracticeMelody(base,candidate),false);
});

test('developer archive lookup accepts only the known selected-edition archive',()=>{
 const scope={status:'reviewed-selected-short-arrangement',archiveImportPath:'data/archives/jasmine-walter-v2.4.3.json'};
 const song={id:'jasmine',sourceFeatures:{sourceReview:{currentScopeReview:scope}}};
 assert.equal(getSongArchiveDownload({sourceFeatures:song.sourceFeatures}),null,'an archive disclosure must belong to its approved song');
 assert.deepEqual(getSongArchiveDownload(song),{href:'./data/archives/jasmine-walter-v2.4.3.json',filename:'jasmine-walter-v2.4.3.json',label:'旧长版 JSON · 可导入还原'});
 for(const path of ['https://example.com/private.json','../secret.json','data/archives/unknown.json','javascript:alert(1)']){
  scope.archiveImportPath=path;assert.equal(getSongArchiveDownload(song),null);
 }
 assert.equal(getSongArchiveDownload(null),null);
});

test('the exact archived 145-note edition imports independently without replacing the selected short melody',async()=>{
 globalThis.localStorage={getItem:()=>null};
 const library=getSongLibrary();
 const raw=await readFile(new URL('../data/archives/jasmine-walter-v2.4.3.json',import.meta.url),'utf8');
 const original=JSON.parse(raw),before=JSON.stringify(library.jasmine);
 const [restored]=parseImportedSongs(raw,library);
 assert.equal(original.steps.length,145);
 assert.deepEqual(restored.steps,original.steps);
 assert.equal(restored.bpm,original.bpm);
 assert.notEqual(restored.id,'jasmine');
 assert.notEqual(restored.baseSongId,'jasmine');
 assert.equal(JSON.stringify(library.jasmine),before);
 const merged={...library,[restored.id]:restored};
 assert.equal(getPracticeSongId(merged,restored.id),restored.id);
 assert.equal(getPracticeSongId(merged,'jasmine-chord'),'jasmine');
 assert.equal(library.jasmine.steps.length,67);
 assert.equal(hasMatchingPracticeMelody(library.jasmine,library['jasmine-chord']),false);
 assert.equal(hasMatchingPracticeMelody(library['song-bie'],library['song-bie-chord']),false);
 assert.equal(hasMatchingPracticeMelody(library['mi-xue-bing-cheng-theme'],library['mi-xue-bing-cheng-theme-chord']),false);
 assert.equal(hasMatchingPracticeMelody(library['interstellar-main-theme'],library['interstellar-main-theme-chord']),false);
 for(const id of ['birthday','xiao-xing-xing']) assert.equal(hasMatchingPracticeMelody(library[id],library[id+'-chord']),true);
});


test('practice metadata preserves source warnings in data and never requests removed review DOM',async()=>{
 const app=await readFile(new URL('../src/app.js',import.meta.url),'utf8');
 const body=app.match(/^    function applySongMeta\(\) \{[\s\S]*?^    \}/m)[0];
 const supportHelpers=['getSongVariants','getPracticeAccompanimentSource'].map(name=>{
  const source=app.match(new RegExp(`^    function ${name}\\([^]*?^    }`,'m'))?.[0];
  assert.ok(source,`Missing production helper ${name}`);return source;
 }).join('\n');
 const domRequests=[];
 const library=getSongLibrary();
 const c={getSongDisplayTitle,currentSong:library.jasmine,songLibrary:library,getSongPracticeHint,getSongBaseId,getSongVersionRank,getSongAccompanimentProvider, hasMatchingPracticeMelody,document:{getElementById(id){domRequests.push(id);assert.fail(`practice metadata queried removed review DOM: ${id}`);}},practiceTitle:{},practiceHint:{},currentSongText:{},songSpeedBtn:{setAttribute(name, value) { this[name] = value; }},applySongVersionControl(){},applyAccompanimentControl(){},getSongDefaultSpeedFactor:()=>1,setCompactIcon(){}};
 runInNewContext(`${supportHelpers}\n${body}`,c);
 c.applySongMeta();
 assert.deepEqual(domRequests,[]);
 assert.match(getSongReviewNotice(library.jasmine),/黄秀泉14小节短版.*末尾1拍休止/);
 assert.doesNotMatch(getSongReviewNotice(library.jasmine),/导入还原|旧145音版/);
 assert.equal(c.currentSongText.title,getSongDisplayTitle(library.jasmine));
 for(const id of ['tian-kong-zhi-cheng','yun-yan-cheng-yu','interstellar-main-theme']){
  c.currentSong=library[id];c.applySongMeta();
  assert.deepEqual(domRequests,[],id);
  assert.ok(getSongReviewNotice(library[id]),id);
  assert.equal(shouldExpandSongReviewNotice(library[id]),true,"legacy source classification is preserved without a practice disclosure");
  assert.equal(c.currentSongText.title,getSongDisplayTitle(library[id]),id);
 }
});

test('imported provider requires local identity, same base and complete explicit compatible melody',()=>{
 const song={...base,source:'local'};
 const backing={volume:.72,events:[{beat:0,duration:.5,notes:[{name:'G3',role:'bass',velocity:.8}]}]};
 const candidate={...counterpart(),id:'local-source',baseSongId:base.id,source:'local',autoAccompaniment:backing};
 const result=getSongAccompanimentProvider(song,[candidate]);
 assert.equal(result.song,candidate);assert.equal(result.config,backing);assert.equal(result.kind,'imported-auto');
 for(const alter of [
  s=>{s.source='system'},s=>{delete s.source},s=>{s.baseSongId='unrelated'},s=>{s.bpm+=1},
  s=>{s.events[0].notes[1].name='E4'},s=>{s.events[0].beat=.25},s=>{s.events[0].duration=.5},
  s=>{s.events[0].notes[1].role='bass'},s=>{s.events[0].notes[1].judge=false},
  s=>{s.events[0].notes[0].role='melody'},s=>{s.events.pop()},s=>{s.sourceFeatures={sourceTotalBeats:3}}
 ]){
  const changed=structuredClone(candidate);alter(changed);
  assert.equal(getSongAccompanimentProvider(song,[changed]),null,String(alter));
  assert.equal(getSongAccompanimentProvider(song,[changed],true),null,'original lookup cannot bypass local source guards');
 }
 assert.equal(getSongAccompanimentProvider({...song,source:'system'},[candidate]),null);
 const own={...candidate,id:base.id,baseSongId:base.id};
 assert.equal(getSongAccompanimentProvider(own,[]).song,own);
 own.events[0].notes[1].role='bass';
 assert.equal(getSongAccompanimentProvider(own,[]),null,'own imported config also needs an explicit valid melody');
});

test('provider selects one whole layer deterministically: practice first, own auto then stable sibling rank/id',()=>{
 const song={...base,source:'local'};
 const config=tag=>({tag,volume:.4,events:[{beat:0,duration:.5,notes:[{name:'G3',role:'bass',velocity:.4}]}]});
 const a={...counterpart(),id:'a-source',baseSongId:song.id,source:'local',autoAccompaniment:config('a')};
 const z={...structuredClone(a),id:'z-source',autoAccompaniment:config('z')};
 for(const variants of [[z,a],[a,z]]) assert.equal(getSongAccompanimentProvider(song,variants).song,a);
 z.arrangementKind='melody';a.arrangementKind='chord';
 assert.equal(getSongAccompanimentProvider(song,[a,z]).song,z,'same established rank then id ordering');
 song.autoAccompaniment=config('own');
 assert.equal(getSongAccompanimentProvider(song,[z,a]).song,song);
 a.practiceAccompaniment=config('light');
 assert.equal(getSongAccompanimentProvider(song,[z,a]).song,a);
 assert.equal(getSongAccompanimentProvider(song,[z,a]).config,a.practiceAccompaniment);
 assert.equal(getSongAccompanimentProvider(song,[z,a]).kind,'light');
 assert.equal(getSongAccompanimentProvider(song,[z,a],true).config,song.autoAccompaniment);
 assert.equal(a.autoAccompaniment.tag,'a','neither selected practice nor auto mutates the other layer');
});

test('all 36 built-in initial providers retain pre-import-memory selection and mismatched legacy backing stays unavailable',()=>{
 const previous=globalThis.localStorage;let library;
 try{globalThis.localStorage={getItem:()=>null};library=getSongLibrary();}
 finally{if(previous===undefined)delete globalThis.localStorage;else globalThis.localStorage=previous;}
 const canonical=Object.values(library).filter(song=>getPracticeSongId(library,song.id)===song.id);
 assert.equal(canonical.length,36);
 for(const song of canonical){
  const siblings=Object.values(library).filter(candidate=>getSongBaseId(candidate)===getSongBaseId(song))
   .sort((a,b)=>getSongVersionRank(a)-getSongVersionRank(b)||a.id.localeCompare(b.id,'en'));
  const practice=song.practiceAccompaniment?.events?.length&&hasMatchingPracticeMelody(song,song)?song:
   siblings.find(candidate=>candidate.practiceAccompaniment?.events?.length&&hasMatchingPracticeMelody(song,candidate));
  const original=song.autoAccompaniment?.events?.length?song:
   siblings.find(candidate=>candidate.autoAccompaniment?.events?.length&&hasMatchingPracticeMelody(song,candidate));
  const provider=getSongAccompanimentProvider(song,siblings);
  assert.equal(provider?.song,practice||original,song.id);
  if(provider)assert.equal(provider.kind,practice?'light':'original',song.id);
 }
 for(const id of ['jasmine','song-bie','mi-xue-bing-cheng-theme','interstellar-main-theme','tong-nian','tai-yang-zhao-chang-sheng-qi']){
  assert.equal(getSongAccompanimentProvider(library[id],Object.values(library)),null,id);
 }
});
