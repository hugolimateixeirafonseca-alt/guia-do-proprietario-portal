const STOPWORDS=new Set([
  'a','ao','aos','as','à','às','o','os','um','uma','uns','umas','de','da','das','do','dos','e','em','no','nos','na','nas',
  'por','para','com','sem','sob','sobre','entre','que','quem','qual','quais','como','mais','menos','muito','muita','muitos',
  'muitas','se','ser','são','foi','vai','tem','ter','já','não','novo','nova','novos','novas','pode','podem','quando','onde',
  'seu','sua','seus','suas','este','esta','estes','estas','isso','isto','também','após','antes','até','desde','cada'
].map(normalizeToken));
const SHORT_SIGNIFICANT=new Set(['imi','imt','irs']);
const STRONG_MATCH_TOKENS=new Set([
  'condominio','condominios','euribor','credito','hipoteca','prestacao','prestacoes','arrendamento','renda','rendas',
  'senhorio','senhorios','inquilino','inquilinos','despejo','despejos','imi','imt','irs','aimi','maisvalias',
  'heranca','herancas','proprietario','proprietarios'
].map(normalizeToken));
const LEGAL_STAGES=new Set(['publicacao','entrada_em_vigor','alteracao','revogacao'].map(normalizeToken));
const TOPIC_GROUPS={
  condominio:['condominio','condominios','assembleia','administrador','administracao','quota','quotas','vizinho','vizinhos'],
  credito:['euribor','credito','habitacao','hipoteca','prestacao','prestacoes','financiamento','banco'],
  arrendamento:['arrendamento','arrendar','renda','rendas','senhorio','senhorios','inquilino','inquilinos','despejo','despejos'],
  impostos:['imposto','impostos','fiscalidade','imi','imt','irs','aimi','maisvalias'],
  vender:['venda','vender','preco','precos','avaliacao','mercado','comprador','compradores'],
  obras_energia:['obra','obras','construcao','reabilitacao','energia','energetica','eficiencia','certificado','licenciamento'],
  propriedade:['propriedade','proprietario','proprietarios','heranca','herancas','imovel','imoveis','casa','casas','moradia','moradias']
};
const RELATED_PILLARS={
  condominio:new Set(['condominio','casa']),
  casa:new Set(['casa','condominio']),
  arrendar:new Set(['arrendar','impostos']),
  impostos:new Set(['impostos','arrendar','vender']),
  vender:new Set(['vender','impostos'])
};

function normalizeToken(value='') {
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'');
}

function tokens(value='') {
  const values=String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().split(/[^a-z0-9]+/);
  return new Set(values.map(normalizeToken).filter(token=>(token.length>=4 || SHORT_SIGNIFICANT.has(token)) && !STOPWORDS.has(token)));
}

function intersection(left,right) {
  return [...left].filter(token=>right.has(token));
}

function eventText(event) {
  return [
    event.verified_title,event.title,event.titulo,event.verified_summary,event.summary,
    ...(event.key_facts||[]),...(event.entities||[]),event.legal_stage
  ].filter(Boolean).join(' ');
}

function articleText(article) {
  return [article.title,article.slug,article.summary,article.body_excerpt].filter(Boolean).join(' ');
}

function commonTopicGroups(eventTokens,articleTokens) {
  const groups=[];
  for (const [name,terms] of Object.entries(TOPIC_GROUPS)) {
    const normalizedTerms=terms.map(normalizeToken);
    if (normalizedTerms.some(term=>eventTokens.has(term)) && normalizedTerms.some(term=>articleTokens.has(term))) groups.push(name);
  }
  return groups;
}

function relevantExcerpt(body,eventTokens,maxLength=1500) {
  const text=String(body||'').replace(/\s+/g,' ').trim();
  if (text.length<=maxLength) return text;
  const normalized=text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  let matchIndex=-1;
  for (const token of eventTokens) {
    const index=normalized.indexOf(token);
    if (index>=0 && (matchIndex<0 || index<matchIndex)) matchIndex=index;
  }
  const start=Math.max(0,(matchIndex<0 ? 0 : matchIndex)-200);
  return text.slice(start,start+maxLength);
}

export function scoreContentMatch(event,article) {
  const eText=eventText(event);
  const aText=articleText(article);
  const eTokens=tokens(eText);
  const aTokens=tokens(aText);
  const articleHeadingTokens=tokens(`${article.title||''} ${article.slug||''}`);
  const commonAll=intersection(eTokens,aTokens);
  const commonHeading=intersection(eTokens,articleHeadingTokens);
  const strongAll=commonAll.filter(token=>STRONG_MATCH_TOKENS.has(token));
  const strongHeading=commonHeading.filter(token=>STRONG_MATCH_TOKENS.has(token));
  const commonGroups=commonTopicGroups(eTokens,aTokens);
  const eventPillar=normalizeToken(event.pillar||'');
  const articlePillar=normalizeToken(article.pillar||'');
  let pillarScore=0;
  if (eventPillar && articlePillar) {
    if (eventPillar===articlePillar) pillarScore=6;
    else if (RELATED_PILLARS[eventPillar]?.has(articlePillar)) pillarScore=3;
  }
  let entityMatches=0;
  const normalizedArticle=` ${String(aText).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()} `;
  for (const entity of event.entities||[]) {
    const normalizedEntity=String(entity).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
    if (normalizedEntity.length>=4 && normalizedArticle.includes(normalizedEntity)) entityMatches++;
  }
  const score=pillarScore + Math.min(12,commonHeading.length*3) + Math.min(8,commonAll.length) + Math.min(10,strongAll.length*2) + Math.min(10,strongHeading.length*5) + commonGroups.length*4 + Math.min(10,entityMatches*5);
  return {score,pillarScore,commonTokens:commonAll,headingTokens:commonHeading,strongTokens:strongAll,topicGroups:commonGroups,entityMatches};
}

export function prefilterContentImpact(event,articles,{normalThreshold=8,legalThreshold=6}={}) {
  const threshold=LEGAL_STAGES.has(normalizeToken(event.legal_stage||'')) ? legalThreshold : normalThreshold;
  const scored=articles.map(article=>({article,...scoreContentMatch(event,article)}))
    .sort((a,b)=>b.score-a.score || String(a.article.path).localeCompare(String(b.article.path)));
  const matches=scored.filter(item=>item.score>=threshold);
  const maxArticles=LEGAL_STAGES.has(normalizeToken(event.legal_stage||'')) ? 5 : 3;
  const eventTokens=tokens(eventText(event));
  const selected=matches.slice(0,maxArticles).map(item=>({
    path:item.article.path,
    title:item.article.title||'',
    summary:item.article.summary||'',
    body_excerpt:relevantExcerpt(item.article.body_excerpt,eventTokens,1500)
  }));
  return {
    articlesConsidered:articles.length,
    matches:matches.length,
    selected,
    topScores:scored.slice(0,5).map(item=>({path:item.article.path,score:item.score})),
    threshold
  };
}
