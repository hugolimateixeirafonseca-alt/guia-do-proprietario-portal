const STRONG_HOMEOWNER=[
  'habitação','habitacao','imóvel','imovel','imobiliário','imobiliario','propriedade','proprietário','proprietario',
  'arrendamento','senhorio','inquilino','renda','despejo','condomínio','condominio','imi','imt','mais valias','mais-valias','herança','heranca'
];

const MORTGAGE=[
  'crédito habitação','credito habitacao','crédito à habitação','credito a habitacao','euribor',
  'prestação da casa','prestacao da casa','prestação do crédito','prestacao do credito','hipoteca'
];

const POLICY=[
  'governo','lei','decreto','portaria','regra','regulamento','proposta','aprovação','aprovacao',
  'aprovado','aprovada','medida','pacote','parlamento','diário da república','diario da republica','prr'
];

const HOUSING_SUPPLY=[
  'prr','casas entregues','casas serão entregues','casas serao entregues','casas concluídas','casas concluidas',
  'habitação pública','habitacao publica','oferta de habitação','oferta de habitacao',
  'construção de habitação','construcao de habitacao','construir casas','fogos habitacionais'
];

const PRACTICAL=[
  'prazo','limite','taxa','isenção','isencao','obrigação','obrigacao','direito','caução','caucao',
  'comunicação','comunicacao','licença','licenca','licenciamento','seguro','eficiência energética',
  'eficiencia energetica','obras','apoio'
];

const HOUSING_MARKET=[
  'preços das casas','precos das casas','preço das casas','preco das casas','preço da habitação','preco da habitacao',
  'valor dos imóveis','valor dos imoveis','valor das casas','transações de casas','transacoes de casas',
  'vendas de casas','mercado imobiliário','mercado imobiliario'
];

const PORTUGAL_SIGNAL=[
  'portugal','português','portugues','portuguesa','portuguesas','prr','lisboa','porto','açores','acores','madeira'
];

const LIFESTYLE_NEGATIVE=[
  'luxo','casas de sonho','casa de sonho','design','mobiliário','mobiliario','decoração','decoracao',
  'espreitadas','arquitetura de luxo','celebridade','celebridades','mansão','mansao'
];

const SELLING_INTENT=[
  'vender casa','venda de casa','venda da casa','avaliar casa','avaliação do imóvel','avaliacao do imovel',
  'preço de venda','preco de venda','mediação imobiliária','mediacao imobiliaria','agência imobiliária','agencia imobiliaria'
];

const SERVICE_INTENT=[
  'obras','reparação','reparacao','limpeza','certificado energético','certificado energetico',
  'seguro casa','painéis solares','paineis solares','isolamento','condomínio','condominio'
];

function normalize(value='') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu,'')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu,' ')
    .replace(/\s+/gu,' ')
    .trim();
}

function containsAny(text,terms) {
  const haystack=` ${normalize(text)} `;
  return terms.some(term=>haystack.includes(` ${normalize(term)} `));
}

function clamp(value) {
  return Math.max(0,Math.min(100,Math.round(Number(value)||0)));
}

function pillarOf(candidate,classification) {
  const value=String(classification?.pillar||candidate?.pillar||'casa').toLowerCase();
  return ['vender','impostos','arrendar','condominio','casa'].includes(value) ? value : 'casa';
}

function stableScoringText(candidate={}) {
  // source_title vem do metadata da página e é preferido ao título reescrito pelo modelo.
  return [
    candidate.source_title||candidate.title||'',
    candidate.article_url||''
  ].join(' ');
}

export function scoreEditorialEvent(candidate={},classification={}) {
  const text=stableScoringText(candidate);
  const normalizedText=normalize(text);
  const normalizedTitle=normalize(candidate.source_title||candidate.title||'');
  const pillar=pillarOf(candidate,classification);
  const legalStage=String(classification?.legal_stage||candidate?.legal_stage||'na').toLowerCase();

  const signals={
    pillar,
    strong_homeowner:containsAny(text,STRONG_HOMEOWNER),
    mortgage:containsAny(text,MORTGAGE),
    policy:containsAny(text,POLICY),
    housing_supply:containsAny(text,HOUSING_SUPPLY),
    practical:containsAny(text,PRACTICAL),
    housing_market:containsAny(text,HOUSING_MARKET),
    portugal:containsAny(text,PORTUGAL_SIGNAL),
    numeric:/\d/u.test(normalizedTitle),
    legal_stage:legalStage!=='na',
    official:Boolean(candidate.is_official),
    lifestyle_negative:containsAny(text,LIFESTYLE_NEGATIVE),
    opinion:/\bopiniao\b/u.test(normalizedText),
    selling_intent:containsAny(text,SELLING_INTENT),
    service_intent:containsAny(text,SERVICE_INTENT)
  };

  const pillarNews={vender:18,impostos:20,arrendar:20,condominio:20,casa:15}[pillar];
  let news=15+pillarNews;
  if (signals.strong_homeowner) news+=20;
  if (signals.mortgage) news+=25;
  if (signals.policy) news+=15;
  if (signals.housing_supply) news+=15;
  if (signals.practical) news+=10;
  if (signals.housing_market) news+=20;
  if (signals.portugal) news+=5;
  if (signals.numeric) news+=5;
  if (signals.legal_stage) news+=5;
  if (signals.official) news+=5;
  if (signals.opinion) news-=20;
  if (signals.lifestyle_negative) news-=35;

  const pillarSeo={vender:42,impostos:40,arrendar:42,condominio:40,casa:32}[pillar];
  let seo=pillarSeo;
  if (signals.strong_homeowner) seo+=18;
  if (signals.mortgage) seo+=20;
  if (signals.policy) seo+=10;
  if (signals.practical) seo+=15;
  if (signals.housing_market) seo+=15;
  if (signals.housing_supply) seo+=8;
  if (signals.numeric) seo+=5;
  if (signals.legal_stage) seo+=5;
  if (signals.opinion) seo-=15;
  if (signals.lifestyle_negative) seo-=35;

  const pillarLead={vender:55,impostos:15,arrendar:30,condominio:22,casa:20}[pillar];
  let lead=pillarLead;
  if (signals.selling_intent) lead+=30;
  if (signals.service_intent) lead+=18;
  if (signals.mortgage) lead+=12;
  if (signals.housing_market) lead+=10;
  if (signals.practical) lead+=8;
  if (signals.policy) lead-=8;
  if (signals.opinion) lead-=10;
  if (signals.lifestyle_negative) lead-=15;

  return {
    scoring_version:'deterministic_v1',
    news_score:clamp(news),
    seo_score:clamp(seo),
    lead_score:clamp(lead),
    signals
  };
}

export function applyDeterministicEditorialScores(candidate={},classification={}) {
  const scoring=scoreEditorialEvent(candidate,classification);
  return {
    ...classification,
    news_score:scoring.news_score,
    seo_score:scoring.seo_score,
    lead_score:scoring.lead_score,
    scoring_version:scoring.scoring_version,
    scoring_signals:scoring.signals
  };
}