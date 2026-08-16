import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateViralPriority} from './viral-priority.mjs';

const now=new Date('2026-08-16T16:00:00Z');
const event={news_score:82};
const source=(name,url,published_at)=>({source_name:name,article_url:url,published_at});

test('3 fontes independentes em 6h com score >=70 ficam virais',()=>{
  const result=evaluateViralPriority(event,[
    source('A','https://a.pt/x','2026-08-16T12:00:00Z'),
    source('B','https://b.pt/x','2026-08-16T13:30:00Z'),
    source('C','https://c.pt/x','2026-08-16T15:00:00Z')
  ],now);
  assert.equal(result.status,'viral');
  assert.equal(result.source_count,3);
  assert.equal(result.span_minutes,180);
  assert.ok(result.viral_score>=85);
});

test('2 fontes rápidas precisam de score >=85 para viral imediato',()=>{
  const result=evaluateViralPriority({news_score:88},[
    source('A','https://a.pt/x','2026-08-16T14:00:00Z'),
    source('B','https://b.pt/x','2026-08-16T14:55:00Z')
  ],now);
  assert.equal(result.status,'viral');
});

test('2 fontes com score 75 ficam apenas provável',()=>{
  const result=evaluateViralPriority({news_score:75},[
    source('A','https://a.pt/x','2026-08-16T12:00:00Z'),
    source('B','https://b.pt/x','2026-08-16T14:00:00Z')
  ],now);
  assert.equal(result.status,'probable');
});

test('fontes do mesmo domínio contam uma vez',()=>{
  const result=evaluateViralPriority({news_score:95},[
    source('A1','https://a.pt/x','2026-08-16T14:00:00Z'),
    source('A2','https://www.a.pt/y','2026-08-16T14:20:00Z')
  ],now);
  assert.equal(result.status,'none');
  assert.equal(result.source_count,1);
});

test('datas antigas sem hora não criam falso viral',()=>{
  const result=evaluateViralPriority({news_score:95},[
    source('A','https://a.pt/x','2026-08-16'),
    source('B','https://b.pt/x','2026-08-16')
  ],now);
  assert.equal(result.status,'none');
  assert.equal(result.source_count,0);
});
