const STRONG_HOMEOWNER=[
  'habitação','habitacao','imóvel','imovel','imóveis','imoveis','imobiliário','imobiliario','propriedade','proprietário','proprietario','proprietários','proprietarios',
  'moradia','moradias','arrendamento','senhorio','senhorios','inquilino','inquilinos','renda','rendas','despejo','despejos','condomínio','condominio','condomínios','condominios','imi','imt','mais valias','mais-valias',
  'herança','heranca','heranças','herancas','comprar casa','compra de casa','vender casa','venda de casa','caução','caucao'
];
const MORTGAGE=[
  'crédito habitação','credito habitacao','crédito à habitação','credito a habitacao','euribor',
  'prestação da casa','prestacao da casa','prestação do crédito','prestacao do credito','hipoteca'
];
const POLICY=[
  'governo','lei','decreto','portaria','regra','regras','regulamento','regulamentos','proposta','aprovação','aprovacao',
  'aprovado','aprovada','medida','medidas','pacote','parlamento','diário da república','diario da republica','prr'
];
const HOUSING_SUPPLY=[
  'prr','casas entregues','casas serão entregues','casas serao entregues','casas concluídas','casas concluidas',
  'habitação pública','habitacao publica','oferta de habitação','oferta de habitacao',
  'construção de habitação','construcao de habitacao','construir casas','fogos habitacionais',
  'novas casas','novas habitações','novas habitacoes','residência estudantil','residencia estudantil','residência universitária','residencia universitaria'
];
const OWNER_RULES=[
  'prazo','prazos','limite','limites','isenção','isencao','isenções','isencoes','obrigação','obrigacao','obrigações','obrigacoes','direito','direitos','caução','caucao',
  'comunicação','comunicacao','licença','licenca','licenças','licencas','licenciamento','seguro','seguros','apoio','apoios','subsídio','subsidio','subsídios','subsidios'
];
const HOME_PRACTICAL=[
  'onda de calor','ondas de calor','casa fresca','casa fria','casa quente','calor em casa','frio em casa',
  'aquecimento','ar condicionado','ventilação','ventilacao','humidade','mofo','bolor','infiltração','infiltracao',
  'canalização','canalizacao','canos','avaria','avarias','reparação','reparacao','reparações','reparacoes','manutenção','manutencao',
  'limpeza','pragas','isolamento','janelas','janela','telhado','pintura','remodelação','remodelacao','renovação','renovacao',
  'cozinha','casa de banho','eletrodoméstico','eletrodomestico','eletrodomésticos','eletrodomesticos',
  'eficiência energética','eficiencia energetica','certificado energético','certificado energetico',
  'painéis solares','paineis solares','fotovoltaico','consumo de energia','conta da luz','fatura da luz','factura da luz',
  'conta de água','conta de agua','fatura da água','fatura da agua','gás em casa','gas em casa',
  'seguro multirriscos','segurança doméstica','seguranca domestica','alarme','incêndio doméstico','incendio domestico',
  'obras em casa','obras na casa','obras no apartamento','obras no prédio','obras no predio','reabilitação da casa','reabilitacao da casa'
];
const HOME_LIVING=[
  'decoração','decoracao','mobiliário','mobiliario','arrumação','arrumacao','organização da casa','organizacao da casa',
  'cozinha pequena','casa pequena','apartamento pequeno','varanda','jardim','terraço','terraco','arquitetura residencial',
  'casa icónica','casa iconica','casas icónicas','casas iconicas','casa premiada','casas premiadas','habitação premiada','habitacao premiada'
];
const STUDENT_HOUSING=[
  'arrendar quarto','alugar quarto','quarto para estudante','quarto para estudantes','quartos para estudantes',
  'casa para estudante','casa para estudantes','alojamento estudantil','alojamento para estudantes',
  'residência de estudantes','residencia de estudantes','residência universitária','residencia universitaria',
  'residência estudantil','residencia estudantil','encontrar casa','encontrar quarto','procurar quarto','procura de quarto'
];
const CONDO_NEIGHBOUR=[
  'vizinhos','vizinho','vizinhança','vizinhanca','ruído','ruido','barulho','partes comuns','áreas comuns','areas comuns',
  'elevador','administração do condomínio','administracao do condominio','assembleia de condomínio','assembleia de condominio'
];
const HOUSING_MARKET=[
  'preços das casas','precos das casas','preço das casas','preco das casas','preço da habitação','preco da habitacao',
  'valor dos imóveis','valor dos imoveis','valor das casas','transações de casas','transacoes de casas',
  'vendas de casas','mercado imobiliário','mercado imobiliario','avaliação bancária da habitação','avaliacao bancaria da habitacao'
];
const PORTUGAL_SIGNAL=[
  'portugal','português','portugues','portuguesa','portuguesas','prr','lisboa','porto','coimbra','braga','aveiro','évora','evora','faro',
  'açores','acores','madeira','algarve','setúbal','setubal','leiria','viseu','santarém','santarem'
];
const READER_UTILITY=[
  'quanto custa','como poupar','poupar','como evitar','evitar','o que fazer','o que muda','o que muda para',
  'dicas','soluções','solucoes','erros','problemas','alerta','nova plataforma','ajuda a','guia','passo a passo',
  'recorde','novo apoio','novo incentivo','novas regras','nova regra','entra em vigor','vai mudar'
];
const READER_INTEREST=[
  'icónica','iconica','icónicas','iconicas','premiada','premiadas','prémio','premio','tendência','tendencia','tendências','tendencias',
  'curiosidade','inovador','inovadora','primeiro','primeira','recorde'
];
const LUXURY_PROMO=[
  'luxo','casas de sonho','casa de sonho','espreitadas','arquitetura de luxo','celebridade','celebridades','mansão','mansao',
  'villa de luxo','penthouse de luxo'
];
const BRAND_PROMO=[
  'marca apresenta','marca portuguesa apresenta','coleção de mobiliário','colecao de mobiliario','nova coleção','nova colecao','showroom'
];
const SELLING_INTENT=[
  'vender casa','venda de casa','venda da casa','avaliar casa','avaliação do imóvel','avaliacao do imovel',
  'preço de venda','preco de venda','mediação imobiliária','mediacao imobiliaria','agência imobiliária','agencia imobiliaria'
];
const SERVICE_INTENT=[
  'obras em casa','obras na casa','reparação','reparacao','limpeza','certificado energético','certificado energetico',
  'seguro casa','painéis solares','paineis solares','isolamento','condomínio','condominio','mudanças','mudancas'
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
function stableTitle(candidate={}) {
  return candidate.source_title||candidate.title||'';
}
function stableScoringText(candidate={}) {
  return [stableTitle(candidate),candidate.source_description||''].filter(Boolean).join(' ');
}
function sourceLooksPortuguese(candidate={}) {
  let host=String(candidate.source_domain||'').toLowerCase().replace(/^www\./,'');
  if (!host) {
    try { host=new URL(candidate.article_url||candidate.url||'').hostname.toLowerCase().replace(/^www\./,''); } catch {}
  }
  return host.endsWith('.pt')||host.endsWith('.sapo.pt')||host.endsWith('.iol.pt')||host.endsWith('.dn.pt')||host==='rtp.pt';
}

export function inferDeterministicPillar(candidate={}) {
  const text=normalizeEditorialText(stableScoringText(candidate));
  if (/\b(?:imi|imt|irs|imposto|impostos|fisco|fiscal|mais valias)\b/u.test(text)) return 'impostos';
  if (/\b(?:condominio|condominios|condomino|condominos|fundo comum|administrador do condominio|assembleia de condominio)\b/u.test(text)) return 'condominio';
  if (/\b(?:arrendamento|renda|rendas|senhorio|senhorios|inquilino|inquilinos|despejo|despejos|caucao|arrendar quarto|alugar quarto|residencia universitaria|alojamento estudantil)\b/u.test(text)) return 'arrendar';
  if (/\b(?:vender|venda de casa|venda da casa|avaliacao do imovel|mediacao imobiliaria|preco de venda)\b/u.test(text)) return 'vender';
  return 'casa';
}

export function inferDeterministicLegalStage(candidate={}) {
  const text=normalizeEditorialText([
    stableTitle(candidate),
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

function falsePositiveKind(normalizedText) {
  if (/\b(?:morto|morta|cadaver|homicidio|assassinado|assassinada)\b/u.test(normalizedText) && /\bcasa\b/u.test(normalizedText)) return 'crime_home_word';
  if (/\b(?:obra|obras) de arte\b|\bmuseu\b|\bexposicao\b/u.test(normalizedText)) return 'art_work';
  if (/\b(?:concurso|concursos|empreitada|empreitadas) de obras publicas\b|\bobras publicas\b/u.test(normalizedText)) return 'public_works';
  return '';
}

export function scoreEditorialEvent(candidate={}) {
  const text=stableScoringText(candidate);
  const title=stableTitle(candidate);
  const normalizedText=normalizeEditorialText(text);
  const normalizedTitle=normalizeEditorialText(title);
  const pillar=inferDeterministicPillar(candidate);

  const signals={
    pillar,
    strong_homeowner:containsAny(text,STRONG_HOMEOWNER),
    mortgage:containsAny(text,MORTGAGE),
    policy:containsAny(text,POLICY),
    housing_supply:containsAny(text,HOUSING_SUPPLY),
    owner_rules:containsAny(text,OWNER_RULES),
    home_practical:containsAny(text,HOME_PRACTICAL),
    home_living:containsAny(text,HOME_LIVING),
    student_housing:containsAny(text,STUDENT_HOUSING),
    condo_neighbour:containsAny(text,CONDO_NEIGHBOUR),
    housing_market:containsAny(text,HOUSING_MARKET),
    portugal:containsAny(text,PORTUGAL_SIGNAL),
    portuguese_source:sourceLooksPortuguese(candidate),
    reader_utility:containsAny(text,READER_UTILITY),
    reader_interest:containsAny(text,READER_INTEREST),
    numeric:/\d/u.test(normalizedTitle),
    official:Boolean(candidate.is_official),
    luxury_promo:containsAny(text,LUXURY_PROMO),
    brand_promo:containsAny(text,BRAND_PROMO),
    opinion:/\bopiniao\b/u.test(normalizedText),
    selling_intent:containsAny(text,SELLING_INTENT),
    service_intent:containsAny(text,SERVICE_INTENT),
    false_positive:falsePositiveKind(normalizedText)
  };

  const direct=signals.strong_homeowner||signals.mortgage||signals.housing_supply||signals.home_practical||signals.student_housing||signals.condo_neighbour||signals.housing_market;
  const financeOrLegal=signals.policy||signals.mortgage||signals.housing_market||pillar==='impostos';
  const meaningfulMortgage=signals.mortgage && /\b(?:prestacao|credito habitacao|credito a habitacao|hipoteca|mensalidade)\b/u.test(normalizedText);
  const routineFinance=signals.mortgage && !meaningfulMortgage && /\b(?:euribor|taxa)\b/u.test(normalizedTitle) && /\b(?:sobe|subiu|desce|desceu|cai|caiu|avanca|recua|mantem|volta a subir|volta a descer)\b/u.test(normalizedTitle);
  signals.direct_home_relevance=direct;
  signals.finance_or_legal=financeOrLegal;
  signals.routine_finance=routineFinance;

  // Relevância editorial: utilidade prática (30), ligação direta à casa (25),
  // interesse para o leitor (20), proximidade a Portugal (10) e impacto
  // económico/legal (10), com até 5 pontos de credibilidade factual.
  let utility=0;
  if (signals.home_practical||signals.student_housing||signals.condo_neighbour) utility=30;
  else if (signals.strong_homeowner||meaningfulMortgage||signals.housing_supply) utility=24;
  else if (signals.housing_market||signals.mortgage) utility=18;
  else if (signals.home_living) utility=15;

  let directScore=0;
  if (direct) directScore=25;
  else if (signals.home_living) directScore=20;
  else if (signals.owner_rules && /\b(?:casa|habitacao|imovel|arrendamento|condominio)\b/u.test(normalizedText)) directScore=18;

  let interest=5;
  if (signals.reader_utility) interest=20;
  else if (signals.reader_interest||signals.housing_supply||signals.policy) interest=15;
  else if (signals.numeric||signals.housing_market||signals.home_living) interest=12;

  const proximity=signals.portugal?10:(signals.portuguese_source?5:0);
  const economicLegal=financeOrLegal?10:(signals.owner_rules||signals.home_practical?5:0);
  const credibility=signals.official?5:0;

  let news=utility+directScore+interest+proximity+economicLegal+credibility;
  if (signals.routine_finance) news-=15;
  if (signals.opinion) news-=25;
  if (signals.luxury_promo) news-=25;
  if (signals.brand_promo) news-=12;
  if (signals.false_positive==='crime_home_word'||signals.false_positive==='art_work') news=Math.min(news,10);
  if (signals.false_positive==='public_works') news=Math.min(news,20);

  let seo=20;
  if (direct) seo+=30;
  if (signals.home_practical||signals.student_housing||signals.condo_neighbour) seo+=20;
  if (signals.housing_market||signals.mortgage) seo+=15;
  if (signals.owner_rules||signals.policy) seo+=10;
  if (signals.reader_utility) seo+=10;
  if (signals.home_living) seo+=8;
  if (signals.numeric) seo+=5;
  if (signals.opinion) seo-=15;
  if (signals.luxury_promo) seo-=20;
  if (signals.brand_promo) seo-=10;
  if (signals.false_positive) seo=Math.min(seo,20);

  const pillarLead={vender:55,impostos:15,arrendar:30,condominio:22,casa:20}[pillar];
  let lead=pillarLead;
  if (signals.selling_intent) lead+=30;
  if (signals.service_intent||signals.home_practical) lead+=18;
  if (meaningfulMortgage) lead+=12;
  if (signals.student_housing) lead+=15;
  if (signals.housing_market) lead+=10;
  if (signals.owner_rules) lead+=8;
  if (signals.policy) lead-=8;
  if (signals.opinion) lead-=10;
  if (signals.luxury_promo) lead-=15;
  if (signals.false_positive) lead=Math.min(lead,10);

  return {
    scoring_version:'deterministic_v3_home_balanced',
    pillar,
    news_score:clamp(news),
    seo_score:clamp(seo),
    lead_score:clamp(lead),
    signals:{...signals,utility_score:utility,direct_score:directScore,interest_score:interest,proximity_score:proximity,economic_legal_score:economicLegal,credibility_score:credibility}
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
