import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {inspectSourceUrl} from './source-metadata.mjs';
import {harvestDirectSources,prefilterHarvestSources} from './source-harvest.mjs';
import {prefilterContentImpact} from './content-impact-prefilter.mjs';
import {finalizePublication,PublicationQualityError} from './publication-image-prompt.mjs';
import {DEFAULT_MIN_NEWS_SCORE,isPublishableNews} from './publication-eligibility.mjs';
import {applyDeterministicEditorialScores} from './editorial-scoring.mjs';
import {shouldAssessContentImpact} from './impact-gate.mjs';
import {shouldUpgradeLegacyPublication} from './legacy-upgrade.mjs';
import {resolveDuplicateTarget} from './duplicate-target.mjs';
import {extractFactualCandidates} from './factual-extraction.mjs';
import {publicationEvidenceStatus} from './publication-evidence.mjs';
import {evaluateViralPriority} from './viral-priority.mjs';

const REQUIRED=['OPENAI_API_KEY','CF_ACCOUNT_ID','CF_D1_DATABASE_ID','CF_D1_API_TOKEN'];
for (const key of REQUIRED) if (!process.env[key]) throw new Error(`Missing secret: ${key}`);

const CFG={
  openaiModelSearcher:process.env.OPENAI_SEARCHER_MODEL||'gpt-5.6-luna',
  openaiModelValidator:process.env.OPENAI_VALIDATOR_MODEL||'gpt-5.6-luna',
  openaiModelEditor:process.env.OPENAI_EDITOR_MODEL||'gpt-5.6-sol',
  openaiModelImpact:process.env.OPENAI_IMPACT_MODEL||'gpt-5.6-terra',
  openaiModelCopy:process.env.OPENAI_COPY_MODEL||'gpt-5.6-sol',
  makeWebhook:process.env.MAKE_RADAR_WEBHOOK||'',
  makeWebhookSecret:process.env.MAKE_RADAR_WEBHOOK_SECRET||'',
  repoRoot:process.env.GITHUB_WORKSPACE||process.cwd(),
  mode:process.env.RADAR_MODE||'incremental',
  minNewsScore:Number(process.env.MIN_NEWS_SCORE||DEFAULT_MIN_NEWS_SCORE),
  minImpactConfidence:Number(process.env.MIN_IMPACT_CONFIDENCE||80),
  dryRun:/^(1|true|yes)$/i.test(process.env.RADAR_DRY_RUN||''),
  maxRunTokens:Math.max(0,Number(process.env.MAX_RUN_TOKENS||0)||0)
};

const usageTotals={calls:0,input_tokens:0,output_tokens:0,total_tokens:0,web_search_calls:0};
const stats={
  discovered:0,
  enriched:0,
  prefiltered:0,
  factual_verified:0,
  factual_fallback:0,
  duplicates:0,
  events_created:0,
  make_sends:0,
  publication_ready:0,
  publication_not_ready:0,
  publication_quality_rejected:0,
  viral_alerts:0
};

class BudgetGuardStop extends Error {}
const nowIso=()=>new Date().toISOString();
const sha=s=>crypto.createHash('sha256').update(String(s)).digest('hex');
const id=(prefix,value)=>`${prefix}_${sha(value).slice(0,20)}`;
const norm=(s='')=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const slugify=(s='')=>norm(s).replace(/\s+/g,'-').slice(0,120);
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

function log(event) {
  console.log(JSON.stringify(event));
}

function lisbonDateTime(date) {
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{
    timeZone:'Europe/Lisbon',
    day:'2-digit',
    month:'2-digit',
    year:'numeric',
    hour:'2-digit',
    minute:'2-digit',
    hourCycle:'h23'
  }).formatToParts(date).filter(part=>part.type!=='literal').map(part=>[part.type,part.value]));
  return `${parts.day}-${parts.month}-${parts.year} ${parts.hour}:${parts.minute}`;
}

async function openai({model,prompt,purpose,web=false,effort='low',allowedDomains=[],searchContextSize='medium'}) {
  if (CFG.maxRunTokens>0 && usageTotals.total_tokens>=CFG.maxRunTokens) {
    log({stage:'budget_guard',reason:'max_run_tokens',tokens_used:usageTotals.total_tokens,limit:CFG.maxRunTokens});
    throw new BudgetGuardStop('Maximum run token budget reached');
  }
  const body={model,input:prompt,reasoning:{effort}};
  if (web) {
    const webSearch={
      type:'web_search',
      search_context_size:searchContextSize,
      user_location:{type:'approximate',country:'PT',city:'Lisbon',timezone:'Europe/Lisbon'}
    };
    if (allowedDomains.length) webSearch.filters={allowed_domains:allowedDomains};
    body.tools=[webSearch];
    body.tool_choice='required';
    body.include=['web_search_call.action.sources'];
  }
  const res=await fetch('https://api.openai.com/v1/responses',{
    method:'POST',
    headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},
    body:JSON.stringify(body)
  });
  const raw=await res.text();
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${raw.slice(0,1000)}`);
  const data=JSON.parse(raw);
  const text=data.output_text||(data.output||[]).flatMap(item=>item.content||[]).map(content=>content.text||'').join('\n');
  const usage=data.usage||{};
  const inputTokens=Number(usage.input_tokens||0);
  const outputTokens=Number(usage.output_tokens||0);
  const totalTokens=Number(usage.total_tokens??(inputTokens+outputTokens));
  const webSearchCalls=(data.output||[]).filter(item=>item.type==='web_search_call').length;
  usageTotals.calls++;
  usageTotals.input_tokens+=inputTokens;
  usageTotals.output_tokens+=outputTokens;
  usageTotals.total_tokens+=totalTokens;
  usageTotals.web_search_calls+=webSearchCalls;
  log({stage:'openai_usage',purpose,model,input_tokens:inputTokens,output_tokens:outputTokens,total_tokens:totalTokens,web_search_calls:webSearchCalls});
  return {text,raw:data};
}

function parseJson(text) {
  const t=String(text||'').trim().replace(/^```json\s*/i,'').replace(/```$/,'').trim();
  try { return JSON.parse(t); } catch {}
  const a=t.indexOf('{'),b=t.lastIndexOf('}');
  if (a>=0 && b>a) return JSON.parse(t.slice(a,b+1));
  throw new Error(`Model did not return valid JSON: ${t.slice(0,500)}`);
}

async function d1(sql,params=[]) {
  const url=`https://api.cloudflare.com/client/v4/accounts/${process.env.CF_ACCOUNT_ID}/d1/database/${process.env.CF_D1_DATABASE_ID}/query`;
  const res=await fetch(url,{
    method:'POST',
    headers:{Authorization:`Bearer ${process.env.CF_D1_API_TOKEN}`,'Content-Type':'application/json'},
    body:JSON.stringify({sql,params})
  });
  const data=await res.json();
  if (!res.ok||!data.success||data.errors?.length) throw new Error(`D1 query failed: ${JSON.stringify(data.errors||data).slice(0,1200)}`);
  return data.result?.[0]?.results||[];
}

