import test from 'node:test';
import assert from 'node:assert/strict';
import {extractSourceMetadata} from './source-metadata.mjs';
import {scoreEditorialEvent,applyDeterministicEditorialScores} from './editorial-scoring.mjs';
import {extractFactualCandidates} from './factual-extraction.mjs';
import {publicationEvidenceStatus} from './publication-evidence.mjs';
import {finalizePublication,PublicationQualityError,safeIllustrationDirection} from './publication-image-prompt.mjs';

test('metadata extrai data, descrição e corpo factual sem dateModified',()=>{
  const metadata=extractSourceMetadata(`
    <html><head>
      <meta property="og:description" content="Descrição factual da notícia sobre habitação.">
      <script type="application/ld+json">{"@type":"NewsArticle","headline":"Notícia de habitação","datePublished":"2026-08-15T10:00:00+01:00","dateModified":"2026-08-16T10:00:00+01:00"}</script>
    </head><body><article>
      <p>O Governo apresentou uma nova medida para o setor da habitação com aplicação prevista em Portugal.</p>
      <p>A notícia explica os objetivos, o calendário anunciado e os destinatários abrangidos pela medida.</p>
      <p>Os detalhes foram apresentados numa comunicação pública e incluem informação concreta para proprietários.</p>
    </article></body></html>
  `);
  assert.equal(metadata.published_at,'2026-08-15T09:00:00.000Z');
  assert.equal(metadata.date_source,'jsonld_datePublished');
  assert.match(metadata.description,/Descrição factual/);
  assert.match(metadata.article_excerpt,/Governo apresentou/);
});

test('PRR passa score 70 e pilar é determinístico',()=>{
  const candidate={
    source_title:'PRR: Governo diz que 28 mil casas serão entregues até final de agosto e 40 mil concluídas até dezembro',
    article_url:'https://jornaleconomico.sapo.pt/noticias/prr-habitacao'
  };
  const a=applyDeterministicEditorialScores(candidate,{pillar:'arrendar',news_score:8});
  const b=applyDeterministicEditorialScores(candidate,{pillar:'impostos',news_score:99});
  assert.equal(a.news_score,b.news_score);
  assert.equal(a.pillar,b.pillar);
  assert.ok(a.news_score>=70);
});

test('número e palavras extra apenas no URL não alteram score',()=>{
  const base={source_title:'Conheça as propostas para flexibilizar lei das rendas',article_url:'https://eco.sapo.pt/descodificador/propostas'};
  const numbered={...base,article_url:'https://eco.sapo.pt/descodificador/propostas/04-acao-de-despejo'};
  assert.equal(scoreEditorialEvent(base).news_score,scoreEditorialEvent(numbered).news_score);
});

test('Luna zero e Terra recupera factual',async()=>{
  const source={
    url:'https://jornaleconomico.sapo.pt/noticias/prr-habitacao',
    verified_title:'PRR: Governo diz que 28 mil casas serão entregues até final de agosto e 40 mil concluídas até dezembro',
    verified_published_at:'2026-08-15T10:00:00.000Z',
    source_description:'O Governo apresentou o ponto de situação da execução do PRR na habitação.',
    source_excerpt:'O Governo prevê entregar 28 mil casas até ao final de agosto. O objetivo indicado para dezembro é concluir 40 mil habitações. A informação foi apresentada no âmbito da execução do PRR. O calendário foi descrito como uma previsão de execução e não como uma alteração legal.',
    direct_source:'Jornal Económico'
  };
  const calls=[];
  const result=await extractFactualCandidates([source],{
    primaryModel:'luna',
    fallbackModel:'terra',
    callModel:async ({model})=>{
      calls.push(model);
      if(model==='luna') return '{"results":[]}';
      return JSON.stringify({results:[{
        article_url:source.url,
        summary:'O Governo apresentou metas de entrega e conclusão de habitações financiadas no âmbito do PRR, com calendários distintos para agosto e dezembro.',
        entities:['Governo','PRR'],
        key_facts:[
          'O Governo prevê entregar 28 mil casas até ao final de agosto.',
          'A meta indicada para dezembro é concluir 40 mil habitações.',
          'As habitações são apresentadas no contexto da execução do PRR.',
          'Os prazos comunicados são previsões de execução.'
        ],
        legal_stage:'anuncio',
        confidence:95,
        validation_status:'verified'
      }]});
    }
  });
  assert.deepEqual(calls,['luna','terra']);
  assert.equal(result[0].validation_status,'verified');
  assert.equal(result[0].key_facts.length,4);
});

