import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {getDiscoveryModePlan} from './discovery-mode.mjs';
import {prefilterHarvestSources} from './source-harvest.mjs';

test('smoke usa Direct Harvest, prefilter 24 e apenas omissões',()=>{
  const plan=getDiscoveryModePlan('smoke');
  assert.equal(plan.directHarvest,true);
  assert.equal(plan.prefilterLimit,24);
  assert.equal(plan.benchmark,true);
  assert.deepEqual(plan.sweepNames,['omissoes_editor_chefe']);
});

test('morning usa Direct Harvest, prefilter 30, oficiais e omissões',()=>{
  const plan=getDiscoveryModePlan('morning');
  assert.equal(plan.directHarvest,true);
  assert.equal(plan.prefilterLimit,30);
  assert.equal(plan.benchmark,false);
  assert.deepEqual(plan.sweepNames,['fontes_oficiais','omissoes_editor_chefe']);
  const forbidden=['legislacao_fiscalidade','condominio_vizinhos','arrendamento','mercado_credito','casa_energia_obras','herancas_propriedade','fontes_media_a','fontes_media_b','fontes_media_c'];
  assert.ok(forbidden.every(name=>!plan.sweepNames.includes(name)));
});

test('limite do plano morning é aplicado pelo prefilter',()=>{
  const plan=getDiscoveryModePlan('morning');
  const sources=Array.from({length:35},(_,index)=>({
    url:`https://publisher.pt/casas/${index}`,
    verified_title:`Habitação e casas ${index}`,
    verified_published_at:new Date(Date.UTC(2026,7,13,12,index)).toISOString(),
    article_type:'NewsArticle',
    direct_source:`Fonte ${index%6}`
  }));
  const result=prefilterHarvestSources(sources,{limit:plan.prefilterLimit});
  assert.equal(result.selected.length,30);
});

test('workflow mantém um único cron diário e schedule morning',async()=>{
  const workflow=await fs.readFile(new URL('../../.github/workflows/editorial-radar.yml',import.meta.url),'utf8');
  assert.deepEqual([...workflow.matchAll(/- cron:\s*'([^']+)'/g)].map(match=>match[1]),['30 6 * * *']);
  assert.match(workflow,/github\.event_name \}\}" == "schedule"[\s\S]*RADAR_MODE=morning[\s\S]*RADAR_DRY_RUN=false[\s\S]*BACKFILL=false/);
});
