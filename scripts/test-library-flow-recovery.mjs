import { getSongDisplayTitle } from "../src/song-presentation.js";
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import * as store from '../src/song-store.js';
import { getPracticeTotalBeats } from '../src/practice-loop.js';
import { readPracticeHistory, readSongSpeed, PRACTICE_HISTORY_STORAGE_KEY } from '../src/practice-preferences.js';

const source=await readFile(new URL('../src/song-library.js',import.meta.url),'utf8');
const production=source.slice(source.indexOf('function getSelectedSongId('),source.indexOf('function showImportMessage('));
const previousStorage=globalThis.localStorage;
globalThis.localStorage={getItem:()=>null};
const library=store.getSongLibrary();
if(previousStorage===undefined)delete globalThis.localStorage;else globalThis.localStorage=previousStorage;

function element(tag='div') {
  let content='';
  const e={tag,children:[],attrs:{},handlers:{},hidden:false,disabled:false,value:'',className:'',
    focus(){this.focused=true;},classList:{add(){}},setAttribute(k,v){this.attrs[k]=v;},
    addEventListener(k,f){this.handlers[k]=f;},append(...items){this.children.push(...items);},
    appendChild(item){this.children.push(item);},replaceChildren(...items){this.children=items;},
    get textContent(){return content;},set textContent(v){content=String(v);this.children=[];}};
  return e;
}
const descendants=e=>[e,...e.children.flatMap(descendants)];
function harness({query='',difficulty='all',selected='birthday',stored='jasmine',historyFails=false}={}){
  let storedId=stored;const writes=[],replaces=[];const values=new Map();
  const location={href:`http://localhost/songs.html?selected=${selected}&keep=1#library`,get search(){return new URL(this.href,'http://localhost/').search;}};
  const history={state:{keep:'state'},replaceState(state,title,url){if(historyFails)throw Error('history denied');replaces.push({state,title,url});location.href=url;}};
  const nodes=Object.fromEntries(['songList','songSearchInput','songCountText','difficultyTabs','emptySongText','practiceHistoryMessage','libraryRefreshMessage','localSongCountText','localSongEmptyText','localSongList'].map(id=>[id,element()]));
  nodes.songSearchInput.value=query;
  const context={...store,...nodes,getSongDisplayTitle,URL,URLSearchParams,withCustomSongWriteLock:async write=>write(),window:{location,history},document:{createElement:element},
    songLibrary:structuredClone(library),activeDifficulty:difficulty,selectedSongOverride:null,importingSong:false,deletingSong:false,pendingDeleteBaseSongId:null,pendingDeleteSnapshot:null,confirmDeleteBtn:{},importSongBtn:{},
    getPracticeTotalBeats,readSongSpeed,readPracticeHistory,
    browserPreferenceStorage:{getItem:k=>values.get(k)??null},
    readStoredSongId:()=>storedId,storeSongId:id=>{writes.push(id);storedId=id;},
    // This suite isolates selection/filter behavior; the complete-entry draft
    // suite exercises real persistence and failed-navigation guards.
    prepareImportDraftForLeave:()=>true,clearImportDraftAfterSave:()=>true,rememberLibraryView:()=>{},pendingImportDraftRestore:null,importDraftSaveRevision:0,
    openDeleteConfirm:()=>{}};
  runInNewContext(production,context);
  return {c:context,nodes,writes,replaces,values};
}

test('a different difficulty explains real search matches and clears only the filter',()=>{
  const h=harness({query:'生日快乐',difficulty:'hard'});h.c.renderSongList();
  assert.equal(h.nodes.songCountText.textContent,'显示 0 / 1 首');
  assert.match(h.nodes.emptySongText.textContent,/困难.*暂无匹配/);
  const action=h.nodes.emptySongText.children[0];assert.equal(action.textContent,'查看匹配的 1 首');
  assert.equal(action.type,'button');action.handlers.click();
  assert.equal(h.c.activeDifficulty,'all');assert.equal(h.nodes.songSearchInput.value,'生日快乐');assert.equal(h.nodes.songSearchInput.focused,true);
  assert.equal(h.nodes.songCountText.textContent,'显示 1 / 1 首');assert.equal(h.nodes.emptySongText.hidden,true);
  assert.equal(h.nodes.songList.children.length,1);assert.deepEqual(h.writes,[]);
});

test('genuinely absent title has no misleading filter recovery action',()=>{
  const h=harness({query:'不存在的验收曲',difficulty:'hard'});h.c.renderSongList();
  assert.equal(h.nodes.emptySongText.textContent,'没有找到匹配的歌曲');assert.equal(h.nodes.emptySongText.children.length,0);
  assert.equal(h.c.activeDifficulty,'hard');
});

