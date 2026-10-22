import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {statusResponse} from '../src/status.js';
import {PREFIX,read,write} from '../src/common.js';
function environment(){
 const data=new Map();const store={read:k=>data.get(k),write:(v,k)=>{data.set(k,v);return true;}};
 write(store,'session',{cookie:'SESSDATA=private-fixture',until:Date.now()+86400000});
 write(store,'diagnostics',[]);write(store,'some-score',{score:.4});return store;
}
const url='https://www.bilibili.com/noaitext-status';
function form(store,extra={}){return {url,method:'POST',body:new URLSearchParams({action:'clear-session',confirm:'yes',nonce:read(store,'statusClearNonce').value,...extra}).toString()};}
test('local status GET displays consent without deleting session or disclosing credentials',()=>{
 const store=environment(),result=statusResponse({url},store);
 assert.ok(read(store,'session'));assert.match(result.response.body,/确认清除本机保存/);assert.doesNotMatch(result.response.body,/private-fixture/);
 assert.deepEqual(statusResponse({url:'https://example.com/noaitext-status'},store),{});
});
test('clear requires POST, explicit consent and a current token; replay cannot clear a new session',()=>{
 const store=environment();statusResponse({url},store);
 const bad=form(store,{confirm:'no'});statusResponse(bad,store);assert.ok(read(store,'session'));
 const foreign=form(store,{nonce:'foreign'});statusResponse(foreign,store);assert.ok(read(store,'session'));
 const valid=form(store);const result=statusResponse(valid,store);assert.equal(read(store,'session'),null);assert.match(result.response.body,/已清除本机保存/);
 assert.deepEqual(read(store,'some-score'),{score:.4});
 write(store,'session',{cookie:'new-session'});statusResponse(valid,store);assert.ok(read(store,'session'));
});
test('expired form and GET query cannot erase session',()=>{
 const store=environment();statusResponse({url},store);const request=form(store);
 const nonce=read(store,'statusClearNonce');write(store,'statusClearNonce',{...nonce,until:Date.now()-1});
 statusResponse(request,store);assert.ok(read(store,'session'));
 statusResponse({url:url+'?action=clear-session&confirm=yes'},store);assert.ok(read(store,'session'));
});
test('built Shadowrocket status entry processes confirmation and returns a local response',async()=>{
 const store=environment(),script=await readFile(new URL('../dist/NoAIText-iOS-Title-0.4.3/Script/NoAIText.Status.js',import.meta.url),'utf8');
 function run(request){let output;vm.runInNewContext(script,{$request:request,$persistentStore:store,$done:r=>{output=r;},console});return output;}
 const page=run({url});assert.equal(page.response.status,200);assert.match(page.response.body,/name="nonce"/);
 const result=run(form(store));assert.equal(result.response.status,200);assert.equal(read(store,'session'),null);
 assert.doesNotMatch(result.response.body,/private-fixture/);
});
