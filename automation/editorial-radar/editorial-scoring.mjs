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
const PORTUGAL_SIGNAL=['portugal','português','portugues','portuguesa','portuguesas','prr','lisboa','porto','açores','acores','madeira'];
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

export function normalizeEditorialText(value='') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu,'')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu,' ')
    .replace(/\s+/gu,' ')
    .trim();
}

function containsAny(text,terms) {
  const haystack=` ${normalizeEditorialText(text)} `;
  return terms.some(term=>haystack.includes(` ${normalizeEditorialText(term)} `));
}
function clamp(value) {
  return Math.max(0,Math.min(100,Math.round(Number(value)||0)));
}
function stableText(candidate={}) {
  return candidate.source_title||candidate.title||candidate.article_url||'';
}

export function inferDeterministicPillar(candidate={}) {
  const text=normalizeEditorialText(stableText(candidate));
  if (/\b(?:imi|imt|irs|imposto|impostos|fisco|fiscal|mais valias)\b/u.test(text)) return 'impostos';
  if (/\b(?:condominio|condominios|condomino|condominos|fundo comum|administrador do condominio)\b/u.test(text)) return 'condominio';
  if (/\b(?:arrendamento|renda|rendas|senhorio|senhorios|inquilino|inquilinos|despejo|caucao)\b/u.test(text)) return 'arrendar';
  if (/\b(?:vender|venda de casa|venda da casa|avaliacao do imovel|mediacao imobiliaria|preco de venda)\b/u.test(text)) return 'vender';
  return 'casa';
}

export function inferDeterministicLegalStage(candidate={}) {
  const text=normalizeEditorialText([
    candidate.source_title||candidate.title||'',
    candidate.source_description||'',
    candidate.summary||''
  ].join(' '));
  if (/\b(?:entra em vigor|entrada em vigor|em vigor desde|passa a vigorar)\b/u.test(text)) return 'entrada_em_vigor';
  if (/\b(?:publicado no diario da republica|publicada no diario da republica|foi publicado|foi publicada)\b/u.test(text)) return 'publicacao';
  if (/\b(?:aprovado|aprovada|aprovou|aprovacao)\b/u.test(text)) return 'aprovacao';
  if (/\b(?:proposta|propoe|propor|quer alterar|pretende alterar)\b/u.test(text)) return 'proposta';
  if (/\b(?:anuncia|anunciou|preve|vai entregar|vai lancar)\b/u.test(text)) return 'anuncio';
  return 'na';
}

export function scoreEditorialEvent(candidate={}) {
  const text=stableText(candidate);
  const normalizedText=normalizeEditorialText(text);
  const normalizedTitle=normalizeEditorialText(candidate.source_title||candidate.title||'');
  const pillar=inferDeterministicPillar(candidate);

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
    scoring_version:'deterministic_v2',
    pillar,
    news_score:clamp(news),
    seo_score:clamp(seo),
    lead_score:clamp(lead),
    signals
  };
}

export function applyDeterministicEditorialScores(candidate={},classification={}) {
  const scoring=scoreEditorialEvent(candidate);
  return {
    ...classification,
    pillar:scoring.pillar,
    news_score:scoring.news_score,
    seo_score:scoring.seo_score,
    lead_score:scoring.lead_score,
    scoring_version:scoring.scoring_version,
    scoring_signals:scoring.signals
  };
}
