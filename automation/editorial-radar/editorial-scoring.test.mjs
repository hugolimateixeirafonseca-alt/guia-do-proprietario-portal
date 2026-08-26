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

test('Euribor diária sem impacto concreto deixa de dominar o Radar',()=>{
  const candidate={
    source_title:'Euribor desce a três e 12 meses, mas taxa mais usada volta a subir',
    article_url:'https://cnnportugal.iol.pt/economia/euribor/euribor-desce-a-tres-e-12-meses-mas-taxa-mais-usada-volta-a-subir/20260814/x',
    pillar:'casa'
  };
  const score=scoreEditorialEvent(candidate,{pillar:'casa',legal_stage:'na'}).news_score;
  assert.ok(score>=40&&score<=60,score);
});

test('impacto concreto na prestação do crédito habitação continua publicável',()=>{
  const candidate={
    source_title:'Prestação da casa desce 54 euros com nova Euribor no crédito habitação',
    article_url:'https://eco.sapo.pt/credito-habitacao/prestacao-da-casa'
  };
  assert.ok(scoreEditorialEvent(candidate).news_score>=70);
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

test('onda de calor com utilidade doméstica passa o limiar',()=>{
  const candidate={
    source_title:'Ondas de calor: quanto custa manter a casa fresca?',
    article_url:'https://www.idealista.pt/news/financas/lar/ondas-de-calor-casa-fresca'
  };
  const result=scoreEditorialEvent(candidate);
  assert.ok(result.news_score>=70,result.news_score);
  assert.equal(result.pillar,'casa');
});

test('plataforma para estudante encontrar casa passa o limiar',()=>{
  const candidate={
    source_title:'Vai estudar longe? Nova plataforma ajuda a encontrar casa',
    source_description:'Ferramenta portuguesa ajuda estudantes universitários a procurar alojamento e quartos.',
    article_url:'https://www.rtp.pt/noticias/pais/plataforma-estudantes-casa'
  };
  assert.ok(scoreEditorialEvent(candidate).news_score>=70);
});

test('arquitetura residencial portuguesa ganha relevância sem virar prioridade máxima',()=>{
  const candidate={
    source_title:'Casas icónicas: as três portuguesas no mapa mundial',
    article_url:'https://www.idealista.pt/news/imobiliario/habitacao/casas-iconicas-portuguesas'
  };
  const score=scoreEditorialEvent(candidate).news_score;
  assert.ok(score>=55&&score<70,score);
});

test('encontrado morto em casa é falso positivo semântico',()=>{
  const candidate={
    source_title:'Homem encontrado morto em casa durante a madrugada',
    article_url:'https://noticias.pt/pais/homem-encontrado-morto-em-casa'
  };
  const result=scoreEditorialEvent(candidate);
  assert.ok(result.news_score<=10,result.news_score);
  assert.equal(result.signals.false_positive,'crime_home_word');
});

test('obras de arte não são obras da casa',()=>{
  const candidate={
    source_title:'Quatro obras de arte de Messina roubadas de museu',
    article_url:'https://noticias.pt/cultura/obras-de-arte-messina'
  };
  assert.ok(scoreEditorialEvent(candidate).news_score<=10);
});

test('concursos de obras públicas não entram apenas pela palavra obras',()=>{
  const candidate={
    source_title:'Concursos de obras públicas atingem novo máximo este ano',
    article_url:'https://jornaleconomico.sapo.pt/noticias/concursos-obras-publicas'
  };
  assert.ok(scoreEditorialEvent(candidate).news_score<=20);
});

test('todos os scores são inteiros entre 0 e 100',()=>{
  const result=scoreEditorialEvent(prr,{pillar:'casa',legal_stage:'anuncio'});
  for (const value of [result.news_score,result.seo_score,result.lead_score]) {
    assert.equal(Number.isInteger(value),true);
    assert.ok(value>=0&&value<=100);
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