async function initSchema() {
  const sqlPath=path.join(CFG.repoRoot,'automation/editorial-radar/schema.sql');
  const sql=await fs.readFile(sqlPath,'utf8');
  const statements=sql.split(/;\s*(?:\n|$)/).map(s=>s.trim()).filter(Boolean).filter(s=>!s.startsWith('PRAGMA'));
  for (const statement of statements) await d1(statement);
}

const OFFICIAL_DOMAINS=['diariodarepublica.pt','gov.pt','parlamento.pt','ine.pt','bportugal.pt','portaldasfinancas.gov.pt','adene.pt'];
const directSourceSeeds=[
  {name:'CNN Portugal',slug:'cnn_portugal',url:'https://cnnportugal.iol.pt/',allowedDomains:['cnnportugal.iol.pt']},
  {name:'RTP Economia',slug:'rtp_economia',url:'https://www.rtp.pt/noticias/economia',allowedDomains:['rtp.pt'],section:true},
  {name:'ECO',slug:'eco',url:'https://eco.sapo.pt/',allowedDomains:['eco.sapo.pt']},
  {name:'Dinheiro Vivo Imobiliário',slug:'dinheiro_vivo_imobiliario',url:'https://dinheirovivo.dn.pt/imobiliario',allowedDomains:['dinheirovivo.dn.pt'],section:true},
  {name:'Idealista News Portugal',slug:'idealista_news_portugal',url:'https://www.idealista.pt/news/',allowedDomains:['idealista.pt'],section:true},
  {name:'Jornal Económico',slug:'jornal_economico',url:'https://jornaleconomico.sapo.pt/',allowedDomains:['jornaleconomico.sapo.pt']}
];

const searchSweeps=[
  {
    name:'fontes_oficiais',
    topic:'habitação proprietários imóveis arrendamento impostos crédito energia Portugal',
    allowedDomains:OFFICIAL_DOMAINS,
    official:true
  },
  {
    name:'omissoes_editor_chefe',
    topic:'notícias mais importantes em Portugal para alguém que possui uma casa: habitação, arrendamento, condomínios, impostos, crédito habitação, Euribor, venda de casa, obras e energia',
    allowedDomains:[],
    official:false
  }
];

function sourceIsOfficial(source) {
  let hostname=source.source_domain||'';
  if (!hostname) {
    try { hostname=new URL(source.url).hostname; } catch {}
  }
  return OFFICIAL_DOMAINS.some(domain=>hostname===domain||hostname.endsWith(`.${domain}`));
}

function canonicalUrl(value) {
  try {
    const url=new URL(value);
    url.hash='';
    url.hostname=url.hostname.toLowerCase();
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_|fbclid$|gclid$|mc_cid$|mc_eid$)/i.test(key)) url.searchParams.delete(key);
    }
    url.pathname=url.pathname.replace(/\/+$/,'')||'/';
    return url.toString();
  } catch { return ''; }
}

function extractSearchResults(output,sweep,limit=10) {
  const byUrl=new Map();
  const add=(urlValue,title='')=>{
    const url=canonicalUrl(urlValue);
    if (!url||byUrl.has(url)) return;
    byUrl.set(url,{url,title,source_domain:new URL(url).hostname,sweep});
  };
  for (const item of output||[]) {
    for (const content of item.content||[]) {
      for (const annotation of content.annotations||[]) {
        if (annotation.type!=='url_citation') continue;
        const citation=annotation.url_citation||annotation;
        add(citation.url,citation.title||'');
        if (byUrl.size>=limit) return [...byUrl.values()];
      }
    }
  }
  for (const item of output||[]) {
    if (item.type!=='web_search_call') continue;
    for (const source of Array.isArray(item.action?.sources)?item.action.sources:[]) {
      if (typeof source==='string') add(source);
      else add(source?.url,source?.title||'');
      if (byUrl.size>=limit) return [...byUrl.values()];
    }
  }
  return [...byUrl.values()];
}

async function runSearchSweep(definition,currentTime) {
  const hours=definition.official?72:36;
  const start=lisbonDateTime(new Date(currentTime.getTime()-hours*60*60*1000));
  const end=lisbonDateTime(currentTime);
  const prompt=`Pesquisa na web portuguesa notícias publicadas entre ${start} e ${end} relacionadas com ${definition.topic}. Devolve apenas resultados realmente recentes. Se houver poucos, devolve poucos em vez de usar artigos antigos. Para cada resultado indica título, fonte e data quando visível e cita a página original.`;
  const response=await openai({
    model:CFG.openaiModelSearcher,
    prompt,
    purpose:`search_${definition.name}`,
    web:true,
    effort:'low',
    allowedDomains:definition.allowedDomains,
    searchContextSize:'medium'
  });
  const results=extractSearchResults(response.raw.output,definition.name,10);
  log({stage:'searcher',sweep:definition.name,urls_found:results.length});
  return results;
}

async function discoverSources() {
  const currentTime=new Date();
  const direct=await harvestDirectSources(directSourceSeeds,{
    currentTime,
    dryRun:CFG.dryRun,
    telemetry:true
  });

  const webResults=[];
  if (CFG.mode!=='pulse') {
    for (const definition of searchSweeps) {
      const results=await runSearchSweep(definition,currentTime);
      webResults.push(...results);
      await sleep(200);
    }
  } else {
    log({stage:'pulse_discovery',web_search_skipped:true,direct_sources:direct.length});
  }

  const byUrl=new Map();
  for (const source of [...direct,...webResults]) {
    const key=canonicalUrl(source.url);
    if (!key) continue;
    if (!byUrl.has(key)) byUrl.set(key,{...source,url:key});
    else {
      const previous=byUrl.get(key);
      byUrl.set(key,{...source,...previous,title:previous.title||source.title||''});
    }
  }
  stats.discovered=byUrl.size;
  log({stage:'discovery_summary',direct:direct.length,web:webResults.length,unique:byUrl.size});
  return {sources:[...byUrl.values()],currentTime};
}