test('editing search removes stale recovery actions and preserves intentional difficulty',()=>{
  const h=harness({query:'生日快乐',difficulty:'hard'});h.c.renderSongList();
  h.nodes.songSearchInput.value='天空之城';h.c.renderSongList();
  assert.equal(h.nodes.emptySongText.children.length,1);
  h.nodes.songSearchInput.value='星际';h.c.renderSongList();
  assert.equal(h.nodes.emptySongText.hidden,true);assert.equal(h.nodes.emptySongText.children.length,0);
  assert.equal(h.c.activeDifficulty,'hard');
});

test('explicit initial deep link stays authoritative until an intentional selection',()=>{
  const h=harness({selected:'birthday-chord',stored:'jasmine'});
  assert.equal(h.c.getSelectedSongId(),'birthday');assert.deepEqual(h.writes,[]);
  h.c.rememberLibrarySelection('jasmine-chord');
  assert.equal(h.c.getSelectedSongId(),'jasmine');assert.deepEqual(h.writes,['jasmine']);
  const url=new URL(h.replaces[0].url);assert.equal(url.searchParams.get('selected'),'jasmine');
  assert.equal(url.searchParams.get('keep'),'1');assert.equal(url.hash,'#library');
  assert.equal(h.replaces[0].state,h.c.window.history.state);
});

test('choosing another song repairs the Back destination without adding a history entry',()=>{
  const h=harness();h.c.selectSong('jasmine-chord');
  assert.equal(h.c.window.location.href,'./index.html?song=jasmine&fromLibrary=1');
  assert.equal(h.replaces.length,1);assert.equal(new URL(h.replaces[0].url).searchParams.get('selected'),'jasmine');
  h.c.window.location.href=h.replaces[0].url;
  assert.equal(h.c.getSelectedSongId(),'jasmine');h.c.renderSongList();
  const current=h.nodes.songList.children.flatMap(descendants).filter(n=>n.attrs['aria-label']==='练习《茉莉花》');
  assert.equal(current.length,1);
  assert.match(source,/window\.addEventListener\("pageshow", reloadLibraryViews\)/,'bfcache return rerenders selection');
});

test('history denial retains session choice and does not prevent valid navigation',()=>{
  const h=harness({historyFails:true});h.c.selectSong('jasmine');
  assert.equal(h.c.getSelectedSongId(),'jasmine');assert.equal(h.c.window.location.href,'./index.html?song=jasmine&fromLibrary=1');
  assert.deepEqual(h.writes,['jasmine']);assert.equal(h.replaces.length,0);
});

test('missing or prototype ids cannot mutate selection or history',()=>{
  const h=harness();for(const id of ['missing','__proto__','constructor',null])h.c.rememberLibrarySelection(id);
  assert.equal(h.c.getSelectedSongId(),'birthday');assert.deepEqual(h.writes,[]);assert.deepEqual(h.replaces,[]);
});

test('local management exposes direct single-melody practice with literal title and unchanged delete',()=>{
  const h=harness();const song={...h.c.songLibrary.birthday,id:'local-flow',baseSongId:'local-flow',source:'local',title:'<img src=x> 流程'};
  h.c.songLibrary[song.id]=song;
  const item=h.c.createLocalSongItem({primary:song,baseSongId:song.id,practiceReady:true});
  const nodes=descendants(item),button=nodes.find(n=>n.className==='ghost local-practice-btn');
  assert.equal(button.textContent,'练习');assert.equal(button.attrs['aria-label'],'练习<img src=x> 流程');
  assert.ok(nodes.some(n=>n.textContent===song.title));assert.equal(nodes.filter(n=>n.tag==='button').length,2);
  assert.equal(nodes.filter(n=>n.textContent==='删除').length,1);
  button.handlers.click();assert.equal(h.c.window.location.href,'./index.html?song=local-flow&fromLibrary=1');
});

test('unresolved local source gets no unsafe practice action',()=>{
  const h=harness(),item=h.c.createLocalSongItem({primary:h.c.songLibrary.birthday,practiceReady:false});
  const nodes=descendants(item);assert.equal(nodes.some(n=>n.className==='ghost local-practice-btn'),false);
  assert.equal(nodes.filter(n=>n.textContent==='删除').length,1);
});

test('empty recovery does not mark practice or change recent-practice ordering',()=>{
  const h=harness({query:'生日快乐',difficulty:'hard'});
  h.values.set(PRACTICE_HISTORY_STORAGE_KEY,JSON.stringify({schemaVersion:1,songs:{jasmine:{lastPracticedAt:200},birthday:{lastPracticedAt:100}}}));
  const before=[...h.values];h.c.renderSongList();h.nodes.emptySongText.children[0].handlers.click();
  assert.deepEqual([...h.values],before);assert.deepEqual(h.writes,[]);
});

