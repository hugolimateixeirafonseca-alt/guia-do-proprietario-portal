from pathlib import Path


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 occurrence, found {count}')
    return text.replace(old, new, 1)

p=Path('automation/editorial-radar/publication-image-prompt.mjs')
text=p.read_text()

old_safe="""const SAFE_DIRECTIONS={
  vender:'Entrada de uma habitação portuguesa com chave em primeiro plano e contexto visual sóbrio de decisão de venda, sem sinalética nem texto.',
  impostos:'Habitação portuguesa com pasta documental fechada e elementos administrativos discretos, sem texto, números ou documentos legíveis.',
  arrendar:'Entrada de prédio residencial português, porta de apartamento e chave em primeiro plano, numa atmosfera editorial sóbria associada a arrendamento.',
  condominio:'Entrada comum de prédio residencial português, intercomunicador sem texto, caixas de correio neutras e varandas ao fundo.',
  casa:'Habitação portuguesa contemporânea com contexto residencial realista e elementos concretos ligados ao tema da notícia.'
};
"""
new_safe="""const SAFE_DIRECTIONS={
  vender:'Fotografia editorial realista da entrada de uma habitação portuguesa, com chave de casa em primeiro plano e contexto visual sóbrio de decisão de venda, sem sinalética nem texto.',
  impostos:'Fotografia editorial realista de uma habitação portuguesa com pasta documental fechada e elementos administrativos discretos, sem texto, números ou documentos legíveis.',
  arrendar:'Fotografia editorial realista da entrada de um prédio residencial português, com porta de apartamento, chave de casa em primeiro plano e corredor comum discreto associado ao arrendamento.',
  condominio:'Fotografia editorial realista da entrada comum de um prédio residencial português, com intercomunicador sem texto, caixas de correio neutras e varandas ao fundo.',
  casa:'Fotografia editorial realista de uma habitação portuguesa contemporânea, com contexto residencial plausível e elementos concretos ligados ao tema da notícia.'
};
"""
text=replace_once(text,old_safe,new_safe,'safe directions')

replacements={
"return 'Conjunto residencial português contemporâneo em fase final de construção, com vários edifícios de habitação novos, acabamentos recentes e uma chave de casa em primeiro plano, ambiente realista de entrega de novas habitações.';":"return 'Fotografia editorial realista de um conjunto de habitação pública portuguesa em fase final de construção: vários edifícios residenciais novos, uma grua junto a um bloco ainda em obra e um molho de chaves de casa em primeiro plano, transmitindo conclusão e entrega de novas habitações sem recurso a texto.';",
"return 'Entrada de apartamento português com chave em primeiro plano e uma pequena maquete residencial sobre uma mesa, com ambiente financeiro sóbrio sugerido apenas por formas e materiais, sem texto nem números.';":"return 'Fotografia editorial realista numa casa portuguesa: chave de casa e pequena maquete residencial em primeiro plano, acompanhadas por uma calculadora física com visor sem algarismos legíveis; ambiente financeiro sóbrio ligado ao crédito à habitação, sem gráficos artificiais, texto ou números.';",
"return 'Entrada de prédio residencial português, porta de apartamento, chave em primeiro plano e corredor comum discreto, numa composição editorial ligada de forma clara ao arrendamento.';":"return 'Fotografia editorial realista da entrada de um prédio residencial português, com porta de apartamento, chave de casa em primeiro plano e corredor comum discreto, numa composição claramente associada ao arrendamento.';",
"return 'Habitação portuguesa em contexto realista de melhoria ou reabilitação, com detalhe de obra limpa e materiais de construção discretos, sem trabalhadores em poses publicitárias nem sinalética.';":"return 'Fotografia editorial realista de uma habitação portuguesa em melhoria ou reabilitação, com detalhe de obra limpa e materiais de construção discretos, sem trabalhadores em poses publicitárias nem sinalética.';",
"return 'Rua residencial portuguesa com edifícios de habitação reais, chave de casa em primeiro plano e profundidade urbana natural, sugerindo mercado imobiliário sem placas, texto ou publicidade.';":"return 'Fotografia editorial realista de uma rua residencial portuguesa com edifícios de habitação reais, chave de casa em primeiro plano e profundidade urbana natural, sugerindo mercado imobiliário sem placas, texto ou publicidade.';"
}
for old,new in replacements.items():
    text=replace_once(text,old,new,old[:45])