async function enrichFreshSources(sources,currentTime) {
  const enriched=[];
  const counters={input:sources.length,fetch_failed:0,missing_date:0,outside_window:0,inside_window:0};
  for (let start=0;start<sources.length;start+=6) {
    const batch=sources.slice(start,start+6);
    const inspections=await Promise.all(batch.map(source=>inspectSourceUrl(source,{timeoutMs:10000})));
    for (let index=0;index<batch.length;index++) {
      const source=batch[index];
      const inspection=inspections[index];
      if (!inspection.fetch_ok) {
        counters.fetch_failed++;
        continue;
      }
      const publishedAt=inspection.published_at||source.verified_published_at||'';
      const publishedTime=Date.parse(publishedAt);
      if (!Number.isFinite(publishedTime)) {
        counters.missing_date++;
        continue;
      }
      const official=sourceIsOfficial(source);
      const hours=official?72:36;
      if (publishedTime<currentTime.getTime()-hours*60*60*1000||publishedTime>currentTime.getTime()+5*60*1000) {
        counters.outside_window++;
        continue;
      }
      counters.inside_window++;
      enriched.push({
        ...source,
        source_domain:source.source_domain||new URL(source.url).hostname,
        verified_published_at:new Date(publishedTime).toISOString(),
        verified_title:inspection.title||source.verified_title||source.title||'',
        date_status:'verified',
        date_source:inspection.date_source||source.date_source||'',
        article_type:inspection.article_type||source.article_type||'',
        probable_article:Boolean(inspection.probable_article||source.probable_article),
        source_description:inspection.description||'',
        source_excerpt:inspection.article_excerpt||'',
        source_type:official?'official':'media',
        is_official:official,
        fetch_ok:true
      });
    }
  }
  stats.enriched=enriched.length;
  log({stage:'source_enrichment_summary',...counters});
  return enriched;
}

async function discoverCandidates() {
  const {sources,currentTime}=await discoverSources();
  const enriched=await enrichFreshSources(sources,currentTime);
  const limit=CFG.mode==='pulse'?8:CFG.mode==='incremental'?24:30;
  let prefiltered=prefilterHarvestSources(enriched,{limit,dryRun:CFG.dryRun,telemetry:true}).selected;
  if (CFG.mode==='pulse' && !CFG.dryRun) {
    const unseen=[];
    for (const source of prefiltered) {
      const exists=await d1(`SELECT 1 AS yes FROM event_sources WHERE article_url=? LIMIT 1`,[source.url]);
      if (!exists.length) unseen.push(source);
    }
    log({stage:'pulse_known_url_filter',before:prefiltered.length,after:unseen.length});
    prefiltered=unseen;
  }
  stats.prefiltered=prefiltered.length;
  if (!prefiltered.length) return [];
  const candidates=await extractFactualCandidates(prefiltered,{
    primaryModel:CFG.openaiModelValidator,
    fallbackModel:'gpt-5.6-terra',
    batchSize:4,
    callModel:async ({model,prompt,purpose,effort})=>{
      const response=await openai({model,prompt,purpose,web:false,effort});
      return response.text;
    },
    log
  });
  stats.factual_verified=candidates.filter(candidate=>candidate.validation_status==='verified').length;
  stats.factual_fallback=candidates.length-stats.factual_verified;
  log({
    stage:'factual_summary',
    input:prefiltered.length,
    verified:stats.factual_verified,
    evidence_fallback:stats.factual_fallback,
    total:candidates.length
  });
  return candidates;
}

async function indexContent() {
  if (CFG.dryRun) return 0;
  const base=path.join(CFG.repoRoot,'src/content/artigos');
  async function walk(dir) {
    let out=[];
    for (const entry of await fs.readdir(dir,{withFileTypes:true})) {
      const p=path.join(dir,entry.name);
      if (entry.isDirectory()) out=out.concat(await walk(p));
      else if (/\.mdx?$/.test(entry.name)) out.push(p);
    }
    return out;
  }
  let files=[];
  try { files=await walk(base); } catch { return 0; }
  let indexed=0;
  for (const file of files) {
    const raw=await fs.readFile(file,'utf8');
    const fm=raw.match(/^---\s*\n([\s\S]*?)\n---/);
    const front=fm?.[1]||'';
    const pick=key=>front.match(new RegExp(`^${key}:\\s*["']?(.+?)["']?\\s*$`,'m'))?.[1]?.trim()||'';
    const rel=path.relative(CFG.repoRoot,file).replaceAll('\\','/');
    const title=pick('titulo')||path.basename(file).replace(/\.mdx?$/,'');
    const pillar=pick('pilar')||'';
    const summary=pick('descricao')||pick('resumo')||'';
    const body=raw.replace(/^---[\s\S]*?---/,'').replace(/\s+/g,' ').slice(0,7000);
    await d1(`INSERT INTO content_index (path,slug,title,pillar,summary,body_excerpt,fingerprint,updated_at) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(path) DO UPDATE SET title=excluded.title,pillar=excluded.pillar,summary=excluded.summary,body_excerpt=excluded.body_excerpt,fingerprint=excluded.fingerprint,updated_at=excluded.updated_at`,[
      rel,path.basename(file).replace(/\.mdx?$/,''),title,pillar,summary,body,sha(raw),nowIso()
    ]);
    indexed++;
  }
  return indexed;
}

