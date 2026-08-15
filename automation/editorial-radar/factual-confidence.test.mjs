import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeConfidence,normalizeFactualCandidate} from './factual-extraction.mjs';

test('normaliza confiança 0-1 para percentagem',()=>{
  assert.equal(normalizeConfidence(0.92),92);
  assert.equal(normalizeConfidence('0.87'),87);
});

test('preserva confiança 0-100 e percentagens textuais',()=>{
  assert.equal(normalizeConfidence(92),92);
  assert.equal(normalizeConfidence('95%'),95);
  assert.equal(normalizeConfidence(150),100);
});

test('candidato com confiança 0.92 pode ser verificado',()=>{
  const source={
    url:'https://example.com/noticia',
    verified_title:'Governo anuncia 28 mil casas no PRR',
    verified_published_at:'2026-08-15T10:00:00.000Z'
  };
  const candidate=normalizeFactualCandidate(source,{
    article_url:source.url,
    summary:'O Governo anunciou novas metas de execução para habitação no âmbito do PRR, com entregas previstas em diferentes momentos do calendário.',
    entities:['Governo','PRR'],
    key_facts:[
      'O Governo anunciou uma nova meta de execução habitacional.',
      'A medida foi apresentada no contexto do PRR.',
      'O calendário anunciado inclui diferentes momentos de entrega.',
      'A informação foi apresentada como previsão de execução.'
    ],
    legal_stage:'anuncio',
    confidence:0.92,
    validation_status:'verified'
  });
  assert.equal(candidate.validation_status,'verified');
  assert.equal(candidate.validation_confidence,92);
});
