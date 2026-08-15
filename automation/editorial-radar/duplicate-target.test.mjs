import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveDuplicateTarget} from './duplicate-target.mjs';

const history=[
  {id:'evt_prr',event_key:'prr-casas-2026',title:'Governo prevê entregar 28 mil casas',news_score:8,published:0},
  {id:'evt_outro',event_key:'outro-evento',title:'Outro evento',news_score:70,published:0}
];

test('resolve duplicado pelo ID exato devolvido pelo editor',()=>{
  assert.equal(resolveDuplicateTarget(history,{duplicate_event_id:'evt_prr'})?.id,'evt_prr');
});

test('usa event_key exata como fallback seguro',()=>{
  assert.equal(resolveDuplicateTarget(history,{duplicate_event_id:'',event_key:'prr-casas-2026'})?.id,'evt_prr');
});

test('não adivinha alvo quando o editor não devolve identificador verificável',()=>{
  assert.equal(resolveDuplicateTarget(history,{duplicate_event_id:'evt_inexistente',event_key:'chave-inexistente'}),null);
});
