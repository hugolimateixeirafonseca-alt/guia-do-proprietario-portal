import test from 'node:test';
import assert from 'node:assert/strict';
import {
  finalizePublication,
  IMAGE_TECHNICAL_PROMPT,
  PublicationQualityError,
  safeIllustrationDirection,
  validatePublicationContent
} from './publication-image-prompt.mjs';

const event={
  title:'Governo propõe alterar regras do arrendamento',
  source_name:'Fonte de teste',
  pillar:'arrendar',
  legal_stage:'proposta',
  entities:['Entidade Exemplo'],
  summary:'O Governo apresentou uma proposta de alteração a regras do arrendamento. A medida ainda não está em vigor.',
  key_facts:[
    'A alteração encontra-se em fase de proposta.',
    'As regras atuais mantêm-se enquanto não houver mudança de fase jurídica.'
  ],
  article_url:'https://exemplo.pt/noticia-arrendamento'
};

const contextualParagraphs=[
  'A informação verificada descreve uma proposta e não uma regra já aplicável. Para o leitor, esta distinção é essencial porque evita tratar uma intenção política como se já tivesse produzido efeitos jurídicos. O conteúdo deve, por isso, separar aquilo que foi anunciado do que continua efetivamente a vigorar e manter essa diferença ao longo de toda a explicação.',
  'A notícia é relevante para quem acompanha o mercado de arrendamento porque altera o enquadramento em discussão, mas não permite concluir que existam já novos direitos, novos prazos ou novas obrigações. Sempre que o evento não fornece um detalhe concreto, o texto deve assumir esse limite em vez de preencher a lacuna com conhecimento externo ou com uma previsão.',
  'Do ponto de vista editorial, o objetivo é permitir uma leitura rápida e útil. O resumo inicial apresenta o acontecimento, os pontos essenciais concentram os factos e as secções seguintes organizam a informação por impacto e estado do processo. Esta estrutura acrescenta clareza sem transformar a notícia numa repetição da fonte original.',
  'Enquanto a fase indicada for proposta, a formulação deve manter verbos e expressões compatíveis com esse estado. A eventual aprovação, publicação oficial ou entrada em vigor são marcos diferentes e só podem ser descritos quando fizerem parte do evento verificado. Essa cautela protege a utilidade prática da notícia para proprietários e senhorios.'
];

const validSite=`A proposta anunciada pretende alterar regras do arrendamento e merece atenção de quem é proprietário ou senhorio. O ponto principal é simples: existe uma mudança em discussão, mas o evento verificado não indica que a medida esteja já em vigor.

## O essencial

- O acontecimento está classificado como proposta.
- A informação verificada não permite apresentar a alteração como regra já aplicável.
- As consequências práticas devem ser descritas apenas na medida em que resultem dos factos disponíveis.
- Aprovação, publicação e entrada em vigor são fases distintas e não devem ser confundidas.

## O que está a mudar

${contextualParagraphs[0]}

${contextualParagraphs[1]}

## O que isto significa para os senhorios

${contextualParagraphs[2]}

## Em que ponto está

${contextualParagraphs[3]}

A redação deve continuar a acompanhar novos marcos do mesmo processo. Se surgir uma aprovação ou publicação oficial, esse desenvolvimento constitui informação nova e deve ser tratado de acordo com a fase jurídica então verificada, sem reescrever retroativamente o que era apenas uma proposta.

## Também pode interessar

[Arrendamento](/arrendar/)

[Casa e obras](/casa/)

[Calendário do proprietário](/calendario/)`;

const generated={
  texto_fb:'O Governo apresentou uma proposta relacionada com regras do arrendamento. A medida encontra-se ainda em discussão e não deve ser tratada como regra em vigor. Para senhorios, o ponto importante é distinguir o anúncio político de uma alteração efetivamente aplicável. Novos marcos, como aprovação ou publicação oficial, terão de ser confirmados separadamente. Acompanha este tipo de mudanças? Explicamos o essencial no link.',
  texto_site:validSite,
  orientacao_ilustracao_segura:'Entrada de prédio residencial português, porta de apartamento e chave em primeiro plano, com atmosfera editorial sóbria ligada ao arrendamento.'
};

