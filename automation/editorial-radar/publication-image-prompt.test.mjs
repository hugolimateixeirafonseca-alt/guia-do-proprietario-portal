import test from 'node:test';
import assert from 'node:assert/strict';
import {finalizePublication,IMAGE_TECHNICAL_PROMPT} from './publication-image-prompt.mjs';

const event={
  title:'Condomínios: nova regra mantém 5% de IVA em obras',
  source_name:'Jornal Económico',
  pillar:'condominio',
  entities:['Associação Nacional de Condomínios'],
  summary:'A taxa entra em vigor depois da publicação oficial.',
  key_facts:['O valor verificado é de cinco mil euros.'],
  article_url:'https://exemplo.pt/noticia-condominios'
};
const generated={
  texto_fb:'Texto para Facebook com factos verificados.',
  texto_site:'Texto para o site com factos verificados.',
  orientacao_ilustracao_segura:'Edifício residencial português contemporâneo com documentação genérica.'
};

test('prompt visual exclui título, fonte e copy jornalística',()=>{
  const publication=finalizePublication({publishableNews:true,event,generated});
  assert.ok(publication.prompt_imagem);
  assert.equal(publication.prompt_imagem.includes(event.title),false);
  assert.equal(publication.prompt_imagem.includes(event.source_name),false);
  assert.equal(publication.prompt_imagem.includes(generated.texto_fb),false);
  assert.equal(publication.prompt_imagem.includes(generated.texto_site),false);
  assert.match(publication.prompt_imagem,/sem texto visível/iu);
  assert.match(publication.prompt_imagem,/desenhada ou pintada digitalmente/iu);
  assert.match(publication.prompt_imagem,/arquitetura e interiores claramente portugueses/iu);
  assert.match(publication.prompt_imagem,/sujeito principal no centro ou à direita/iu);
  assert.equal(publication.prompt_tecnico,IMAGE_TECHNICAL_PROMPT);
});

test('orientacao_ilustracao_segura é obrigatória',()=>{
  assert.throws(
    ()=>finalizePublication({publishableNews:true,event,generated:{...generated,orientacao_ilustracao_segura:''}}),
    /direction is required/iu
  );
});

test('orientação com números ou entidades usa fallback abstrato',()=>{
  const publication=finalizePublication({
    publishableNews:true,
    event,
    generated:{...generated,orientacao_ilustracao_segura:'Mostrar Associação Nacional de Condomínios e a taxa de 5%.'}
  });
  assert.equal(publication.prompt_imagem.includes('5%'),false);
  assert.equal(publication.prompt_imagem.includes(event.entities[0]),false);
  assert.match(publication.prompt_imagem,/varandas em ferro/iu);
});

test('orientação com URL, data, valor ou copy nunca chega ao prompt',()=>{
  for (const unsafeDirection of [
    event.article_url,
    'A medida entra em vigor em agosto.',
    'Documentos com valor de € cinco mil.',
    generated.texto_site
  ]) {
    const publication=finalizePublication({
      publishableNews:true,
      event,
      generated:{...generated,resumo_factual_curto:['Resumo factual reservado.'],orientacao_ilustracao_segura:unsafeDirection}
    });
    assert.equal(publication.prompt_imagem.includes(unsafeDirection),false);
    assert.equal(publication.prompt_imagem.includes(event.article_url),false);
    assert.equal(publication.prompt_imagem.includes(generated.texto_fb),false);
    assert.equal(publication.prompt_imagem.includes(generated.texto_site),false);
    assert.equal(publication.prompt_imagem.includes('Resumo factual reservado.'),false);
  }
});
