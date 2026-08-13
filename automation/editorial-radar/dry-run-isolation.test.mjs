import test from 'node:test';
import assert from 'node:assert/strict';
import {combinedHistoricalContext,createIsolationController} from './dry-run-isolation.mjs';

const candidate={title:'Euribor sobe a três meses',summary:'Prestação do crédito habitação aumenta',pillar:'casa',event_date:'2026-08-13',article_url:'https://fonte.pt/euribor'};
const classification={decision:'NOVO',event_key:'euribor-sobe-tres-meses',verified_title:candidate.title,pillar:'casa',legal_stage:'na'};

test('NOVO em dry-run não executa escrita persistente',async()=>{
  let writes=0;
  const controller=createIsolationController({dryRun:true,writeEvent:async()=>{writes++},writeImpact:async()=>{},sendMake:async()=>({sent:true})});
  const accepted=await controller.acceptEvent(candidate,classification);
  assert.equal(writes,0);
  assert.match(accepted.eventId,/^dry_evt_/);
  assert.equal(controller.telemetry.event_writes,0);
  assert.equal(controller.telemetry.event_source_writes,0);
});

test('segundo artigo pode ser reconhecido como duplicado pela memória efémera',async()=>{
  const controller=createIsolationController({dryRun:true,writeEvent:async()=>{},writeImpact:async()=>{},sendMake:async()=>({sent:true})});
  const accepted=await controller.acceptEvent(candidate,classification);
  const history=combinedHistoricalContext([], [accepted.record]);
  const second={...candidate,article_url:'https://outra-fonte.pt/euribor'};
  const simulatedDecision=history.some(item=>item.event_key===classification.event_key && second.title===item.title) ? 'DUPLICADO' : 'NOVO';
  assert.equal(simulatedDecision,'DUPLICADO');
});

test('Content Impact executa em dry-run sem escrever content_impacts',async()=>{
  let modelCalls=0,impactWrites=0;
  const controller=createIsolationController({dryRun:true,writeEvent:async()=>{},writeImpact:async()=>{impactWrites++},sendMake:async()=>({sent:true})});
  const impacts=await (async()=>{modelCalls++;return [{impact_type:'PARTIAL_UPDATE'}]})();
  for (const impact of impacts) await controller.saveImpact('dry_evt_1',impact);
  assert.equal(modelCalls,1);
  assert.equal(impactWrites,0);
  assert.equal(controller.telemetry.impact_writes,0);
});

test('sendMake não é chamado em dry-run',async()=>{
  let sends=0;
  const controller=createIsolationController({dryRun:true,writeEvent:async()=>{},writeImpact:async()=>{},sendMake:async()=>{sends++;return {sent:true}}});
  assert.deepEqual(await controller.send({}),{sent:false});
  assert.equal(sends,0);
  assert.equal(controller.telemetry.make_sends,0);
});

test('produção mantém as escritas e o envio existentes',async()=>{
  const calls={event:0,impact:0,send:0};
  const controller=createIsolationController({
    dryRun:false,
    writeEvent:async()=>{calls.event++;return {eventId:'evt_1',eventKey:'key'}},
    writeImpact:async()=>{calls.impact++;return true},
    sendMake:async()=>{calls.send++;return {sent:true}}
  });
  await controller.acceptEvent(candidate,classification);
  await controller.saveImpact('evt_1',{impact_type:'ADDENDUM'});
  await controller.send({});
  assert.deepEqual(calls,{event:1,impact:1,send:1});
  assert.deepEqual(controller.telemetry,{event_writes:1,event_source_writes:1,impact_writes:1,make_sends:1});
});
