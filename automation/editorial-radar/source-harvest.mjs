import {inspectSourceUrl} from './source-metadata.mjs';
import {scoreEditorialEvent} from './editorial-scoring.mjs';

const USER_AGENT='Mozilla/5.0 (compatible; GuiaDoProprietario-EditorialRadar/21.2; +https://guiadoproprietario.pt/)';
const RELEVANT_TERMS=[
  'casa','casas','habitação','imóvel','imobiliário','condomínio','renda','arrendamento','senhorio','crédito','euribor','imi','imt','irs','obras','energia','herança','propriedade','venda','preços',
  'reparação','manutenção','humidade','bolor','infiltração','canalização','isolamento','janelas','telhado','pintura','remodelação','limpeza','pragas',
  'eficiência energética','painéis solares','conta da luz','fatura da luz','conta de água','seguro multirriscos','segurança doméstica','aquecimento','ar condicionado','ventilação','calor',
  'quarto','quartos','estudante','estudantes','residência universitária','alojamento estudantil','vizinhos','ruído','elevador','cozinha','casa de banho','eletrodomésticos','decoração','arrumação','jardim','varanda','terraço'
];
const EXCLUDED=/(?:^|\/)(?:login|newsletter|autor(?:es)?|author|tags?|pesquisa|search|contactos?|contacts?|politica(?:-de)?-cookies?|cookies?|privacy|privacidade|facebook|instagram|linkedin|twitter|x\.com)(?:\/|$)/i;
const ARTICLE_TYPES=new Set(['newsarticle','article','reportagenewsarticle','blogposting']);
const HIGH_RELEVANCE=[
  'condomínio','condomínios','habitação','arrendamento','senhorio','senhorios','inquilino','inquilinos',
  'renda','rendas','imóvel','imóveis','imobiliário','moradia','moradias','crédito habitação',
  'crédito à habitação','euribor','imi','imt','mais-valias','propriedade','proprietário','proprietários',
  'herança','heranças','despejo','despejos','reparação','reparações','manutenção','humidade','bolor','infiltração',
  'eficiência energética','painéis solares','quarto para estudante','quartos para estudantes','residência universitária',
  'alojamento estudantil','vizinhos','ruído','elevador','segurança doméstica'
];
const MEDIUM_RELEVANCE=[
  'obras','construção','energia','hipoteca','prestação','prestações','preços das casas',
  'compra de casa','venda de casa','alojamento','fiscalidade habitação','irs rendas','reabilitação','licença','licenciamento',
  'canalização','isolamento','janelas','telhado','pintura','remodelação','limpeza','pragas','aquecimento','ar condicionado',
  'ventilação','cozinha','casa de banho','eletrodomésticos','decoração','arrumação','jardim','varanda','terraço','calor'
];
const CONTEXT_RELEVANCE=['impostos','juros','banco','financiamento','seguros','calor','eficiência','município','prédio','edifício','água','luz','gás'];
const NEGATIVE_TOPICS=[
  'futebol','benfica','sporting','fc porto','voleibol','andebol','atletismo','desporto','trump','ucrânia','rússia',
  'bolsa internacional','petróleo','automóvel','turismo','aviação','telecomunicações','celebridades',
  'nuclear','central nuclear'
];

function decodeHtml(value='') {
  return value
    .replace(/&quot;|&#34;/gi,'"')
    .replace(/&#39;|&apos;/gi,"'")
    .replace(/&amp;/gi,'&')
    .replace(/&lt;/gi,'<')
    .replace(/&gt;/gi,'>')
    .replace(/&#(\d+);/g,(_,code)=>String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi,(_,code)=>String.fromCodePoint(Number.parseInt(code,16)));
}

function plainText(value='') {
  return decodeHtml(value.replace(/<[^>]*>/g,' ')).replace(/\s+/g,' ').trim();
}

function normalized(value='') {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
}

export function canonicalHarvestUrl(value) {
  try {
    const url=new URL(value);
    if (!/^https?:$/.test(url.protocol)) return '';
    url.hash='';
    url.hostname=url.hostname.toLowerCase();
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_|fbclid$|gclid$|mc_cid$|mc_eid$)/i.test(key)) url.searchParams.delete(key);
    }
    url.pathname=url.pathname.replace(/\/{2,}/g,'/').replace(/\/+$/,'') || '/';
    return url.toString();
  } catch { return ''; }
}