test('falha de ambos modelos preserva candidato mas bloqueia publicação',async()=>{
  const source={
    url:'https://example.com/noticia',
    verified_title:'Habitação em Portugal',
    verified_published_at:'2026-08-15T10:00:00.000Z',
    source_description:'Descrição longa suficiente para permanecer no radar, sem validação factual do modelo.',
    source_excerpt:'Parágrafo factual disponível na fonte original, mas sem extração estruturada validada.'
  };
  const [candidate]=await extractFactualCandidates([source],{
    primaryModel:'luna',
    fallbackModel:'terra',
    callModel:async()=>'{invalid'
  });
  assert.equal(candidate.validation_status,'evidence_fallback');
  assert.equal(publicationEvidenceStatus(candidate).ready,false);
});

test('evidência forte permite publicação',()=>{
  const result=publicationEvidenceStatus({
    validation_status:'verified',
    validation_confidence:90,
    summary:'Resumo factual suficientemente desenvolvido para explicar o acontecimento e o seu contexto direto aos proprietários sem inventar consequências.',
    key_facts:['Facto factual número um suficientemente desenvolvido.','Facto factual número dois suficientemente desenvolvido.','Facto factual número três suficientemente desenvolvido.','Facto factual número quatro suficientemente desenvolvido.']
  });
  assert.equal(result.ready,true);
});

const event={
  title:'Governo propõe alterar regras do arrendamento',
  source_name:'Fonte de teste',
  pillar:'arrendar',
  legal_stage:'proposta',
  entities:['Entidade Exemplo'],
  summary:'O Governo apresentou uma proposta de alteração a regras do arrendamento. A medida ainda não está em vigor.',
  key_facts:['A alteração encontra-se em fase de proposta.','As regras atuais mantêm-se enquanto não houver mudança de fase jurídica.'],
  article_url:'https://exemplo.pt/noticia-arrendamento'
};

const paragraph='A informação verificada descreve uma proposta e não uma regra já aplicável. Para o leitor, esta distinção é essencial porque evita tratar uma intenção política como se já tivesse produzido efeitos jurídicos. O conteúdo deve separar aquilo que foi anunciado do que continua efetivamente a vigorar, sem acrescentar prazos, direitos ou obrigações que não estejam confirmados pela fonte original.';

const validSite=`A proposta anunciada pretende alterar regras do arrendamento e merece atenção de quem é proprietário ou senhorio. O ponto principal é simples: existe uma mudança em discussão, mas o evento verificado não indica que a medida esteja já em vigor.

## O essencial

- O acontecimento está classificado como proposta.
- A informação verificada não permite apresentar a alteração como regra já aplicável.
- As consequências práticas devem ser descritas apenas na medida em que resultem dos factos disponíveis.
- Aprovação, publicação e entrada em vigor são fases distintas e não devem ser confundidas.

## O que está a mudar

${paragraph}

${paragraph.replace('A informação','A fonte')}

## O que isto significa para os senhorios

${paragraph.replace('A informação','Para os senhorios, a informação')}

## Em que ponto está

${paragraph.replace('A informação','Nesta fase, a informação')}

## Também pode interessar

[Arrendamento](/arrendar/)
[Casa e obras](/casa/)
[Calendário do proprietário](/calendario/)`;

const generated={
  texto_fb:'O Governo apresentou uma proposta relacionada com regras do arrendamento. A medida encontra-se ainda em discussão e não deve ser tratada como regra em vigor. Para senhorios, o ponto importante é distinguir o anúncio político de uma alteração efetivamente aplicável. Novos marcos, como aprovação ou publicação oficial, terão de ser confirmados separadamente. Acompanha este tipo de mudanças? Explicamos o essencial no link.',
  texto_site:validSite,
  orientacao_ilustracao_segura:'Entrada residencial portuguesa com porta de apartamento, chave em primeiro plano e corredor comum sóbrio associado ao arrendamento.'
};

test('publicação completa passa e direção específica é preservada',()=>{
  const direction=generated.orientacao_ilustracao_segura;
  assert.equal(safeIllustrationDirection(direction,event),direction);
  const publication=finalizePublication({publishableNews:true,event,generated});
  assert.match(publication.prompt_imagem,/corredor comum/iu);
});

test('direção genérica em PRR é substituída por imagem específica',()=>{
  const prrEvent={
    title:'Governo prevê entregar casas do PRR',
    summary:'Execução do PRR na habitação.',
    pillar:'casa',
    key_facts:['Entrega de novas habitações no âmbito do PRR.']
  };
  const direction=safeIllustrationDirection('Uma casa bonita.',prrEvent);
  assert.match(direction,/fase final de construção/iu);
});

test('site pobre com menos de 300 palavras é rejeitado',()=>{
  const short={...generated,texto_site:`## O essencial

- Facto um suficientemente explicado.
- Facto dois suficientemente explicado.
- Facto três suficientemente explicado.
- Facto quatro suficientemente explicado.

## O que está a mudar

Texto curto.

## Em que ponto está

Texto curto.

## Também pode interessar

[Arrendamento](/arrendar/)
[Casa e obras](/casa/)
[Impostos](/impostos/)`};
  assert.throws(()=>finalizePublication({publishableNews:true,event,generated:short}),PublicationQualityError);
});