test('A) notícia editorial completa é aceite',()=>{
  const quality=validatePublicationContent(generated,event);
  assert.equal(quality.ok,true,quality.reasons.join(', '));
  assert.ok(quality.word_count>=250);
  assert.ok(quality.word_count<=800);
  const publication=finalizePublication({publishableNews:true,event,generated});
  assert.ok(publication.prompt_imagem);
});

test('B) notícia curta é rejeitada',()=>{
  const short={...generated,texto_site:`## O essencial

- Facto um.
- Facto dois.
- Facto três.

Este é um texto deliberadamente curto que não oferece contexto editorial suficiente.

## Também pode interessar

[Arrendamento](/arrendar/)
[Casa e obras](/casa/)
[Impostos](/impostos/)`};
  assert.throws(
    ()=>finalizePublication({publishableNews:true,event,generated:short}),
    err=>err instanceof PublicationQualityError && err.reasons.some(reason=>reason.startsWith('texto_site_too_short'))
  );
});

test('C) sem O essencial é rejeitada',()=>{
  const bad={...generated,texto_site:validSite.replace('## O essencial','## Resumo')};
  assert.throws(
    ()=>finalizePublication({publishableNews:true,event,generated:bad}),
    err=>err instanceof PublicationQualityError && err.reasons.includes('missing_o_essencial')
  );
});

test('D) apenas dois links internos é rejeitada',()=>{
  const bad={...generated,texto_site:validSite.replace('\n\n[Calendário do proprietário](/calendario/)','')};
  assert.throws(
    ()=>finalizePublication({publishableNews:true,event,generated:bad}),
    err=>err instanceof PublicationQualityError && err.reasons.includes('internal_links:2')
  );
});

test('E) proposta corretamente descrita como proposta é aceite',()=>{
  const publication=finalizePublication({publishableNews:true,event,generated});
  assert.match(publication.texto_site,/proposta/iu);
  assert.match(publication.texto_site,/não.*em vigor/iu);
});

test('prompt visual exclui título, fonte e copy jornalística',()=>{
  const publication=finalizePublication({publishableNews:true,event,generated});
  assert.equal(publication.prompt_imagem.includes(event.title),false);
  assert.equal(publication.prompt_imagem.includes(event.source_name),false);
  assert.equal(publication.prompt_imagem.includes(generated.texto_fb),false);
  assert.equal(publication.prompt_imagem.includes(generated.texto_site),false);
  assert.match(publication.prompt_imagem,/concrete subject of the news/iu);
  assert.match(publication.prompt_imagem,/do not create the card/iu);
  assert.equal(publication.prompt_tecnico,IMAGE_TECHNICAL_PROMPT);
});

test('F) orientação com números ou entidade usa fallback seguro',()=>{
  const publication=finalizePublication({
    publishableNews:true,
    event,
    generated:{...generated,orientacao_ilustracao_segura:'Mostrar Entidade Exemplo e 25 por cento numa porta.'}
  });
  assert.equal(publication.prompt_imagem.includes('25'),false);
  assert.equal(publication.prompt_imagem.includes(event.entities[0]),false);
  assert.match(publication.prompt_imagem,/chave em primeiro plano/iu);
});

test('G) orientação segura e específica ao acontecimento é preservada',()=>{
  const direction='Entrada residencial portuguesa com porta de apartamento, chave em primeiro plano e corredor comum sóbrio associado ao arrendamento.';
  assert.equal(safeIllustrationDirection(direction,event),direction);
  const publication=finalizePublication({
    publishableNews:true,
    event,
    generated:{...generated,orientacao_ilustracao_segura:direction}
  });
  assert.match(publication.prompt_imagem,/chave em primeiro plano/iu);
  assert.match(publication.prompt_imagem,/corredor comum/iu);
});

test('orientacao_ilustracao_segura vazia falha a quality gate',()=>{
  assert.throws(
    ()=>finalizePublication({publishableNews:true,event,generated:{...generated,orientacao_ilustracao_segura:''}}),
    err=>err instanceof PublicationQualityError && err.reasons.includes('illustration_direction_empty')
  );
});

test('H1 e HTML não são permitidos',()=>{
  for (const texto_site of [
    `# Título proibido\n\n${validSite}`,
    `${validSite}\n\n<div>HTML proibido</div>`
  ]) {
    assert.throws(
      ()=>finalizePublication({publishableNews:true,event,generated:{...generated,texto_site}}),
      err=>err instanceof PublicationQualityError
    );
  }
});