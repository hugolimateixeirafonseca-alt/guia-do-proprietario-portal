import test from 'node:test';
import assert from 'node:assert/strict';
import {finalizePublication, IMAGE_TECHNICAL_PROMPT} from './publication-image-prompt.mjs';

test('notícia publicável produz prompt_imagem final com título e fonte exatos', () => {
  const title = 'Condomínios: nova regra mantém 5% de IVA em obras';
  const sourceName = 'Jornal Económico';
  const publication = finalizePublication({
    publishableNews:true,
    event:{title, source_name:sourceName},
    generated:{
      texto_fb:'Texto para Facebook.',
      texto_site:'Texto para o site.',
      resumo_factual_curto:[
        'A medida abrange obras em edifícios residenciais.',
        'A taxa indicada na notícia é de 5%.',
        'Os condomínios estão entre os destinatários referidos.',
        'A publicação explica as condições aplicáveis.'
      ],
      orientacao_ilustracao:'Representar um edifício residencial português e documentos de obra, sem logótipos.'
    }
  });

  assert.ok(publication.prompt_imagem);
  assert.ok(publication.prompt_imagem.includes(`Título principal:\n${title}\n`));
  assert.ok(publication.prompt_imagem.includes(`Fonte: ${sourceName}\n`));
  assert.equal(publication.prompt_tecnico, IMAGE_TECHNICAL_PROMPT);
});

test('acontecimento não publicável não produz campos de imagem', () => {
  assert.deepEqual(finalizePublication({publishableNews:false, event:{}, generated:null}), {
    texto_fb:'',
    texto_site:'',
    prompt_imagem:'',
    prompt_tecnico:''
  });
});
