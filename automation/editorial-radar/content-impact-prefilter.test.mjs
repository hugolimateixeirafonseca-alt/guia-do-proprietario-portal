import test from 'node:test';
import assert from 'node:assert/strict';
import {prefilterContentImpact,scoreContentMatch} from './content-impact-prefilter.mjs';

const article=(overrides={})=>({
  path:'src/content/artigos/exemplo.mdx',
  slug:'exemplo',
  title:'Artigo de exemplo',
  pillar:'casa',
  summary:'',
  body_excerpt:'',
  ...overrides
});

test('evento de condomínios encontra artigos de condomínios',()=>{
  const event={title:'Nova lei dos condomínios',summary:'Mudam regras da administração',pillar:'condominio',entities:[],key_facts:[],legal_stage:'proposta'};
  const related=article({slug:'preparar-assembleia-condominio',title:'Como preparar a assembleia de condomínio',pillar:'condominio'});
  assert.ok(scoreContentMatch(event,related).score>=8);
  assert.equal(prefilterContentImpact(event,[related]).selected[0].path,related.path);
});

test('Euribor encontra conteúdo de crédito e prestações',()=>{
  const event={title:'Euribor sobe a três meses',summary:'A prestação do crédito à habitação pode mudar',pillar:'casa',entities:['Euribor'],key_facts:[],legal_stage:'na'};
  const related=article({slug:'credito-habitacao-prestacao',title:'Crédito habitação: calcular a prestação',summary:'Como a Euribor afeta o empréstimo da casa'});
  assert.ok(scoreContentMatch(event,related).score>=8);
  assert.equal(prefilterContentImpact(event,[related]).selected.length,1);
});

test('notícia alheia não seleciona artigos nem justificaria chamada de impacto',()=>{
  const event={title:'Seleção vence torneio internacional',summary:'Resultado desportivo',pillar:'casa',entities:[],key_facts:[],legal_stage:'na'};
  const unrelated=article({slug:'certificado-energetico',title:'Certificado energético',summary:'Eficiência da habitação'});
  const result=prefilterContentImpact(event,[unrelated]);
  assert.equal(result.matches,0);
  assert.deepEqual(result.selected,[]);
});

test('envia no máximo cinco artigos e limita os excertos',()=>{
  const event={title:'Alteração às regras dos condomínios',summary:'Nova obrigação legal para administradores',pillar:'condominio',entities:[],key_facts:[],legal_stage:'alteracao'};
  const articles=Array.from({length:9},(_,index)=>article({
    path:`src/content/artigos/condominio-${index}.mdx`,
    slug:`condominio-${index}`,
    title:`Condomínio e administradores ${index}`,
    pillar:'condominio',
    body_excerpt:`condomínio ${'conteúdo '.repeat(400)}`
  }));
  const result=prefilterContentImpact(event,articles);
  assert.equal(result.selected.length,5);
  assert.ok(result.selected.every(item=>item.body_excerpt.length<=1500));
});
