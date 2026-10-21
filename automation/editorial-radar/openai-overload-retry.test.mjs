import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchOpenAI} from './openai-overload-retry.mjs';
const overload=()=>new Response(JSON.stringify({error:{code:'server_is_overloaded'}}),{status:503});
function fixture(responses) {
  const calls=[],delays=[],logs=[];
  return {calls,delays,logs,options:{fetchImpl:async (...args)=>{calls.push(args); const next=responses.shift(); if(next instanceof Error) throw next; return next;},wait:async ms=>delays.push(ms),onRetry:event=>logs.push(event)}};
}
test('successful request is made once with original body and response',async()=>{
  const f=fixture([new Response('{"usage":{"total_tokens":12}}')]);
  const options={method:'POST',body:'original'};
  const result=await fetchOpenAI('url',options,f.options);
  assert.equal(f.calls.length,1); assert.equal(f.calls[0][1],options);
  assert.equal(result.raw,'{"usage":{"total_tokens":12}}'); assert.deepEqual(f.delays,[]);
});
test('explicit overload retries at most twice with same request',async()=>{
  const f=fixture([overload(),overload(),new Response('ok')]);
  const options={body:'unchanged'};
  assert.equal((await fetchOpenAI('url',options,f.options)).raw,'ok');
  assert.deepEqual(f.delays,[5000,10000]); assert.equal(f.logs.length,2);
  assert.ok(f.calls.every(call=>call[1]===options));
});
test('persistent overload returns final rejection after three attempts',async()=>{
  const f=fixture([overload(),overload(),overload()]);
  assert.equal((await fetchOpenAI('url',{},f.options)).res.status,503);
  assert.equal(f.calls.length,3);
});
test('other HTTP failures and malformed responses are never replayed',async()=>{
  for(const [status,raw] of [[400,'bad'],[401,'bad'],[429,'quota'],[500,'bad'],[502,'bad'],[503,'unavailable'],[503,'{"error":{"code":"other"}}'],[200,'invalid json']]) {
    const f=fixture([new Response(raw,{status})]);
    assert.equal((await fetchOpenAI('url',{},f.options)).raw,raw);
    assert.equal(f.calls.length,1); assert.deepEqual(f.delays,[]);
  }
});
test('ambiguous network failure is not replayed',async()=>{
  const f=fixture([new Error('network')]);
  await assert.rejects(fetchOpenAI('url',{},f.options),/network/);
  assert.equal(f.calls.length,1);
});