old_func="""export function safeIllustrationDirection(value,event={}) {
  const direction=normalizeLine(value);
  if (!direction) throw new Error('Safe illustration direction is required');

  const deterministic=topicDirection(event);
  const fallback=deterministic || SAFE_DIRECTIONS[event.pillar] || SAFE_DIRECTIONS.casa;
  const normalized=comparable(direction);
"""
new_func="""export function safeIllustrationDirection(value,event={}) {
  const rawDirection=normalizeLine(value);
  if (!rawDirection) throw new Error('Safe illustration direction is required');

  const deterministic=topicDirection(event);
  if (deterministic) return deterministic;

  const direction=rawDirection
    .replace(/\\bilustração\\b/giu,'fotografia editorial realista')
    .replace(/\\bilustracao\\b/giu,'fotografia editorial realista');
  const fallback=SAFE_DIRECTIONS[event.pillar] || SAFE_DIRECTIONS.casa;
  const normalized=comparable(direction);
"""
text=replace_once(text,old_func,new_func,'safeIllustrationDirection')

text=replace_once(
    text,
    "- cartoon, flat vector illustration or childish styling\n",
    "- illustration, painted artwork, cartoon, flat vector illustration or childish styling\n",
    'avoid illustration'
)
p.write_text(text)

pt=Path('automation/editorial-radar/publication-image-prompt.test.mjs')
t=pt.read_text()
old_test="""test('G) orientação segura e específica ao acontecimento é preservada',()=>{
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
"""
new_test="""test('G) tema conhecido usa direção fotográfica determinística em vez do estilo sugerido pelo modelo',()=>{
  const direction='Ilustração elegante de uma casa bonita com formas abstratas.';
  const resolved=safeIllustrationDirection(direction,event);
  assert.match(resolved,/Fotografia editorial realista/iu);
  assert.match(resolved,/arrendamento/iu);
  assert.doesNotMatch(resolved,/Ilustração/iu);
});

test('Euribor usa fotografia específica de crédito à habitação',()=>{
  const euribor={
    title:'Euribor desce a três e 12 meses, mas taxa mais usada volta a subir',
    summary:'A Euribor a seis meses é a mais usada no crédito à habitação com taxa variável.',
    pillar:'casa',
    key_facts:['A taxa a seis meses subiu na sessão.']
  };
  const resolved=safeIllustrationDirection('Ilustração com uma casa, uma calculadora e um gráfico.',euribor);
  assert.match(resolved,/Fotografia editorial realista/iu);
  assert.match(resolved,/calculadora/iu);
  assert.match(resolved,/chave de casa/iu);
  assert.doesNotMatch(resolved,/gráficos artificiais.*texto/iu);
  assert.doesNotMatch(resolved,/Ilustração/iu);
});

test('PRR usa fotografia específica de construção e entrega de habitação pública',()=>{
  const prr={
    title:'Habitação pública alavancada com 28 mil casas pagas pelo PRR',
    summary:'Novas habitações públicas estão em construção e entrega.',
    pillar:'casa',
    key_facts:['O Governo prevê novas entregas de habitação pública.']
  };
  const resolved=safeIllustrationDirection('Conjunto de edifícios e chaves.',prr);
  assert.match(resolved,/Fotografia editorial realista/iu);
  assert.match(resolved,/habitação pública/iu);
  assert.match(resolved,/grua/iu);
  assert.match(resolved,/chaves/iu);
});
"""
t=replace_once(t,old_test,new_test,'visual tests')
pt.write_text(t)
