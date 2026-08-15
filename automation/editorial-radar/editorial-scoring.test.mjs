import test from 'node:test';
import assert from 'node:assert/strict';
import {applyDeterministicEditorialScores,scoreEditorialEvent} from './editorial-scoring.mjs';

const prr={
  source_title:'PRR: Governo diz que 28 mil casas serão entregues até final de agosto e 40 mil concluídas até dezembro',
  title:'Título eventualmente reescrito pelo modelo',
  article_url:'https://jornaleconomico.sapo.pt/noticias/prr-governo-preve-28-mil-casas-entregues-ate-final-de-agosto-e-40-mil-concluidas-ate-dezembro',
  pillar:'casa',
  is_official:false
};

test('PRR habitacional fica no limiar publicável de forma determinística',()=>{
  const result=scoreEditorialEvent(prr,{pillar:'casa',legal_stage:'anuncio'});
  assert.ok(result.news_score>=70,result.news_score);
});

test('PRR continua >=70 mesmo se a fase jurídica oscilar para na',()=>{
  const result=scoreEditorialEvent(prr,{pillar:'casa',legal_stage:'na'});
  assert.ok(result.news_score>=70,result.news_score);
});

test('scores fornecidos pelo modelo são sempre ignorados',()=>{
  const low=applyDeterministicEditorialScores(prr,{pillar:'casa',legal_stage:'anuncio',news_score:8,seo_score:7,lead_score:7});
  const high=applyDeterministicEditorialScores(prr,{pillar:'casa',legal_stage:'anuncio',news_score:78,seo_score:92,lead_score:91});
  assert.equal(low.news_score,high.news_score);
  assert.equal(low.seo_score,high.seo_score);
  assert.equal(low.lead_score,high.lead_score);
});

test('source_title estável prevalece sobre título variável do modelo',()=>{
  const a=scoreEditorialEvent({...prr,title:'Versão A'},{pillar:'casa',legal_stage:'anuncio'});
  const b=scoreEditorialEvent({...prr,title:'Versão totalmente diferente'},{pillar:'casa',legal_stage:'anuncio'});
  assert.deepEqual(
    {news:a.news_score,seo:a.seo_score,lead:a.lead_score},
    {news:b.news_score,seo:b.seo_score,lead:b.lead_score}
  );
});

test('Euribor ligada a crédito habitação atinge relevância de notícia',()=>{
  const candidate={
    source_title:'Euribor desce a três e 12 meses, mas taxa mais usada volta a subir',
    article_url:'https://cnnportugal.iol.pt/credito-a-habitacao/prestacao-da-casa/euribor-desce-a-tres-e-12-meses-mas-taxa-mais-usada-volta-a-subir/20260814/x',
    pillar:'casa'
  };
  assert.ok(scoreEditorialEvent(candidate,{pillar:'casa',legal_stage:'na'}).news_score>=70);
});

test('proposta sobre arrendamento e despejo é claramente publicável',()=>{
  const candidate={
    source_title:'Governo propõe flexibilizar regras para o senhorio avançar com ação de despejo',
    article_url:'https://eco.sapo.pt/descodificador/governo-quer-mercado-de-arrendamento-mais-flexivel/acao-de-despejo',
    pillar:'arrendar'
  };
  assert.ok(scoreEditorialEvent(candidate,{pillar:'arrendar',legal_stage:'proposta'}).news_score>=70);
});

test('lista de casas de luxo não passa o limiar editorial',()=>{
  const candidate={
    source_title:'Conheça as dez casas de luxo mais espreitadas este verão',
    article_url:'https://eco.sapo.pt/2026/08/14/do-algarve-a-madeira-as-dez-casas-de-luxo-mais-espreitadas-este-verao',
    pillar:'casa'
  };
  assert.ok(scoreEditorialEvent(candidate,{pillar:'casa',legal_stage:'na'}).news_score<70);
});

test('mobiliário e design não passam apenas por conter contexto residencial',()=>{
  const candidate={
    source_title:'Marca portuguesa apresenta mobiliário de design para durar',
    article_url:'https://www.idealista.pt/news/imobiliario/habitacao/design-mobiliario',
    pillar:'casa'
  };
  assert.ok(scoreEditorialEvent(candidate,{pillar:'casa',legal_stage:'na'}).news_score<70);
});

test('artigo de opinião sobre energia solar não passa o limiar',()=>{
  const candidate={
    source_title:'O que um eclipse nos ensina sobre o futuro da energia solar em Portugal',
    article_url:'https://eco.sapo.pt/opiniao/o-que-um-eclipse-nos-ensina-sobre-o-futuro-da-energia-solar-em-portugal',
    pillar:'casa'
  };
  assert.ok(scoreEditorialEvent(candidate,{pillar:'casa',legal_stage:'na'}).news_score<70);
});

test('todos os scores são inteiros entre 0 e 100',()=>{
  const result=scoreEditorialEvent(prr,{pillar:'casa',legal_stage:'anuncio'});
  for (const value of [result.news_score,result.seo_score,result.lead_score]) {
    assert.equal(Number.isInteger(value),true);
    assert.ok(value>=0 && value<=100);
  }
});
test('numero apenas no URL nao acrescenta pontos',()=>{
  const base={
    source_title:'Conheça as propostas para flexibilizar lei das rendas',
    article_url:'https://eco.sapo.pt/descodificador/governo-quer-mercado-de-arrendamento-mais-flexivel-conheca-as-propostas',
    pillar:'arrendar'
  };
  const numbered={
    ...base,
    article_url:`${base.article_url}/04-ao-fim-de-quanto-tempo-o-senhorio-pode-avancar`
  };
  const a=scoreEditorialEvent(base,{pillar:'arrendar',legal_stage:'proposta'});
  const b=scoreEditorialEvent(numbered,{pillar:'arrendar',legal_stage:'proposta'});
  assert.equal(a.news_score,b.news_score);
  assert.equal(a.seo_score,b.seo_score);
  assert.equal(a.signals.numeric,false);
  assert.equal(b.signals.numeric,false);
});

test('numero factual no titulo continua a contar',()=>{
  const candidate={
    source_title:'Governo prevê entregar 28 mil casas do PRR até ao final de agosto',
    article_url:'https://jornaleconomico.sapo.pt/noticias/prr-habitacao',
    pillar:'casa'
  };
  const result=scoreEditorialEvent(candidate,{pillar:'casa',legal_stage:'anuncio'});
  assert.equal(result.signals.numeric,true);
});