async function backfillPublishedNews() {
  if (CFG.dryRun||!/^(1|true|yes)$/i.test(process.env.BACKFILL||'')) return 0;
  const base=path.join(CFG.repoRoot,'src/content/notas');
  async function walk(dir) {
    let out=[];
    for (const entry of await fs.readdir(dir,{withFileTypes:true})) {
      const p=path.join(dir,entry.name);
      if (entry.isDirectory()) out=out.concat(await walk(p));
      else if (/\.mdx?$/.test(entry.name)) out.push(p);
    }
    return out;
  }
  let files=[];
  try { files=await walk(base); } catch { return 0; }
  let processed=0;
  for (const file of files) {
    const raw=await fs.readFile(file,'utf8');
    const front=raw.match(/^---\s*\n([\s\S]*?)\n---/)?.[1]||'';
    const pick=key=>front.match(new RegExp(`^${key}:\\s*["']?(.+?)["']?\\s*$`,'m'))?.[1]?.trim()||'';
    const title=pick('titulo');
    if (!title) continue;
    const date=pick('data').slice(0,10)||'1970-01-01';
    const source=pick('fonte_nome');
    const url=pick('fonte_url');
    const pillar=pick('pilar')||'casa';
    const key=`legacy-${slugify(title)}-${date}`;
    const eventId=id('evt',key);
    const now=nowIso();
    await d1(`INSERT OR IGNORE INTO events (id,event_key,title,summary,pillar,event_date,legal_stage,entities_json,key_facts_json,news_score,seo_score,lead_score,first_seen_at,last_seen_at,published,published_url,status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,[
      eventId,key,title,'Notícia histórica importada do arquivo do Guia.',pillar,date,'na','[]','[]',100,0,0,now,now,1,null,'published'
    ]);
    if (url) await d1(`INSERT OR IGNORE INTO event_sources (event_id,source_name,article_url,published_at,source_type,is_primary,is_official) VALUES (?,?,?,?,?,?,?)`,[
      eventId,source||'Fonte histórica',url,date,'media',1,0
    ]);
    processed++;
  }
  return processed;
}

function titleTokens(value='') {
  return new Set(norm(value).split(' ').filter(word=>word.length>=4));
}
function tokenSimilarity(a,b) {
  const left=titleTokens(a),right=titleTokens(b);
  if (!left.size||!right.size) return 0;
  let intersection=0;
  for (const token of left) if (right.has(token)) intersection++;
  return intersection/Math.max(left.size,right.size);
}

async function historicalContext(candidate) {
  const words=norm(`${candidate.title} ${(candidate.entities||[]).join(' ')}`).split(' ').filter(word=>word.length>4).slice(0,6);
  if (!words.length) return [];
  const clauses=words.map(()=>'(lower(title) LIKE ? OR lower(summary) LIKE ? OR lower(entities_json) LIKE ?)').join(' OR ');
  const params=words.flatMap(word=>Array(3).fill(`%${word}%`));
  return d1(`SELECT id,event_key,parent_event_id,title,summary,pillar,event_date,legal_stage,entities_json,key_facts_json,news_score,seo_score,lead_score,published,published_url,make_sent_at FROM events WHERE ${clauses} ORDER BY event_date DESC LIMIT 16`,params);
}

async function classifyDuplicate(candidate,history) {
  if (!history.length) return {
    decision:'NOVO',
    duplicate_event_id:'',
    parent_event_id:'',
    event_key:slugify(`${candidate.title}-${candidate.event_date}`),
    reason:'sem histórico próximo'
  };

  const verySimilar=history.find(item=>item.event_date===candidate.event_date&&tokenSimilarity(item.title,candidate.title)>=0.82);
  if (verySimilar) return {
    decision:'DUPLICADO',
    duplicate_event_id:verySimilar.id,
    parent_event_id:'',
    event_key:verySimilar.event_key,
    reason:'título e data praticamente iguais'
  };

  const prompt=`És editor-chefe do Guia do Proprietário. O candidato já foi factual e deterministicamente filtrado. A tua única tarefa é deduplicação semântica.

CANDIDATO:
${JSON.stringify({
  title:candidate.title,
  summary:candidate.summary,
  event_date:candidate.event_date,
  pillar:candidate.pillar,
  legal_stage:candidate.legal_stage,
  entities:candidate.entities,
  key_facts:candidate.key_facts,
  article_url:candidate.article_url
})}

HISTÓRICO PRÓXIMO:
${JSON.stringify(history)}

DUPLICADO = mesmo acontecimento central, ainda que fonte ou título diferentes.
NOVO_MARCO = o mesmo processo teve mudança factual material de estado, por exemplo proposta -> aprovação -> publicação -> entrada em vigor.
NOVO = acontecimento diferente.
Não reescrevas factos, título, pilar ou scores.
Se decidires DUPLICADO, duplicate_event_id TEM DE ser exatamente o id do evento correspondente em HISTÓRICO PRÓXIMO e event_key TEM DE ser exatamente a event_key desse mesmo evento. Se não conseguires identificar um alvo exato, decide NOVO.

Devolve APENAS JSON:
{"decision":"NOVO|DUPLICADO|NOVO_MARCO","duplicate_event_id":"","parent_event_id":"","event_key":"slug-estavel-do-acontecimento","reason":""}`;

  for (let attempt=1;attempt<=2;attempt++) {
    try {
      const result=parseJson((await openai({
        model:CFG.openaiModelEditor,
        prompt,
        purpose:attempt===1?'editor_dedupe':'editor_dedupe_retry',
        web:false,
        effort:'medium'
      })).text);
      if (['NOVO','DUPLICADO','NOVO_MARCO'].includes(result.decision)) return result;
    } catch (error) {
      log({stage:'editor_dedupe_error',attempt,message:String(error.message||error).slice(0,300)});
    }
  }

  return {
    decision:'NOVO',
    duplicate_event_id:'',
    parent_event_id:'',
    event_key:slugify(`${candidate.title}-${candidate.event_date}`),
    reason:'fallback determinístico após resposta inválida'
  };
}

async function persistEvent(candidate,classification) {
  const eventKey=classification.event_key||slugify(`${candidate.title}-${candidate.event_date}`);
  const eventId=id('evt',eventKey);
  if (CFG.dryRun) return {eventId,eventKey};

  const now=nowIso();
  await d1(`INSERT INTO events (id,event_key,parent_event_id,title,summary,pillar,event_date,legal_stage,entities_json,key_facts_json,news_score,seo_score,lead_score,first_seen_at,last_seen_at,status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(event_key) DO UPDATE SET last_seen_at=excluded.last_seen_at, news_score=max(events.news_score,excluded.news_score), seo_score=max(events.seo_score,excluded.seo_score), lead_score=max(events.lead_score,excluded.lead_score)`,[
    eventId,eventKey,classification.parent_event_id||null,candidate.title,candidate.summary,classification.pillar,candidate.event_date,candidate.legal_stage||'na',
    JSON.stringify(candidate.entities||[]),JSON.stringify(candidate.key_facts||[]),classification.news_score||0,classification.seo_score||0,classification.lead_score||0,now,now,'accepted'
  ]);
  await d1(`INSERT OR IGNORE INTO event_sources (event_id,source_name,article_url,published_at,source_type,is_primary,is_official) VALUES (?,?,?,?,?,?,?)`,[
    eventId,candidate.source_name||'',candidate.article_url,candidate.source_published_at||candidate.event_date,candidate.source_type||'media',1,candidate.is_official?1:0
  ]);
  return {eventId,eventKey};
}

async function loadContentCandidates() {
  return d1(`SELECT path,slug,title,pillar,summary,body_excerpt FROM content_index`);
}

async function assessContentImpact(event,articles) {
  if (!articles.length) return [];
  const prompt=`Analisa se FACTOS NOVOS deste acontecimento tornam algum artigo evergreen do Guia do Proprietário desatualizado, contraditório ou materialmente incompleto. Não proponhas atualização só porque o tema é semelhante.

ACONTECIMENTO:
${JSON.stringify(event)}

ARTIGOS CANDIDATOS:
${JSON.stringify(articles)}

Regras jurídicas/fiscais: anúncio/proposta NÃO substitui regra em vigor. Pode justificar apenas nota de acompanhamento. Publicação/entrada em vigor pode exigir correção do corpo.

Devolve apenas JSON:
{"impacts":[{"article_path":"","impact_type":"NONE|ADDENDUM|PARTIAL_UPDATE|REWRITE|URGENT_CORRECTION","severity":"low|medium|high|critical","confidence":0,"old_claim":"","new_fact":"","recommendation":"","proposed_patch":""}]}`;
  try {
    const result=parseJson((await openai({
      model:CFG.openaiModelImpact,
      prompt,
      purpose:'content_impact',
      web:false,
      effort:'medium'
    })).text);
    return Array.isArray(result.impacts)?result.impacts:[];
  } catch (error) {
    log({stage:'content_impact_error',message:String(error.message||error).slice(0,300)});
    return [];
  }
}

async function persistImpact(eventId,impact) {
  if (CFG.dryRun||impact.impact_type==='NONE'||Number(impact.confidence||0)<CFG.minImpactConfidence) return false;
  await d1(`INSERT OR IGNORE INTO content_impacts (id,event_id,article_path,impact_type,severity,confidence,old_claim,new_fact,recommendation,proposed_patch,status,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,[
    id('imp',`${eventId}:${impact.article_path}`),eventId,impact.article_path,impact.impact_type,impact.severity,Number(impact.confidence||0),
    impact.old_claim||null,impact.new_fact||null,impact.recommendation||'',impact.proposed_patch||null,'proposed',nowIso()
  ]);
  return true;
}

async function generatePublication(event) {
  const prompt=`És a Redação do Guia do Proprietário, em Portugal. O EVENTO abaixo foi validado a partir do conteúdo real da fonte. Produz uma notícia útil e substancial para proprietários.

EVENTO VERIFICADO:
${JSON.stringify(event)}

REGRAS FACTUAIS
- Usa exclusivamente title, summary, key_facts, entities, event_date, source_name, source_description, source_excerpt e legal_stage presentes no EVENTO.
- Não acrescentes factos externos, direitos, obrigações, datas, prazos, números ou consequências que não estejam suportados.
- Mantém números, percentagens, datas e condições exatamente como aparecem na evidência.
- Anúncio/proposta/aprovação não são automaticamente regra em vigor.
- Quando a evidência não permite uma conclusão, diz apenas o que é possível afirmar sem preencher lacunas.
- Português de Portugal, tom jornalístico claro, humano e imparcial.

TEXTO FACEBOOK
- 4 a 6 frases, aproximadamente 70 a 120 palavras.
- Começa pelo que aconteceu e inclui 2 ou 3 factos úteis.
- Uma pergunta curta para comentário.
- Termina exatamente: Explicamos o essencial no link.
- Sem hashtags, emojis ou URL.

TEXTO SITE
- Markdown, normalmente 350 a 550 palavras.
- Não repetir o título no corpo.
- Abertura com 2 a 3 frases diretas.
- Secção obrigatória ## O essencial com 4 a 5 bullets factuais.
- Acrescenta pelo menos duas secções substantivas adequadas ao tema, por exemplo:
  ## O que está a mudar
  ## O que isto significa para os proprietários
  ## O que isto significa para os senhorios
  ## Em que ponto está
  ## O que acontece agora
- Só usa uma secção se houver evidência suficiente para a preencher.
- Sem H1 e sem HTML.
- Termina com ## Também pode interessar e exatamente 3 links internos escolhidos de:
  [Casa e obras](/casa/)
  [Vender casa](/vender/)
  [Arrendamento](/arrendar/)
  [Condomínio](/condominio/)
  [Impostos](/impostos/)
  [Calendário do proprietário](/calendario/)
  [Simuladores gratuitos](/simuladores/)

ORIENTAÇÃO VISUAL
- orientacao_ilustracao_segura com 1 a 2 frases curtas.
- Representa o assunto concreto através de 2 ou 3 elementos visuais reconhecíveis.
- Evita "casa bonita", "interior premium" ou arquitetura genérica se o tema permitir algo mais específico.
- Sem texto visível, números, logos, documentos legíveis, dramatização ou factos novos.

Devolve APENAS JSON:
{"texto_fb":"","texto_site":"","orientacao_ilustracao_segura":""}`;

  let firstDraft;
  try {
    firstDraft=parseJson((await openai({
      model:CFG.openaiModelCopy,
      prompt,
      purpose:'copy',
      web:false,
      effort:'medium'
    })).text);
    return finalizePublication({publishableNews:true,event,generated:firstDraft});
  } catch (error) {
    if (!(error instanceof PublicationQualityError)) {
      log({stage:'publication_generation_error',title:event.title||'',message:String(error.message||error).slice(0,300)});
      return null;
    }

    log({stage:'publication_quality_repair',title:event.title||'',reasons:error.reasons});
    const repairPrompt=`Corrige UMA única vez o draft abaixo. Usa exclusivamente o EVENTO VERIFICADO e não inventes factos.

EVENTO VERIFICADO:
${JSON.stringify(event)}

DRAFT:
${JSON.stringify(firstDraft)}

FALHAS:
${JSON.stringify(error.reasons)}

Regras:
- texto_site 350 a 550 palavras sempre que a evidência o permita, mínimo 300 e máximo 700;
- ## O essencial com pelo menos 4 bullets;
- pelo menos duas secções substantivas além de O essencial e Também pode interessar;
- exatamente 3 links internos permitidos no fim;
- texto_fb 70 a 120 palavras e termina exatamente: Explicamos o essencial no link.
- proposta/anúncio não são lei em vigor;
- não uses factos fora do EVENTO;
- orientacao_ilustracao_segura curta, concreta e sem texto/números/logos.

Devolve APENAS JSON:
{"texto_fb":"","texto_site":"","orientacao_ilustracao_segura":""}`;

    try {
      const repaired=parseJson((await openai({
        model:CFG.openaiModelCopy,
        prompt:repairPrompt,
        purpose:'copy_quality_repair',
        web:false,
        effort:'medium'
      })).text);
      return finalizePublication({publishableNews:true,event,generated:repaired});
    } catch (repairError) {
      log({
        stage:'publication_quality_rejected',
        title:event.title||'',
        reasons:repairError instanceof PublicationQualityError?repairError.reasons:[String(repairError.message||repairError).slice(0,300)]
      });
      return null;
    }
  }
}

async function sendMake(payload) {
  if (CFG.dryRun||!CFG.makeWebhook) return false;
  const headers={'Content-Type':'application/json'};
  if (CFG.makeWebhookSecret) headers['x-make-apikey']=CFG.makeWebhookSecret;
  const res=await fetch(CFG.makeWebhook,{method:'POST',headers,body:JSON.stringify(payload)});
  if (!res.ok) throw new Error(`Make webhook ${res.status}: ${(await res.text()).slice(0,500)}`);
  stats.make_sends++;
  return true;
}

async function viralStateForEvent(eventId) {
  const events=await d1(`SELECT id,event_key,title,summary,pillar,news_score,make_sent_at FROM events WHERE id=? LIMIT 1`,[eventId]);
  if (!events.length) return null;
  const sources=await d1(`SELECT source_name,article_url,published_at,is_official FROM event_sources WHERE event_id=? ORDER BY published_at ASC`,[eventId]);
  const viral=evaluateViralPriority(events[0],sources,new Date());
  return {event:events[0],viral};
}

async function maybeSendViralPriority(eventId) {
  if (CFG.dryRun) return false;
  const state=await viralStateForEvent(eventId);
  if (!state || state.viral.status!=='viral') return false;

  const prior=await d1(`SELECT event_id,notified_at FROM viral_alerts WHERE event_id=? LIMIT 1`,[eventId]);
  if (prior[0]?.notified_at) return false;

  const detectedAt=state.viral.detected_at||nowIso();
  await d1(`INSERT INTO viral_alerts (event_id,viral_score,source_count,span_minutes,detected_at,notified_at)
    VALUES (?,?,?,?,?,NULL)
    ON CONFLICT(event_id) DO UPDATE SET viral_score=excluded.viral_score,source_count=excluded.source_count,span_minutes=excluded.span_minutes,detected_at=excluded.detected_at`,[
    eventId,state.viral.viral_score,state.viral.source_count,state.viral.span_minutes,detectedAt
  ]);

  const payload={
    type:'viral_priority',
    event_id:state.event.id,
    event_key:state.event.event_key,
    titulo_noticia:state.event.title,
    pilar:state.event.pillar,
    conteudo_verificado:state.event.summary||'',
    news_score:Number(state.event.news_score||0),
    viral_status:'viral',
    viral_score:state.viral.viral_score,
    viral_source_count:state.viral.source_count,
    viral_span_minutes:state.viral.span_minutes,
    viral_detected_at:detectedAt,
    viral_sources:state.viral.sources,
    estado:'viral'
  };

  try {
    const sent=await sendMake(payload);
    if (!sent) return false;
    await d1(`UPDATE viral_alerts SET notified_at=? WHERE event_id=?`,[nowIso(),eventId]);
    stats.viral_alerts++;
    log({stage:'viral_priority_sent',event_id:eventId,viral_score:state.viral.viral_score,source_count:state.viral.source_count,span_minutes:state.viral.span_minutes,base_news_sent:Boolean(state.event.make_sent_at)});
    return true;
  } catch (error) {
    log({stage:'viral_priority_send_failed',event_id:eventId,message:String(error?.message||error).slice(0,400)});
    return false;
  }
}

async function main() {
  await initSchema();
  const indexedContent=await indexContent();
  const backfilledNews=await backfillPublishedNews();
  log({stage:'startup',version:'22.0',mode:CFG.mode,dry_run:CFG.dryRun,indexed_content:indexedContent,backfilled_news:backfilledNews});

  const runId=id('run',`${nowIso()}:${CFG.mode}:v22`);
  if (!CFG.dryRun) await d1(`INSERT INTO radar_runs (id,started_at,mode,status) VALUES (?,?,?,?)`,[runId,nowIso(),CFG.mode,'running']);

  try {
    const candidates=await discoverCandidates();
    let contentArticles=null;

    for (const candidate of candidates) {
      if (!candidate.article_url) continue;

      const existingUrl=await d1(`SELECT e.id,e.event_key,e.published,e.news_score,e.seo_score,e.lead_score FROM event_sources s JOIN events e ON e.id=s.event_id WHERE s.article_url=? LIMIT 1`,[candidate.article_url]);
      if (existingUrl.length) {
        stats.duplicates++;
        const existing=existingUrl[0];
        const rescored=applyDeterministicEditorialScores(candidate,{
          decision:'DUPLICADO',
          verified_title:candidate.title,
          verified_summary:candidate.summary,
          legal_stage:candidate.legal_stage
        });
        const legacyUpgrade=shouldUpgradeLegacyPublication(existing,rescored,CFG.minNewsScore);

        if (legacyUpgrade) {
          const legacyEvent={
            ...candidate,
            ...rescored,
            event_id:existing.id,
            event_key:existing.event_key,
            title:candidate.title,
            summary:candidate.summary,
            legal_stage:candidate.legal_stage
          };
          const evidence=publicationEvidenceStatus(legacyEvent);
          let publication=null;
          if (evidence.ready) publication=await generatePublication(legacyEvent);

          if (publication) {
            const payload={
              type:'noticia',
              event_id:existing.id,
              event_key:existing.event_key,
              titulo_noticia:candidate.title,
              pilar:rescored.pillar,
              legal_stage:candidate.legal_stage||'na',
              fonte_nome:candidate.source_name||'',
              url_original:candidate.article_url,
              data_publicacao:candidate.event_date,
              conteudo_verificado:candidate.summary,
              texto_fb:publication.texto_fb,
              texto_site:publication.texto_site,
              prompt_imagem:publication.prompt_imagem,
              prompt_tecnico:publication.prompt_tecnico,
              news_score:rescored.news_score||0,
              seo_score:rescored.seo_score||0,
              lead_score:rescored.lead_score||0,
              tipo_evento:'NOVO',
              seo_trigger:Number(rescored.seo_score||0)>=80?'Sim':'Nao',
              lead_trigger:Number(rescored.lead_score||0)>=80?'Sim':'Nao',
              impacto_conteudo:'NONE',
              estado:'novo',
              content_impacts:[]
            };
            if (CFG.dryRun) log({stage:'legacy_upgrade_dry_run',event_id:existing.id,old_news_score:Number(existing.news_score||0),new_news_score:rescored.news_score,texto_site_chars:publication.texto_site.length});
            const sent=await sendMake(payload);
            if (CFG.dryRun) {
              stats.publication_ready++;
            } else if (sent) {
              stats.publication_ready++;
              await d1(`UPDATE events SET title=?,summary=?,pillar=?,event_date=?,legal_stage=?,entities_json=?,key_facts_json=?,news_score=?,seo_score=?,lead_score=?,last_seen_at=?,make_sent_at=?,status='candidate' WHERE id=?`,[
                candidate.title,candidate.summary,rescored.pillar,candidate.event_date,candidate.legal_stage||'na',
                JSON.stringify(candidate.entities||[]),JSON.stringify(candidate.key_facts||[]),rescored.news_score,rescored.seo_score,rescored.lead_score,
                nowIso(),nowIso(),existing.id
              ]);
              log({stage:'legacy_upgrade_sent',event_id:existing.id,event_key:existing.event_key,old_news_score:Number(existing.news_score||0),new_news_score:rescored.news_score});
            }
          } else {
            stats.publication_quality_rejected++;
            log({stage:'legacy_upgrade_blocked',event_id:existing.id,reasons:evidence.ready?['publication_quality_rejected']:evidence.reasons});
          }
        } else {
          log({stage:'duplicate_url',article_url:candidate.article_url,event_id:existing.id,old_news_score:Number(existing.news_score||0),new_news_score:rescored.news_score});
        }
        continue;
      }

      const history=await historicalContext(candidate);
      const duplicateDecision=await classifyDuplicate(candidate,history);
      if (duplicateDecision.decision==='DUPLICADO') {
        stats.duplicates++;
        const target=resolveDuplicateTarget(history,duplicateDecision);
        const rescored=applyDeterministicEditorialScores(candidate,{
          ...duplicateDecision,
          verified_title:candidate.title,
          verified_summary:candidate.summary,
          legal_stage:candidate.legal_stage
        });

        if (!target) {
          log({stage:'duplicate_semantic_target_unresolved',title:candidate.title,duplicate_event_id:duplicateDecision.duplicate_event_id||'',event_key:duplicateDecision.event_key||'',reason:duplicateDecision.reason||''});
          continue;
        }

        const legacyUpgrade=shouldUpgradeLegacyPublication(target,rescored,CFG.minNewsScore);
        if (legacyUpgrade) {
          const legacyEvent={
            ...candidate,
            ...rescored,
            event_id:target.id,
            event_key:target.event_key,
            title:candidate.title,
            summary:candidate.summary,
            legal_stage:candidate.legal_stage
          };
          const evidence=publicationEvidenceStatus(legacyEvent);
          let publication=null;
          if (evidence.ready) publication=await generatePublication(legacyEvent);

          if (publication) {
            const payload={
              type:'noticia',
              event_id:target.id,
              event_key:target.event_key,
              titulo_noticia:candidate.title,
              pilar:rescored.pillar,
              legal_stage:candidate.legal_stage||'na',
              fonte_nome:candidate.source_name||'',
              url_original:candidate.article_url,
              data_publicacao:candidate.event_date,
              conteudo_verificado:candidate.summary,
              texto_fb:publication.texto_fb,
              texto_site:publication.texto_site,
              prompt_imagem:publication.prompt_imagem,
              prompt_tecnico:publication.prompt_tecnico,
              news_score:rescored.news_score||0,
              seo_score:rescored.seo_score||0,
              lead_score:rescored.lead_score||0,
              tipo_evento:'NOVO',
              seo_trigger:Number(rescored.seo_score||0)>=80?'Sim':'Nao',
              lead_trigger:Number(rescored.lead_score||0)>=80?'Sim':'Nao',
              impacto_conteudo:'NONE',
              estado:'novo',
              content_impacts:[]
            };

            if (CFG.dryRun) {
              stats.publication_ready++;
              log({stage:'semantic_legacy_upgrade_dry_run',event_id:target.id,event_key:target.event_key,source_url:candidate.article_url,old_news_score:Number(target.news_score||0),new_news_score:rescored.news_score,texto_site_chars:publication.texto_site.length});
            } else {
              const sent=await sendMake(payload);
              if (sent) {
                stats.publication_ready++;
                await d1(`UPDATE events SET title=?,summary=?,pillar=?,event_date=?,legal_stage=?,entities_json=?,key_facts_json=?,news_score=?,seo_score=?,lead_score=?,last_seen_at=?,make_sent_at=?,status='candidate' WHERE id=?`,[
                  candidate.title,candidate.summary,rescored.pillar,candidate.event_date,candidate.legal_stage||'na',
                  JSON.stringify(candidate.entities||[]),JSON.stringify(candidate.key_facts||[]),rescored.news_score,rescored.seo_score,rescored.lead_score,
                  nowIso(),nowIso(),target.id
                ]);
                await d1(`INSERT OR IGNORE INTO event_sources (event_id,source_name,article_url,published_at,source_type,is_primary,is_official) VALUES (?,?,?,?,?,?,?)`,[
                  target.id,candidate.source_name||'',candidate.article_url,candidate.source_published_at||candidate.event_date,candidate.source_type||'media',0,candidate.is_official?1:0
                ]);
                log({stage:'semantic_legacy_upgrade_sent',event_id:target.id,event_key:target.event_key,source_url:candidate.article_url,old_news_score:Number(target.news_score||0),new_news_score:rescored.news_score});
              }
            }
          } else {
            stats.publication_quality_rejected++;
            log({stage:'semantic_legacy_upgrade_blocked',event_id:target.id,event_key:target.event_key,reasons:evidence.ready?['publication_quality_rejected']:evidence.reasons});
          }
        } else {
          if (!CFG.dryRun) {
            await d1(`INSERT OR IGNORE INTO event_sources (event_id,source_name,article_url,published_at,source_type,is_primary,is_official) VALUES (?,?,?,?,?,?,?)`,[
              target.id,candidate.source_name||'',candidate.article_url,candidate.source_published_at||candidate.event_date,candidate.source_type||'media',0,candidate.is_official?1:0
            ]);
            await d1(`UPDATE events SET last_seen_at=? WHERE id=?`,[nowIso(),target.id]);
          }
          log({stage:'duplicate_semantic',title:candidate.title,target_event_id:target.id,target_event_key:target.event_key,old_news_score:Number(target.news_score||0),new_news_score:rescored.news_score,reason:duplicateDecision.reason||''});
        }
        if (!CFG.dryRun) {
          await d1(`INSERT OR IGNORE INTO event_sources (event_id,source_name,article_url,published_at,source_type,is_primary,is_official) VALUES (?,?,?,?,?,?,?)`,[
            target.id,candidate.source_name||'',candidate.article_url,candidate.source_published_at||candidate.event_date,candidate.source_type||'media',0,candidate.is_official?1:0
          ]);
          await d1(`UPDATE events SET last_seen_at=?,news_score=max(news_score,?) WHERE id=?`,[nowIso(),Number(rescored.news_score||0),target.id]);
          await maybeSendViralPriority(target.id);
        }
        continue;
      }

      const classification=applyDeterministicEditorialScores(candidate,{
        ...duplicateDecision,
        verified_title:candidate.title,
        verified_summary:candidate.summary,
        legal_stage:candidate.legal_stage
      });

      log({
        stage:'editorial_scores',
        title:candidate.source_title||candidate.title||'',
        scoring_version:classification.scoring_version,
        pilar:classification.pillar,
        news_score:classification.news_score,
        seo_score:classification.seo_score,
        lead_score:classification.lead_score,
        signals:classification.scoring_signals
      });

      const {eventId,eventKey}=await persistEvent(candidate,classification);
      stats.events_created++;

      const event={
        ...candidate,
        ...classification,
        event_id:eventId,
        event_key:eventKey,
        title:candidate.title,
        summary:candidate.summary,
        legal_stage:candidate.legal_stage
      };

      let impacts=[];
      if (shouldAssessContentImpact(classification,{minNewsScore:CFG.minNewsScore,minSeoScore:80,minLeadScore:80})) {
        const articles=contentArticles??=await loadContentCandidates();
        const impactPrefilter=prefilterContentImpact(event,articles);
        log({
          stage:'content_impact_prefilter',
          event_key:eventKey,
          articles_considered:impactPrefilter.articlesConsidered,
          matches:impactPrefilter.matches,
          sent_to_model:impactPrefilter.selected.length,
          top_scores:impactPrefilter.topScores
        });
        impacts=impactPrefilter.selected.length?await assessContentImpact(event,impactPrefilter.selected):[];
        for (const impact of impacts) await persistImpact(eventId,impact);
      } else {
        log({stage:'content_impact_skipped',event_key:eventKey,reason:'scores_below_threshold'});
      }

      const qualifyingImpacts=impacts.filter(impact=>impact.impact_type!=='NONE'&&Number(impact.confidence||0)>=CFG.minImpactConfidence);
      const impactRank={NONE:0,ADDENDUM:1,PARTIAL_UPDATE:2,REWRITE:3,URGENT_CORRECTION:4};
      const strongestImpact=qualifyingImpacts.reduce((best,item)=>{
        if (!best) return item;
        return (impactRank[item.impact_type]||0)>(impactRank[best.impact_type]||0)?item:best;
      },null);

      const scoreQualified=isPublishableNews(classification.news_score,CFG.minNewsScore);
      const evidence=publicationEvidenceStatus(event);
      let publication=null;
      if (scoreQualified&&evidence.ready) {
        publication=await generatePublication(event);
        if (publication) stats.publication_ready++;
        else stats.publication_quality_rejected++;
      } else if (scoreQualified) {
        stats.publication_not_ready++;
        log({stage:'publication_not_ready',event_key:eventKey,reasons:evidence.reasons,facts_count:evidence.facts_count,summary_chars:evidence.summary_chars});
      }

      const isNews=Boolean(publication);
      const payload={
        type:isNews?'noticia':'radar',
        event_id:eventId,
        event_key:eventKey,
        titulo_noticia:candidate.title,
        pilar:classification.pillar,
        legal_stage:candidate.legal_stage||'na',
        fonte_nome:candidate.source_name||'',
        url_original:candidate.article_url,
        data_publicacao:candidate.event_date,
        conteudo_verificado:candidate.summary,
        texto_fb:publication?.texto_fb||'',
        texto_site:publication?.texto_site||'',
        prompt_imagem:publication?.prompt_imagem||'',
        prompt_tecnico:publication?.prompt_tecnico||'',
        news_score:classification.news_score||0,
        seo_score:classification.seo_score||0,
        lead_score:classification.lead_score||0,
        tipo_evento:duplicateDecision.decision,
        seo_trigger:Number(classification.seo_score||0)>=80?'Sim':'Nao',
        lead_trigger:Number(classification.lead_score||0)>=80?'Sim':'Nao',
        impacto_conteudo:strongestImpact?.impact_type||'NONE',
        estado:duplicateDecision.decision==='NOVO_MARCO'?'novo_marco':'novo',
        content_impacts:qualifyingImpacts
      };

      if (CFG.dryRun) log({stage:'dry_run_payload',...payload,texto_site:publication?`[${publication.texto_site.length} chars]`:'',prompt_imagem:publication?'[generated]':''});
      const sent=await sendMake(payload);
      if (sent&&!CFG.dryRun) await d1(`UPDATE events SET make_sent_at=? WHERE id=?`,[nowIso(),eventId]);
    }

    if (!CFG.dryRun) {
      await d1(`UPDATE radar_runs SET finished_at=?,status='ok',candidates_found=?,events_created=?,duplicates_discarded=? WHERE id=?`,[
        nowIso(),stats.prefiltered,stats.events_created,stats.duplicates,runId
      ]);
    }

    log({ok:true,version:'22.0',runId,...stats,dryRun:CFG.dryRun});
  } catch (error) {
    if (error instanceof BudgetGuardStop) {
      log({ok:true,version:'22.0',runId,status:'budget_guard',...stats,dryRun:CFG.dryRun});
      return;
    }
    if (!CFG.dryRun) {
      await d1(`UPDATE radar_runs SET finished_at=?,status='error',notes=? WHERE id=?`,[
        nowIso(),String(error.stack||error).slice(0,4000),runId
      ]).catch(()=>{});
    }
    throw error;
  } finally {
    log({stage:'usage_summary',...usageTotals});
  }
}

await main();