test('actual successful import repairs stale URL and exposes immediate practice; failed retry preserves it',async()=>{
  const old=globalThis.localStorage,values=new Map(),storageWrites=[];
  globalThis.localStorage={getItem:k=>values.get(k)??null,setItem(k,v){storageWrites.push(k);values.set(k,v);}};
  try{
    const h=harness({selected:'birthday',difficulty:'hard',query:'生日快乐'}),c=h.c;
    const fixture={schemaVersion:2,title:'流程新曲',bpm:96,beatsPerMeasure:4,difficulty:'easy',events:[{beat:0,duration:1,notes:[{name:'E4',role:'melody',judge:true}]}]};
    Object.assign(c,{songJsonInput:{value:JSON.stringify(fixture)},importingSong:false,performance:{now:()=>0},
      waitForPaint:async()=>{},waitForThinkingMinimum:async()=>{},setImportBusy:on=>{c.importingSong=on;},
      showImportMessage:(text,kind)=>{c.lastMessage={text,kind};},getImportSuccessMessage:()=> '已添加',
      refreshLibraryViews:()=>{c.renderSongList();c.renderLocalSongManager();}});
    const fn=source.match(/^async function importSongFromJson\([^]*?^\}/m)?.[0];assert.ok(fn);runInNewContext(fn,c);
    await c.importSongFromJson();
    assert.equal(c.lastMessage.kind,'success');assert.equal(c.importingSong,false);
    const imported=store.getPracticeSongs(c.songLibrary).find(s=>s.title===fixture.title);assert.ok(imported);
    assert.equal(c.getSelectedSongId(),imported.id);assert.equal(new URL(c.window.location.href).searchParams.get('selected'),imported.id);
    assert.equal(c.songJsonInput.value,'');assert.equal(c.activeDifficulty,'all');assert.equal(c.songSearchInput.value,'');
    const practice=descendants(c.localSongList).find(n=>n.attrs['aria-label']==='练习流程新曲');assert.ok(practice);
    assert.equal(c.window.location.href.includes('index.html'),false,'import does not auto-start or navigate');
    const before=new Map(values),selection=c.getSelectedSongId(),href=c.window.location.href,writes=storageWrites.length;
    const bad=JSON.stringify([fixture,{...fixture,title:'第二首',events:[{beat:0,duration:1,notes:[{name:'C#4',role:'melody',judge:true}]}]}]);
    c.songJsonInput.value=bad;await c.importSongFromJson();
    assert.equal(c.lastMessage.kind,'error');assert.match(c.lastMessage.text,/第 2 首歌曲.*第二首.*C#4/);
    assert.equal(c.songJsonInput.value,bad);assert.deepEqual(values,before);assert.equal(storageWrites.length,writes);
    assert.equal(c.getSelectedSongId(),selection);assert.equal(c.window.location.href,href);
  }finally{if(old===undefined)delete globalThis.localStorage;else globalThis.localStorage=old;}
});

test('deleting stale stored local song preserves unrelated explicit choice, while deleting current choice resets safely',async()=>{
  for(const selected of ['jasmine','local-old']){
    const h=harness({selected,stored:'local-old'}),c=h.c;
    c.songLibrary['local-old']={...c.songLibrary.birthday,id:'local-old',baseSongId:'local-old',source:'local'};
    // This focused selection fixture still isolates the deletion result, but its
    // confirmation evidence now comes from the real store read of that record.
    const previousStorage=globalThis.localStorage;
    let snapshot;
    try {
      globalThis.localStorage={getItem:key=>key===store.CUSTOM_SONGS_STORAGE_KEY?JSON.stringify([c.songLibrary['local-old']]):null};
      snapshot=store.getCustomSongGroupSnapshot(store.getCustomSongs());
      assert.ok(snapshot);
    } finally { if(previousStorage===undefined)delete globalThis.localStorage;else globalThis.localStorage=previousStorage; }
    Object.assign(c,{pendingDeleteBaseSongId:'local-old',pendingDeleteSnapshot:snapshot,pendingDeleteFocusTarget:null,cancelDeleteBtn:{},
      // Focus is covered by the production-modal suite; retain this fixture's selection/storage isolation.
      restoreDeleteFocus:()=>{},
      deleteCustomSongGroup:(id,evidence)=>{assert.equal(id,'local-old');assert.equal(evidence,snapshot);return {ids:['local-old'],title:'旧本地曲'};},
      closeDeleteConfirm:()=>{},getSongLibrary:()=>structuredClone(library),refreshLibraryViews:()=>{},showImportMessage:()=>{}});
    const fn=source.match(/^async function confirmDeleteCustomSong\([^]*?^\}/m)?.[0];assert.ok(fn);runInNewContext(fn,c);
    await c.confirmDeleteCustomSong();
    if(selected==='jasmine'){
      assert.equal(c.getSelectedSongId(),'jasmine');assert.equal(new URL(c.window.location.href).searchParams.get('selected'),'jasmine');
      assert.deepEqual(h.writes,['jasmine']);assert.equal(h.replaces.length,0);
    }else{
      assert.equal(c.getSelectedSongId(),'birthday');assert.equal(new URL(c.window.location.href).searchParams.get('selected'),'birthday');
      assert.deepEqual(h.writes,['birthday']);assert.equal(h.replaces.length,1);
    }
  }
});