function domainAllowed(candidate, seed) {
  const host=candidate.hostname.toLowerCase();
  const expected=(seed.allowedDomains?.length ? seed.allowedDomains : [new URL(seed.url).hostname]).map(value=>value.toLowerCase());
  return expected.some(domain=>host===domain || host.endsWith(`.${domain}`));
}

function excludedUrl(url) {
  let pathname=url.pathname;
  try { pathname=decodeURIComponent(pathname); } catch {}
  return EXCLUDED.test(`${url.hostname}${pathname}`) || /(?:facebook|instagram|linkedin|twitter)\.com$/i.test(url.hostname);
}

export function extractPageLinks(html, seed) {
  const links=new Map();
  for (const match of html.matchAll(/<a\b[^>]*href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>([\s\S]*?)<\/a>/gi)) {
    const href=decodeHtml(match[1]??match[2]??match[3]??'').trim();
    if (!href || /^(?:#|javascript:|mailto:|tel:)/i.test(href)) continue;
    let absolute;
    try { absolute=new URL(href,seed.url); } catch { continue; }
    if (!domainAllowed(absolute,seed) || excludedUrl(absolute)) continue;
    const url=canonicalHarvestUrl(absolute.toString());
    if (!url || url===canonicalHarvestUrl(seed.url)) continue;
    const title=plainText(match[4]);
    if (!links.has(url) || (!links.get(url).title && title)) links.set(url,{url,title,origin:'seed'});
  }
  return [...links.values()];
}

export function extractRobotsSitemaps(text, robotsUrl) {
  const urls=[];
  for (const line of text.split(/\r?\n/)) {
    const value=line.match(/^\s*Sitemap\s*:\s*(.+?)\s*$/i)?.[1];
    if (!value) continue;
    try {
      const url=canonicalHarvestUrl(new URL(value,robotsUrl).toString());
      if (url && !urls.includes(url)) urls.push(url);
    } catch {}
  }
  return urls;
}

function xmlValue(block,name) {
  const escaped=name.replace(':','\\:');
  return decodeHtml(block.match(new RegExp(`<${escaped}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${escaped}>`,'i'))?.[1]||'').trim();
}

export function extractSitemap(xml) {
  const indexes=[];
  for (const match of xml.matchAll(/<sitemap\b[^>]*>([\s\S]*?)<\/sitemap>/gi)) {
    const loc=xmlValue(match[1],'loc');
    if (loc) indexes.push(loc);
  }
  const entries=[];
  for (const match of xml.matchAll(/<url\b[^>]*>([\s\S]*?)<\/url>/gi)) {
    const block=match[1];
    const url=xmlValue(block,'loc');
    if (!url) continue;
    entries.push({
      url,
      title:plainText(xmlValue(block,'news:title')),
      publication_date:xmlValue(block,'news:publication_date'),
      lastmod:xmlValue(block,'lastmod')
    });
  }
  return {indexes,entries};
}

function containsRelevantTerm(value) {
  const text=` ${normalized(value)} `;
  return RELEVANT_TERMS.some(term=>text.includes(` ${normalized(term)} `));
}

function isSectionSeed(seed) {
  return seed.section===true || /(?:economia|imobiliario|news)(?:\/|$)/i.test(new URL(seed.url).pathname);
}

function termMatches(text,terms) {
  const haystack=` ${normalized(text)} `;
  return terms.filter(term=>haystack.includes(` ${normalized(term)} `));
}

function decodedPathname(value) {
  try {
    const pathname=new URL(value).pathname;
    try { return decodeURIComponent(pathname).toLowerCase().replace(/\/+$/,'') || '/'; }
    catch { return pathname.toLowerCase().replace(/\/+$/,'') || '/'; }
  } catch { return ''; }
}

function genericPage(source) {
  const pathname=decodedPathname(source.url);
  const seedPath=source.source_seed ? decodedPathname(source.source_seed) : '';
  if (seedPath && pathname===seedPath) return true;
  if (/(?:^|\/)(?:topico|tópico|etiquetas)(?:\/|$)/i.test(pathname)) return true;
  if (normalized(source.direct_source||'')==='idealista news portugal' && !/\/\d{4}\/\d{2}\/\d{2}\//.test(pathname)) return true;
  return new Set([
    '/','/noticias','/imobiliario','/imobiliario/habitacao','/news','/news/imobiliario',
    '/news/imobiliario/habitacao','/news/imobiliario/construcao'
  ]).has(pathname);
}

export function scoreHarvestRelevance(source) {
  const title=source.verified_title || source.title || '';
  const titleForScoring=title.replace(/\bcasa branca\b/gi,'');
  const anchor=source.anchor_text || '';
  const pathname=decodedPathname(source.url);
  const contentText=[titleForScoring,source.source_description||'',anchor,pathname,source.article_type||''].join(' ');
  const high=termMatches(contentText,HIGH_RELEVANCE);
  const medium=termMatches(contentText,MEDIUM_RELEVANCE);
  const contextual=termMatches(contentText,CONTEXT_RELEVANCE);
  const titleHigh=termMatches(titleForScoring,HIGH_RELEVANCE);
  const negative=termMatches(`${title} ${pathname}`,NEGATIVE_TOPICS);
  const articleType=ARTICLE_TYPES.has(normalized(source.article_type).replace(/\s+/g,''));
  const balanced=scoreEditorialEvent({
    source_title:titleForScoring,
    title:titleForScoring,
    source_description:source.source_description||anchor||'',
    article_url:source.url||'',
    source_domain:source.source_domain||'',
    is_official:Boolean(source.is_official)
  });
  let score=balanced.news_score + (articleType ? 2 : 0);
  let reason='';

  if (genericPage(source)) reason='non_article';
  const directSource=normalized(source.direct_source||'');
  const titleNormalized=normalized(title);
  const hasStrongOwnerSignal=titleHigh.length>0 || balanced.signals?.direct_home_relevance===true;
  if (!reason && /(?:^|\/)mundo(?:\/|$)/i.test(pathname)) reason='excluded_section';
  if (!reason && /(?:^|\/)opiniao(?:\/|$)/i.test(pathname) && !hasStrongOwnerSignal) reason='excluded_section';
  if (!reason && /\b(?:morto|morte|plagio|policia|pj)\b/i.test(titleNormalized) && !hasStrongOwnerSignal) reason='excluded_section';
  if (!reason && directSource==='rtp economia') {
    if (/\/(?:desporto|benfica|outras-modalidades)(?:\/|$)|\/futebol-[^/]*(?:\/|$)/i.test(pathname)) reason='excluded_section';
    else if (pathname.startsWith('/noticias/economia/')) score+=1;
  }
  if (!reason && directSource==='dinheiro vivo imobiliario') {
    if (pathname.startsWith('/imobiliario/')) score+=4;
    else if (!hasStrongOwnerSignal) reason='excluded_section';
  }
  if (!reason && negative.length && !hasStrongOwnerSignal) reason='excluded_section';

  const minimum=50;
  if (!reason && score<minimum) reason='low_relevance';
  return {
    score,
    relevant:!reason,
    reason,
    signals:{
      high,medium,contextual,negative,article_type:articleType,
      balanced_news_score:balanced.news_score,
      balanced_version:balanced.scoring_version,
      direct_home_relevance:Boolean(balanced.signals?.direct_home_relevance),
      routine_finance:Boolean(balanced.signals?.routine_finance),
      false_positive:balanced.signals?.false_positive||''
    }
  };
}

export function prefilterHarvestSources(sources,{limit=24,dryRun=false,telemetry=dryRun}={}) {
  const rejectionCounts={non_article:0,low_relevance:0,excluded_section:0};
  const relevant=[];
  for (const source of sources) {
    const result=scoreHarvestRelevance(source);
    if (!result.relevant) {
      rejectionCounts[result.reason]++;
      continue;
    }
    relevant.push({...source,harvest_relevance_score:result.score});
  }
  relevant.sort((a,b)=>
    b.harvest_relevance_score-a.harvest_relevance_score ||
    Date.parse(b.verified_published_at)-Date.parse(a.verified_published_at)
  );
  const selected=[];
  const deferred=[];
  const perSource=new Map();
  for (const source of relevant) {
    const key=source.direct_source || source.source_domain || 'unknown';
    const count=perSource.get(key)||0;
    if (count<8 && selected.length<limit) {
      selected.push(source);
      perSource.set(key,count+1);
    } else deferred.push(source);
  }
  for (const source of deferred) {
    if (selected.length>=limit) break;
    selected.push(source);
  }
  if (telemetry) {
    console.log(JSON.stringify({
      stage:'harvest_prefilter',
      fresh_input:sources.length,
      relevant:relevant.length,
      rejected:sources.length-relevant.length,
      sent_to_validator:selected.length
    }));
    for (const source of selected) console.log(JSON.stringify({
      stage:'harvest_selected',
      source:source.direct_source || source.source_domain || '',
      title:source.verified_title || source.title || '',
      score:source.harvest_relevance_score,
      published_at:source.verified_published_at || '',
      url:source.url
    }));
    console.log(JSON.stringify({stage:'harvest_prefilter_rejections',...rejectionCounts}));
  }
  return {selected,relevant,rejectionCounts};
}

export function rankHarvestCandidates(seed, pageLinks, sitemapEntries, currentTime=new Date(), limit=30) {
  const candidates=new Map();
  const cutoff=currentTime.getTime()-48*60*60*1000;
  for (const entry of sitemapEntries) {
    const published=Date.parse(entry.publication_date);
    if (!Number.isFinite(published) || published<cutoff || published>currentTime.getTime()+5*60*1000) continue;
    let parsed;
    try { parsed=new URL(entry.url); } catch { continue; }
    if (!domainAllowed(parsed,seed) || excludedUrl(parsed)) continue;
    const url=canonicalHarvestUrl(parsed.toString());
    const relevant=containsRelevantTerm(`${entry.title} ${url}`);
    if (!relevant && !isSectionSeed(seed)) continue;
    if (url) candidates.set(url,{
      url,
      title:entry.title||'',
      origin:'news_sitemap',
      priority:relevant ? 4 : 3
    });
  }
  for (const link of pageLinks) {
    const relevant=containsRelevantTerm(`${link.title} ${link.url}`);
    if (!relevant && !isSectionSeed(seed)) continue;
    const priority=relevant ? 2 : 1;
    const previous=candidates.get(link.url);
    if (!previous || previous.priority<priority) candidates.set(link.url,{...link,priority});
  }
  return [...candidates.values()]
    .sort((a,b)=>b.priority-a.priority || Number(Boolean(b.title))-Number(Boolean(a.title)))
    .slice(0,limit)
    .map(({priority,...candidate})=>candidate);
}

async function fetchText(url,fetchImpl=fetch) {
  try {
    const response=await fetchImpl(url,{
      redirect:'follow',
      signal:AbortSignal.timeout(8000),
      headers:{
        'User-Agent':USER_AGENT,
        'Accept':'text/html,application/xhtml+xml,application/xml,text/xml,text/plain;q=0.9,*/*;q=0.7',
        'Accept-Language':'pt-PT,pt;q=0.9,en;q=0.7'
      }
    });
    if (!response.ok) return {ok:false,text:'',status:response.status};
    return {ok:true,text:await response.text(),status:response.status};
  } catch { return {ok:false,text:'',status:0}; }
}

async function sitemapCandidates(seed,fetchImpl,currentTime) {
  const root=new URL(seed.url);
  const robotsUrl=`${root.protocol}//${root.host}/robots.txt`;
  const robots=await fetchText(robotsUrl,fetchImpl);
  if (!robots.ok) return [];
  const queue=extractRobotsSitemaps(robots.text,robotsUrl)
    .sort((a,b)=>Number(/news/i.test(b))-Number(/news/i.test(a)))
    .slice(0,8);
  const visited=new Set();
  const entries=[];
  const relevantSitemapName=new RegExp(`news|noticias|post|article|${currentTime.getUTCFullYear()}`,'i');
  while (queue.length && visited.size<12) {
    const sitemapUrl=queue.shift();
    if (visited.has(sitemapUrl)) continue;
    visited.add(sitemapUrl);
    const response=await fetchText(sitemapUrl,fetchImpl);
    if (!response.ok) continue;
    const parsed=extractSitemap(response.text);
    entries.push(...parsed.entries);
    const children=parsed.indexes
      .filter(url=>relevantSitemapName.test(url))
      .sort((a,b)=>Number(/news/i.test(b))-Number(/news/i.test(a)));
    for (const child of children) if (!visited.has(child)) queue.push(child);
  }
  return entries;
}

export async function harvestDirectSources(seeds,{currentTime=new Date(),fetchImpl=fetch,dryRun=false,telemetry=dryRun}={}) {
  const freshByUrl=new Map();
  let totalFreshArticles=0;
  for (const seed of seeds) {
    const seedResponse=await fetchText(seed.url,fetchImpl);
    const links=seedResponse.ok ? extractPageLinks(seedResponse.text,seed) : [];
    const sitemapEntries=await sitemapCandidates(seed,fetchImpl,currentTime);
    const candidates=rankHarvestCandidates(seed,links,sitemapEntries,currentTime,30);
    let fetchFailures=0;
    let freshArticles=0;
    for (let start=0; start<candidates.length; start+=6) {
      const batch=candidates.slice(start,start+6);
      const inspections=await Promise.all(batch.map(candidate=>inspectSourceUrl(candidate,{fetchImpl,timeoutMs:8000})));
      for (let index=0; index<batch.length; index++) {
        const candidate=batch[index];
        const inspection=inspections[index];
        if (!inspection.fetch_ok) fetchFailures++;
        const published=Date.parse(inspection.published_at);
        if (!Number.isFinite(published) || published<currentTime.getTime()-36*60*60*1000 || published>currentTime.getTime()+5*60*1000) continue;
        const url=canonicalHarvestUrl(candidate.url);
        if (!url || freshByUrl.has(url)) continue;
        freshArticles++;
        freshByUrl.set(url,{
          url,
          title:inspection.title || candidate.title || '',
          source_domain:new URL(url).hostname,
          sweep:`direct_${seed.slug}`,
          direct_source:seed.name,
          source_seed:seed.url,
          anchor_text:candidate.title || '',
          verified_published_at:inspection.published_at,
          verified_title:inspection.title || candidate.title || '',
          date_status:'verified',
          date_source:inspection.date_source,
          article_type:inspection.article_type,
          probable_article:inspection.probable_article,
          fetch_ok:true
        });
      }
    }
    totalFreshArticles+=freshArticles;
    if (telemetry) console.log(JSON.stringify({
      stage:'direct_source',
      source:seed.name,
      seed_fetch_ok:seedResponse.ok,
      links_extracted:links.length,
      urls_inspected:candidates.length,
      fresh_articles:freshArticles,
      fetch_failures:fetchFailures
    }));
  }
  const fresh=[...freshByUrl.values()];
  if (telemetry) console.log(JSON.stringify({
    stage:'direct_source_summary',
    sources:seeds.length,
    fresh_articles:totalFreshArticles,
    unique_fresh_urls:fresh.length
  }));
  return fresh;
}
