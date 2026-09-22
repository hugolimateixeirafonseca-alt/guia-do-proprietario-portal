import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
for(const file of ['limpezas.js','alojamento-local-cleaning.js'])test(file+' reuses submission ID after error and blocks double submit',async()=>{
 const full=readFileSync(new URL('../public/scripts/landings/'+file,import.meta.url),'utf8');const start=full.indexOf('  let submissionInFlight');const end=full.indexOf('\n  document.getElementById(',start);assert.ok(start>0&&end>start);
 const node={classList:{add(){},remove(){}}};let submit,resolveFetch;let name='Cliente';const sent=[];
 const ctx={form:{...node,elements:{consent_partner_sharing:{checked:true},consent_marketing:{checked:false}},dataset:{consentVersion:'v1'},addEventListener(_,fn){submit=fn;}},window:{location:{href:'https://test/'}},eventId:()=>crypto.randomUUID(),getValue:k=>k==='name'?name:'value',getValues:()=>['regular'],validate:()=>true,validateStep:()=>true,sending:node,sendingState:node,errorState:node,technicalError:node,success:node,successState:node,errorMap:{},fetch:async(_,init)=>{sent.push(JSON.parse(init.body));return new Promise(resolve=>{resolveFetch=resolve;});}};
 vm.runInNewContext(full.slice(start,end),ctx);const event={preventDefault(){}};
 const first=submit(event);await submit(event);assert.equal(sent.length,1);resolveFetch(new Response('{}',{status:502}));await first;
 const retry=submit(event);assert.equal(sent[0].eventId,sent[1].eventId);resolveFetch(new Response('{}'));await retry;
 name='Outro Cliente';const different=submit(event);assert.notEqual(sent[1].eventId,sent[2].eventId);resolveFetch(new Response('{}'));await different;
});
