import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {inspectSourceUrl} from './source-metadata.mjs';
import {harvestDirectSources,prefilterHarvestSources} from './source-harvest.mjs';
import {prefilterContentImpact} from './content-impact-prefilter.mjs';
import {getDiscoveryModePlan} from './discovery-mode.mjs';

const REQUIRED = ['OPENAI_API_KEY','CF_ACCOUNT_ID','CF_D1_DATABASE_ID','CF_D1_API_TOKEN'];
for (const key of REQUIRED) if (!process.env[key]) throw new Error(`Missing secret: ${key}`);

const CFG = {
  openaiModelSearcher: process.env.OPENAI_SEARCHER_MODEL || 'gpt-5.6-luna',
  openaiModelValidator: process.env.OPENAI_VALIDATOR_MODEL || 'gpt-5.6-luna',
  openaiModelEditor: process.env.OPENAI_EDITOR_MODEL || 'gpt-5.6-sol',
  openaiModelImpact: process.env.OPENAI_IMPACT_MODEL || 'gpt-5.6-terra',
  openaiModelCopy: process.env.OPENAI_COPY_MODEL || 'gpt-5.6-luna',
  makeWebhook: process.env.MAKE_RADAR_WEBHOOK || '',
  makeWebhookSecret: process.env.MAKE_RADAR_WEBHOOK_SECRET || '',
  repoRoot: process.env.GITHUB_WORKSPACE || process.cwd(),
  mode: process.env.RADAR_MODE || 'incremental',
  minNewsScore: Number(process.env.MIN_NEWS_SCORE || 80),
  minImpactConfidence: Number(process.env.MIN_IMPACT_CONFIDENCE || 80),
  dryRun: /^(1|true|yes)$/i.test(process.env.RADAR_DRY_RUN || ''),
  maxRunTokens: Math.max(0,Number(process.env.MAX_RUN_TOKENS || 0)||0),
};

const usageTotals = {calls:0,input_tokens:0,output_tokens:0,total_tokens:0,web_search_calls:0};
const contentImpactTotals = {events_checked:0,model_calls:0,skipped:0,impacts_found:0};
const validatorTerraFallback = {used:false};
class BudgetGuardStop extends Error {}

const nowIso = () => new Date().toISOString();
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const norm = (s='') => s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const slugify = (s='') => norm(s).replace(/\s+/g,'-').slice(0,120);
const id = (prefix, value) => `${prefix}_${sha(value).slice(0,20)}`;

function logUsageSummary() {
  console.log(JSON.stringify({stage:'usage_summary',...usageTotals}));
}

async function openai({model, prompt, purpose, web=false, effort='low', allowedDomains=[], searchContextSize='medium'}) {
  if (CFG.maxRunTokens > 0 && usageTotals.total_tokens >= CFG.maxRunTokens) {
    console.log(JSON.stringify({
      stage:'budget_guard',
      reason:'max_run_tokens',
      tokens_used:usageTotals.total_tokens,
      limit:CFG.maxRunTokens
    }));
    throw new BudgetGuardStop('Maximum run token budget reached');
  }
  const body = { model, input: prompt, reasoning: { effort } };
  if (web) {
    const webSearch = {
      type: 'web_search',
      search_context_size: searchContextSize,
      user_location: {
        type: 'approximate',
        country: 'PT',
        city: 'Lisbon',
        timezone: 'Europe/Lisbon'
      }
    };
    if (allowedDomains.length) webSearch.filters = { allowed_domains: allowedDomains };
    body.tools = [webSearch];
    body.tool_choice = 'required';
    body.include = ['web_search_call.action.sources'];
  }
  const res = await fetch('https://api.openai.com/v1/responses', {
    method:'POST',
    headers:{'Authorization':`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},
    body:JSON.stringify(body)
  });
  const raw = await res.text();
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${raw.slice(0,1000)}`);
  const data = JSON.parse(raw);
  const text = data.output_text || (data.output || []).flatMap(x => x.content || []).map(c => c.text || '').join('\n');
  const usage=data.usage || {};
  const inputTokens=Number(usage.input_tokens || 0);
  const outputTokens=Number(usage.output_tokens || 0);
  const totalTokens=Number(usage.total_tokens ?? (inputTokens+outputTokens));
  const webSearchCalls=(data.output || []).filter(item => item.type === 'web_search_call').length;
  usageTotals.calls++;
  usageTotals.input_tokens+=inputTokens;
  usageTotals.output_tokens+=outputTokens;
  usageTotals.total_tokens+=totalTokens;
  usageTotals.web_search_calls+=webSearchCalls;
  console.log(JSON.stringify({
    stage:'openai_usage',purpose,model,
    input_tokens:inputTokens,
    output_tokens:outputTokens,
    total_tokens:totalTokens,
    web_search_calls:webSearchCalls
  }));
  return {text, usage:data.usage, raw:data};
}

function parseJson(text) {
  const t = text.trim().replace(/^```json\s*/i,'').replace(/```$/,'').trim();
  try { return JSON.parse(t); } catch {}
  const a = t.indexOf('{'), b=t.lastIndexOf('}');
  if (a>=0 && b>a) return JSON.parse(t.slice(a,b+1));
  throw new Error(`Model did not return valid JSON: ${t.slice(0,500)}`);
}

async function d1(sql, params=[]) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${process.env.CF_ACCOUNT_ID}/d1/database/${process.env.CF_D1_DATABASE_ID}/query`;
  const res = await fetch(url,{method:'POST',headers:{Authorization:`Bearer ${process.env.CF_D1_API_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify({sql,params})});
  const data = await res.json();
  if (!res.ok || !data.success || data.errors?.length) throw new Error(`D1 query failed: ${JSON.stringify(data.errors || data).slice(0,1200)}`);
  return data.result?.[0]?.results || [];
}

async function initSchema() {
  const sqlPath = path.join(CFG.repoRoot,'automation/editorial-radar/schema.sql');
  const sql = await fs.readFile(sqlPath,'utf8');
  const statements = sql.split(/;\s*(?:\n|$)/).map(s=>s.trim()).filter(Boolean).filter(s=>!s.startsWith('PRAGMA'));
  for (const statement of statements) await d1(statement);
}

const MEDIA_DOMAIN_GROUPS = [
  ['cnnportugal.iol.pt','rtp.pt','jn.pt','sicnoticias.pt','publico.pt'],
  ['eco.sapo.pt','jornaleconomico.sapo.pt','jornaldenegocios.pt','dinheirovivo.dn.pt','dn.pt','rr.pt'],
  ['idealista.pt','executivedigest.sapo.pt','expresso.pt','observador.pt','noticiasaominuto.com']
];
const OFFICIAL_DOMAINS = [
  'diariodarepublica.pt','gov.pt','parlamento.pt','ine.pt','bportugal.pt','portaldasfinancas.gov.pt','adene.pt'
];

const thematicSweeps = [
  {name:'legislacao_fiscalidade',topic:'legislação impostos habitação proprietários Portugal'},
  {name:'condominio_vizinhos',topic:'condomínios administradores vizinhos Portugal'},
  {name:'arrendamento',topic:'arrendamento senhorios rendas Portugal'},
  {name:'mercado_credito',topic:'mercado habitação preços moradias crédito Euribor Portugal'},
  {name:'casa_energia_obras',topic:'obras energia casa eficiência Portugal'},
  {name:'herancas_propriedade',topic:'heranças imóveis propriedade Portugal'}
];
const sourceSweeps = [
  {name:'fontes_media_a',type:'media',topic:'habitação casas proprietários arrendamento condomínios impostos crédito obras Portugal',allowedDomains:MEDIA_DOMAIN_GROUPS[0]},
  {name:'fontes_media_b',type:'media',topic:'habitação casas proprietários arrendamento condomínios impostos crédito obras Portugal',allowedDomains:MEDIA_DOMAIN_GROUPS[1]},
  {name:'fontes_media_c',type:'media',topic:'habitação casas proprietários arrendamento condomínios impostos crédito obras Portugal',allowedDomains:MEDIA_DOMAIN_GROUPS[2]},
  {name:'fontes_oficiais',type:'official',topic:'habitação proprietários imóveis arrendamento impostos crédito energia Portugal',allowedDomains:OFFICIAL_DOMAINS}
];
const omissionSweep = {
  name:'omissoes_editor_chefe',
  type:'omission',
  topic:'notícias mais importantes das últimas 36 horas em Portugal para alguém que possui uma casa, mesmo fora das categorias habituais'
};
const directSourceSeeds = [
  {name:'CNN Portugal',slug:'cnn_portugal',url:'https://cnnportugal.iol.pt/',allowedDomains:['cnnportugal.iol.pt']},
  {name:'RTP Economia',slug:'rtp_economia',url:'https://www.rtp.pt/noticias/economia',allowedDomains:['rtp.pt'],section:true},
  {name:'ECO',slug:'eco',url:'https://eco.sapo.pt/',allowedDomains:['eco.sapo.pt']},
  {name:'Dinheiro Vivo Imobiliário',slug:'dinheiro_vivo_imobiliario',url:'https://dinheirovivo.dn.pt/imobiliario',allowedDomains:['dinheirovivo.dn.pt'],section:true},
  {name:'Idealista News Portugal',slug:'idealista_news_portugal',url:'https://www.idealista.pt/news/',allowedDomains:['idealista.pt'],section:true},
  {name:'Jornal Económico',slug:'jornal_economico',url:'https://jornaleconomico.sapo.pt/',allowedDomains:['jornaleconomico.sapo.pt']}
];

function lisbonDateTime(date) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Lisbon',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date).filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
  return `${parts.day}-${parts.month}-${parts.year} ${parts.hour}:${parts.minute}`;
}

function searcherPrompt(topic, currentTime, sweepType='thematic') {
  const windowHours=sweepType==='official' ? 72 : 36;
  const window={
    start:lisbonDateTime(new Date(currentTime.getTime() - windowHours * 60 * 60 * 1000)),
    end:lisbonDateTime(currentTime)
  };
  const prompt=`Pesquisa amplamente na web portuguesa notícias recentes relacionadas com ${topic}. Agora são ${window.end} em Portugal. Procura prioritariamente páginas PUBLICADAS entre ${window.start} e ${window.end}. Não cites artigos antigos apenas porque são muito relevantes para o tema. Se encontrares menos resultados dentro da janela, devolve menos resultados em vez de preencher com notícias antigas.\n\nCombina uma pesquisa geral pelo tema, pelo menos uma pesquisa orientada a hoje e pelo menos uma pesquisa orientada a ontem, usando as datas portuguesas atuais em linguagem natural quando for útil. Não uses after:, before:, site:pt ou cadeias extensas de OR. Não obrigues todas as pesquisas a conter uma data.\n\nApresenta até 10 resultados. Para cada resultado indica título, fonte, data se disponível e uma frase sobre o assunto. Cita cada resultado com a respetiva fonte web. Não faças ainda avaliação editorial.`;
  return {prompt,window};
}

function canonicalUrl(value) {
  try {
    const url=new URL(value);
    url.hash='';
    url.hostname=url.hostname.toLowerCase();
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_|fbclid$|gclid$|mc_cid$|mc_eid$)/i.test(key)) url.searchParams.delete(key);
    }
    url.pathname=url.pathname.replace(/\/+$/,'') || '/';
    return url.toString();
  } catch { return ''; }
}

function extractSearchResults(output, sweep, {limit=10,allowSourcesFallback=true}={}) {
  const collect=(entries) => {
    const byUrl=new Map();
    for (const entry of entries) {
      const {urlValue,title=''}=entry;
      const url=canonicalUrl(urlValue);
      if (!url || byUrl.has(url)) continue;
      byUrl.set(url,{url,title,source_domain:new URL(url).hostname,sweep});
      if (byUrl.size === limit) break;
    }
    return [...byUrl.values()];
  };
  const citations=[];
  for (const item of output || []) {
    for (const content of item.content || []) {
      for (const annotation of content.annotations || []) {
        if (annotation.type !== 'url_citation') continue;
        const citation=annotation.url_citation || annotation;
        citations.push({urlValue:citation.url,title:citation.title});
      }
    }
  }
  const citedResults=collect(citations);
  if (citedResults.length) return {results:citedResults,citedCount:citedResults.length};
  if (!allowSourcesFallback) return {results:[],citedCount:0};

  const fallbackSources=[];
  for (const item of output || []) {
    if (item.type !== 'web_search_call') continue;
    for (const source of Array.isArray(item.action?.sources) ? item.action.sources : []) {
      if (typeof source === 'string') fallbackSources.push({urlValue:source});
      else fallbackSources.push({urlValue:source?.url,title:source?.title});
    }
  }
  return {results:collect(fallbackSources),citedCount:0};
}

async function searchSweep({name,topic,type='thematic',allowedDomains=[]}, currentTime) {
  const {prompt,window}=searcherPrompt(topic,currentTime,type);
  const response=await openai({model:CFG.openaiModelSearcher,prompt,purpose:'searcher',web:true,effort:'low',allowedDomains,searchContextSize:'medium'});
  const {results,citedCount}=extractSearchResults(response.raw.output,name);
  if (CFG.dryRun) {
    console.log(JSON.stringify({
      stage:'searcher',
      sweep:name,
      window_start:window.start,
      window_end:window.end,
      urls_found:results.length,
      titles:results.map(result => result.title).filter(Boolean).slice(0,10)
    }));
  }
  return {results,citedCount};
}

async function freshnessRescue(currentTime, processedUrls) {
  const window={
    start:lisbonDateTime(new Date(currentTime.getTime() - 36 * 60 * 60 * 1000)),
    end:lisbonDateTime(currentTime)
  };
  const prompt=`Procura apenas notícias publicadas hoje ou ontem em Portugal que possam ser úteis para alguém que possui uma casa. Dá prioridade a legislação, condomínios, arrendamento, preços das casas, venda, crédito habitação, Euribor, impostos, obras, energia e direitos de propriedade. Agora são ${window.end} em Portugal e a janela começa em ${window.start}. Não cites páginas anteriores à janela indicada. Apresenta até 12 resultados, com título, fonte, data e uma frase factual. Cita cada resultado com a respetiva fonte web.`;
  const response=await openai({model:CFG.openaiModelSearcher,prompt,purpose:'freshness_rescue',web:true,effort:'low',searchContextSize:'high'});
  const {results}=extractSearchResults(response.raw.output,'freshness_rescue',{limit:12,allowSourcesFallback:false});
  const freshResults=results.filter(result => !processedUrls.has(canonicalUrl(result.url)));
  if (CFG.dryRun) {
    console.log(JSON.stringify({
      stage:'freshness_rescue',
      urls_found:freshResults.length,
      titles:freshResults.map(result => result.title).filter(Boolean).slice(0,12)
    }));
  }
  return freshResults;
}

function validatorPrompt(sources, window) {
  return `És o Validador factual do discovery do Guia do Proprietário. Não decides importância editorial nem atribuis scores. Verifica e enriquece cada URL de input.\n\nVerifica apenas os URLs fornecidos. Podes abrir ou pesquisar informação necessária para validar essas páginas, mas article_url no output tem obrigatoriamente de ser exatamente um dos URLs de input.\n\nAGORA EM PORTUGAL: ${window.end}\n\nURLS DE INPUT:\n${JSON.stringify(sources)}\n\nCada URL inclui verified_published_at e verified_title determinados antes desta chamada. A data de publicação fornecida é factual e já foi validada pelo sistema. Não a alteres nem infiras outra data. Copia para event_date apenas o dia de verified_published_at.\n\nPara cada URL confirma: se é notícia ou artigo concreto e não página genérica; título; fonte; resumo factual; entidades; factos principais; ligação a Portugal; relação potencial com proprietários de imóveis; fase jurídica quando aplicável. article_type e probable_article são apenas sinais auxiliares, não substituem o teu julgamento factual.\n\nRejeita apenas páginas de categoria, home ou pesquisa; classificados; publicidade evidente; URL inacessível sem informação suficiente; conteúdo claramente fora do âmbito imobiliário ou dos proprietários. Não apliques um teste exigente de importância editorial. Se houver dúvida razoável, preserva o candidato para o Editor-chefe.\n\nDevolve APENAS JSON válido:\n{"candidates":[{"title":"","summary":"","event_date":"YYYY-MM-DD","pillar":"vender|impostos|arrendar|condominio|casa","legal_stage":"na|anuncio|proposta|aprovacao|publicacao|entrada_em_vigor|alteracao|revogacao","entities":[""],"key_facts":[""],"source_name":"","article_url":"URL EXATO DO INPUT","source_type":"media|official","is_official":false,"why_material":""}],"rejections":[{"article_url":"URL EXATO DO INPUT","reason":"generic_page|irrelevant|unverifiable|other"}]}`;
}

function isOfficialDomain(hostname) {
  return OFFICIAL_DOMAINS.some(domain => hostname === domain || hostname.endsWith(`.${domain}`));
}

function sourceIsOfficial(source) {
  let hostname=source.source_domain || '';
  if (!hostname) {
    try { hostname=new URL(source.url).hostname; } catch {}
  }
  return isOfficialDomain(hostname);
}

function normalizePublishedAt(value) {
  const timestamp=Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : '';
}

function publicationInsideWindow(source, publishedAt, currentTime) {
  const publishedTime=Date.parse(publishedAt);
  if (!Number.isFinite(publishedTime)) return false;
  const hours=sourceIsOfficial(source) ? 72 : 36;
  return publishedTime >= currentTime.getTime() - hours * 60 * 60 * 1000;
}

function dateFallbackPrompt(sources, currentTime) {
  return `Verifica exclusivamente a data de publicação dos URLs abaixo. Pesquisa ou abre cada URL e procura prova explícita da data original de publicação. Não uses dateModified, datas de atualização, datas de outros artigos nem a data de hoje por suposição. article_url tem de ser exatamente um dos URLs de input. Agora é ${lisbonDateTime(currentTime)} em Portugal.\n\nURLS:\n${JSON.stringify(sources.map(source=>({article_url:source.url,title:source.title||''})))}\n\nDevolve APENAS JSON válido:\n{"results":[{"article_url":"URL EXATO DO INPUT","published_at":"ISO 8601","date_evidence":"prova explícita e curta encontrada na fonte","confidence":0}]}`;
}

async function inspectSources(sources, currentTime, context) {
  const eligible=[];
  const unknown=[];
  for (let start=0; start<sources.length; start+=6) {
    const batch=sources.slice(start,start+6);
    const inspections=await Promise.all(batch.map(source=>source.verified_published_at ? {
      url:source.url,
      http_status:200,
      published_at:source.verified_published_at,
      date_source:source.date_source,
      date_status:'verified',
      title:source.verified_title || source.title || '',
      article_type:source.article_type || '',
      probable_article:Boolean(source.probable_article),
      fetch_ok:true
    } : inspectSourceUrl(source)));
    for (let index=0; index<batch.length; index++) {
      const source=batch[index];
      const inspection=inspections[index];
      context.stats.total++;
      const inside=inspection.published_at ? publicationInsideWindow(source,inspection.published_at,currentTime) : null;
      if (inspection.published_at) {
        context.stats.dated++;
        if (inside) {
          context.stats.inside_window++;
          eligible.push({
            ...source,
            verified_published_at:inspection.published_at,
            verified_title:inspection.title || source.title || '',
            date_status:'verified',
            date_source:inspection.date_source,
            article_type:inspection.article_type,
            probable_article:inspection.probable_article,
            fetch_ok:inspection.fetch_ok
          });
        } else {
          context.stats.outside_window++;
        }
      } else if (inspection.fetch_ok) {
        context.stats.unknown_date++;
        unknown.push({...source,inspection});
      } else {
        context.stats.fetch_failed++;
      }
      if (CFG.dryRun) {
        console.log(JSON.stringify({
          stage:'source_inspection',
          url:source.url,
          published_at:inspection.published_at,
          date_source:inspection.date_source,
          inside_window:inside,
          fetch_ok:inspection.fetch_ok
        }));
      }
    }
  }

  const fallbackBatch=unknown.slice(0,context.dateFallbackRemaining);
  context.dateFallbackRemaining-=fallbackBatch.length;
  if (fallbackBatch.length) {
    const inputByUrl=new Map(fallbackBatch.map(item=>[item.url,item]));
    const response=await openai({
      model:CFG.openaiModelValidator,
      prompt:dateFallbackPrompt(fallbackBatch,currentTime),
      purpose:'date_verification',
      web:true,
      effort:'low',
      searchContextSize:'medium'
    });
    const data=parseJson(response.text);
    const results=Array.isArray(data.results) ? data.results : Array.isArray(data) ? data : [data];
    const decided=new Set();
    for (const result of results) {
      const source=inputByUrl.get(result?.article_url);
      const publishedAt=normalizePublishedAt(result?.published_at);
      if (!source || decided.has(source.url) || Number(result?.confidence)<90 || !String(result?.date_evidence||'').trim() || !publishedAt) continue;
      decided.add(source.url);
      context.stats.unknown_date--;
      context.stats.dated++;
      if (publicationInsideWindow(source,publishedAt,currentTime)) {
        context.stats.inside_window++;
        eligible.push({
          ...source,
          verified_published_at:publishedAt,
          verified_title:source.inspection.title || source.title || '',
          date_status:'inferred',
          date_source:'web_search_evidence',
          date_evidence:String(result.date_evidence),
          article_type:source.inspection.article_type,
          probable_article:source.inspection.probable_article,
          fetch_ok:source.inspection.fetch_ok
        });
      } else {
        context.stats.outside_window++;
      }
    }
  }
  return eligible;
}

async function validateSearchResults(sources, currentTime) {
  const detailedTelemetry=CFG.dryRun || CFG.mode==='morning';
  const window={
    normalStart:lisbonDateTime(new Date(currentTime.getTime() - 36 * 60 * 60 * 1000)),
    officialStart:lisbonDateTime(new Date(currentTime.getTime() - 72 * 60 * 60 * 1000)),
    end:lisbonDateTime(currentTime)
  };
  const accepted=[];
  const rejectionReasons={outside_window:0,generic_page:0,irrelevant:0,unverifiable:0,other:0};
  const terraFallbackSources=[];
  const terraFallbackUrls=new Set();
  let batchNumber=0;
  for (let start=0; start<sources.length; start+=12) {
    batchNumber++;
    const batch=sources.slice(start,start+12);
    const inputByUrl=new Map(batch.map(source => [source.url,source]));
    const response=await openai({
      model:CFG.openaiModelValidator,
      prompt:validatorPrompt(batch,window),
      purpose:'validator',
      web:false,
      effort:'low',
      searchContextSize:'medium'
    });
    const data=parseJson(response.text);
    const proposed=Array.isArray(data.candidates) ? data.candidates : [];
    const acceptedInBatch=[];
    const decidedUrls=new Set();
    for (const candidate of proposed) {
      const source=inputByUrl.get(candidate.article_url);
      if (!source || decidedUrls.has(source.url)) continue;
      decidedUrls.add(source.url);
      const official=sourceIsOfficial(source);
      const validated={
        ...candidate,
        title:candidate.title || source.verified_title,
        event_date:source.verified_published_at.slice(0,10),
        article_url:source.url,
        source_type:official?'official':'media',
        is_official:official,
        sweep:source.sweep
      };
      acceptedInBatch.push(validated);
      accepted.push(validated);
    }
    const reportedRejections=new Map();
    for (const rejection of Array.isArray(data.rejections) ? data.rejections : []) {
      if (!inputByUrl.has(rejection.article_url) || decidedUrls.has(rejection.article_url)) continue;
      const reason=Object.hasOwn(rejectionReasons,rejection.reason) ? rejection.reason : 'other';
      reportedRejections.set(rejection.article_url,reason);
      if (reason==='unverifiable' && !validatorTerraFallback.used && terraFallbackSources.length<6 && !terraFallbackUrls.has(rejection.article_url)) {
        terraFallbackUrls.add(rejection.article_url);
        terraFallbackSources.push(inputByUrl.get(rejection.article_url));
      }
    }
    for (const source of batch) {
      if (decidedUrls.has(source.url)) continue;
      rejectionReasons[reportedRejections.get(source.url)||'other']++;
    }
    if (detailedTelemetry) {
      console.log(JSON.stringify({
        stage:'validator_batch',
        batch:batchNumber,
        input:batch.length,
        accepted:acceptedInBatch.length,
        rejected:batch.length-acceptedInBatch.length
      }));
      for (const candidate of acceptedInBatch) {
        console.log(JSON.stringify({
          stage:'validated_candidate',
          title:candidate.title||'',
          event_date:candidate.event_date||'',
          source_name:candidate.source_name||'',
          article_url:candidate.article_url,
          sweep:candidate.sweep
        }));
      }
    }
    await sleep(250);
  }
  if (!validatorTerraFallback.used && terraFallbackSources.length) {
    validatorTerraFallback.used=true;
    const inputByUrl=new Map(terraFallbackSources.map(source => [source.url,source]));
    const response=await openai({
      model:'gpt-5.6-terra',
      prompt:validatorPrompt(terraFallbackSources,window),
      purpose:'validator_terra_fallback',
      web:true,
      effort:'low',
      searchContextSize:'medium'
    });
    const data=parseJson(response.text);
    const acceptedUrls=new Set();
    const acceptedByTerra=[];
    for (const candidate of Array.isArray(data.candidates) ? data.candidates : []) {
      const source=inputByUrl.get(candidate.article_url);
      if (!source || acceptedUrls.has(source.url)) continue;
      acceptedUrls.add(source.url);
      const official=sourceIsOfficial(source);
      const validated={
        ...candidate,
        title:candidate.title || source.verified_title,
        event_date:source.verified_published_at.slice(0,10),
        article_url:source.url,
        source_type:official?'official':'media',
        is_official:official,
        sweep:source.sweep
      };
      acceptedByTerra.push(validated);
      accepted.push(validated);
    }
    const terraRejections=new Map();
    for (const rejection of Array.isArray(data.rejections) ? data.rejections : []) {
      if (!inputByUrl.has(rejection.article_url) || acceptedUrls.has(rejection.article_url)) continue;
      terraRejections.set(rejection.article_url,Object.hasOwn(rejectionReasons,rejection.reason)?rejection.reason:'other');
    }
    for (const source of terraFallbackSources) {
      rejectionReasons.unverifiable=Math.max(0,rejectionReasons.unverifiable-1);
      if (!acceptedUrls.has(source.url)) rejectionReasons[terraRejections.get(source.url)||'unverifiable']++;
    }
    console.log(JSON.stringify({
      stage:'validator_terra_fallback',
      input:terraFallbackSources.length,
      accepted:acceptedByTerra.length,
      rejected:terraFallbackSources.length-acceptedByTerra.length
    }));
    if (detailedTelemetry) {
      for (const candidate of acceptedByTerra) {
        console.log(JSON.stringify({
          stage:'validated_candidate',
          title:candidate.title||'',
          event_date:candidate.event_date||'',
          source_name:candidate.source_name||'',
          article_url:candidate.article_url,
          sweep:candidate.sweep
        }));
      }
    }
  }
  if (CFG.dryRun) {
    console.log(JSON.stringify({stage:'validator_rejections',reasons:rejectionReasons}));
  }
  return accepted;
}

async function discover() {
  const currentTime = new Date();
  const modePlan=getDiscoveryModePlan(CFG.mode);
  const detailedTelemetry=CFG.dryRun || CFG.mode==='morning';
  let directSources=[];
  let benchmarkSource=null;
  if (modePlan.directHarvest) {
    directSources=await harvestDirectSources(directSourceSeeds,{currentTime,dryRun:CFG.dryRun,telemetry:detailedTelemetry});
  }
  if (modePlan.benchmark) {
    benchmarkSource=directSources.find(source=>
      source.direct_source==='CNN Portugal' &&
      norm(`${source.title} ${source.url}`).includes('condominio') &&
      new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Lisbon'}).format(new Date(source.verified_published_at))==='2026-08-13'
    )||null;
  }
  const sweepByName=new Map([...thematicSweeps,...sourceSweeps,omissionSweep].map(sweep=>[sweep.name,sweep]));
  const sweepDefinitions=modePlan.sweepNames.map(name=>sweepByName.get(name)).filter(Boolean);
  const searches=[];
  for (const definition of sweepDefinitions) {
    const search=await searchSweep(definition,currentTime);
    searches.push({...search,name:definition.name});
    await sleep(250);
  }
  const sourceMap=new Map();
  for (const source of directSources) sourceMap.set(canonicalUrl(source.url),source);
  for (const search of searches) {
    for (const result of search.results) {
      const key=canonicalUrl(result.url);
      if (!sourceMap.has(key)) sourceMap.set(key,result);
      else if (!sourceMap.get(key).title && result.title) sourceMap.set(key,{...sourceMap.get(key),title:result.title});
    }
  }
  const sources=[...sourceMap.values()];
  if (CFG.dryRun) {
    console.log(JSON.stringify({
      stage:'searcher_total',
      cited_urls:searches.reduce((sum,search) => sum+search.citedCount,0),
      unique_urls:sources.length
    }));
  }
  const inspectionContext={
    stats:{total:0,dated:0,inside_window:0,outside_window:0,unknown_date:0,fetch_failed:0},
    dateFallbackRemaining:CFG.mode==='smoke' ? 6 : 12
  };
  const inspectedSources=await inspectSources(sources,currentTime,inspectionContext);
  let validatorSources=inspectedSources;
  if (modePlan.prefilterLimit) {
    validatorSources=prefilterHarvestSources(inspectedSources,{limit:modePlan.prefilterLimit,dryRun:CFG.dryRun,telemetry:detailedTelemetry}).selected;
  }
  if (modePlan.benchmark) {
    const benchmark=benchmarkSource && validatorSources.find(source=>source.url===benchmarkSource.url);
    console.log(JSON.stringify({
      stage:'benchmark',
      name:'cnn_condominios_2026_08_13',
      found:Boolean(benchmark),
      url:benchmark?.url||''
    }));
  }
  const firstPass=await validateSearchResults(validatorSources,currentTime);
  let rescue=[];
  if (!firstPass.length && !modePlan.directHarvest) {
    const rescueSources=await freshnessRescue(currentTime,new Set(sourceMap.keys()));
    if (rescueSources.length) {
      const inspectedRescueSources=await inspectSources(rescueSources,currentTime,inspectionContext);
      rescue=await validateSearchResults(inspectedRescueSources,currentTime);
    }
  }
  if (CFG.dryRun) {
    console.log(JSON.stringify({stage:'source_inspection_summary',...inspectionContext.stats}));
    console.log(JSON.stringify({
      stage:'freshness_summary',
      validated_first_pass:firstPass.length,
      validated_rescue:rescue.length,
      validated_total:firstPass.length+rescue.length
    }));
  }
  return [...firstPass,...rescue];
}

async function historicalContext(candidate) {
  const words = norm(`${candidate.title} ${(candidate.entities||[]).join(' ')} ${(candidate.key_facts||[]).join(' ')}`).split(' ').filter(w=>w.length>4).slice(0,8);
  if (!words.length) return [];
  const clauses=words.map(()=>'(lower(title) LIKE ? OR lower(summary) LIKE ? OR lower(entities_json) LIKE ? OR lower(key_facts_json) LIKE ?)').join(' OR ');
  const params=words.flatMap(w=>Array(4).fill(`%${w}%`));
  return d1(`SELECT id,event_key,parent_event_id,title,summary,pillar,event_date,legal_stage,entities_json,key_facts_json,published,published_url FROM events WHERE ${clauses} ORDER BY event_date DESC LIMIT 12`,params);
}

async function classifyEvent(candidate, history) {
  const prompt=`És editor-chefe do Guia do Proprietário. Decide se o candidato é um acontecimento NOVO, DUPLICADO de algo já registado/publicado, ou NOVO_MARCO de um processo anterior.\n\nCANDIDATO:\n${JSON.stringify(candidate)}\n\nHISTÓRICO PRÓXIMO:\n${JSON.stringify(history)}\n\nDUPLICADO = mesmo acontecimento central, ainda que fonte/título diferentes. NOVO_MARCO = houve mudança material de estado/facto (ex.: proposta -> aprovação -> publicação -> entrada em vigor), não simples repetição.\n\nAvalia também relevância para o Guia. Devolve apenas JSON:\n{"decision":"NOVO|DUPLICADO|NOVO_MARCO|IGNORAR","duplicate_event_id":"","parent_event_id":"","event_key":"slug-estavel-do-acontecimento","news_score":0,"seo_score":0,"lead_score":0,"reason":"","verified_title":"","verified_summary":"","pillar":"vender|impostos|arrendar|condominio|casa","legal_stage":"na|anuncio|proposta|aprovacao|publicacao|entrada_em_vigor|alteracao|revogacao"}`;
  return parseJson((await openai({model:CFG.openaiModelEditor,prompt,purpose:'editor',web:false,effort:'medium'})).text);
}

async function upsertEvent(candidate, cls) {
  const eventKey = cls.event_key || slugify(cls.verified_title || candidate.title);
  const eventId = id('evt',eventKey);
  const now=nowIso();
  await d1(`INSERT INTO events (id,event_key,parent_event_id,title,summary,pillar,event_date,legal_stage,entities_json,key_facts_json,news_score,seo_score,lead_score,first_seen_at,last_seen_at,status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(event_key) DO UPDATE SET last_seen_at=excluded.last_seen_at, news_score=max(events.news_score,excluded.news_score), seo_score=max(events.seo_score,excluded.seo_score), lead_score=max(events.lead_score,excluded.lead_score)`,[
    eventId,eventKey,cls.parent_event_id||null,cls.verified_title||candidate.title,cls.verified_summary||candidate.summary,cls.pillar||candidate.pillar,candidate.event_date,cls.legal_stage||candidate.legal_stage||'na',JSON.stringify(candidate.entities||[]),JSON.stringify(candidate.key_facts||[]),cls.news_score||0,cls.seo_score||0,cls.lead_score||0,now,now,'accepted'
  ]);
  await d1(`INSERT OR IGNORE INTO event_sources (event_id,source_name,article_url,published_at,source_type,is_primary,is_official) VALUES (?,?,?,?,?,?,?)`,[eventId,candidate.source_name||'',candidate.article_url,candidate.event_date,candidate.source_type||'media',1,candidate.is_official?1:0]);
  return {eventId,eventKey};
}

async function loadContentCandidates() {
  return d1(`SELECT path,slug,title,pillar,summary,body_excerpt FROM content_index`);
}

async function assessContentImpact(event, articles) {
  if (!articles.length) return [];
  const prompt=`Analisa se FACTOS NOVOS deste acontecimento tornam algum artigo evergreen do Guia do Proprietário desatualizado, contraditório ou materialmente incompleto. Não proponhas atualização só porque o tema é semelhante.\n\nACONTECIMENTO:\n${JSON.stringify(event)}\n\nARTIGOS CANDIDATOS:\n${JSON.stringify(articles)}\n\nRegras jurídicas/fiscais: anúncio/proposta NÃO substitui regra em vigor. Pode justificar apenas nota de acompanhamento. Publicação/entrada em vigor pode exigir correção do corpo.\n\nDevolve apenas JSON:\n{"impacts":[{"article_path":"","impact_type":"NONE|ADDENDUM|PARTIAL_UPDATE|REWRITE|URGENT_CORRECTION","severity":"low|medium|high|critical","confidence":0,"old_claim":"","new_fact":"","recommendation":"","proposed_patch":""}]}`;
  return parseJson((await openai({model:CFG.openaiModelImpact,prompt,purpose:'content_impact',web:false,effort:'medium'})).text).impacts || [];
}

async function saveImpact(eventId, impact) {
  if (impact.impact_type==='NONE' || Number(impact.confidence||0)<CFG.minImpactConfidence) return;
  await d1(`INSERT OR IGNORE INTO content_impacts (id,event_id,article_path,impact_type,severity,confidence,old_claim,new_fact,recommendation,proposed_patch,status,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,[
    id('imp',`${eventId}:${impact.article_path}`),eventId,impact.article_path,impact.impact_type,impact.severity,Number(impact.confidence||0),impact.old_claim||null,impact.new_fact||null,impact.recommendation||'',impact.proposed_patch||null,'proposed',nowIso()
  ]);
}


async function generatePublication(event) {
  const prompt = `És a Redação do Guia do Proprietário, em Portugal. O acontecimento abaixo já foi selecionado pelo radar. Produz o conteúdo final para a fila de aprovação, sem acrescentar factos que não estejam no EVENTO.

EVENTO VERIFICADO:
${JSON.stringify(event)}

REGRAS FACTUAIS:
- Usa apenas título, resumo, factos, entidades, data, fonte e fase jurídica presentes no EVENTO.
- Mantém números, percentagens, datas, prazos e condições.
- Não transformes proposta/anúncio em lei em vigor.
- Não inventes efeitos, recomendações, direitos ou obrigações.
- Português de Portugal.

TEXTO FACEBOOK:
- 4 a 6 frases, aproximadamente 70 a 120 palavras.
- Primeira frase: o que aconteceu.
- Depois 2 ou 3 factos úteis.
- Uma frase curta sobre relevância para o proprietário, apenas se suportada.
- Uma pergunta curta para comentário.
- Termina exatamente: Explicamos o essencial no link.
- Sem hashtags, emojis ou URLs.

TEXTO SITE:
- Markdown, aproximadamente 220 a 380 palavras.
- Não repetir o título no corpo.
- Parágrafo inicial direto.
- Secção obrigatória: ## O essencial, com 3 a 5 pontos.
- Secção: ## O que isto significa para um proprietário (ou público mais específico se apropriado).
- Secção ## Em que ponto está apenas quando a fase jurídica/administrativa estiver claramente indicada.
- Secção obrigatória: ## Também pode interessar, com exatamente 3 links internos escolhidos apenas desta lista:
  [Casa e obras](/casa/)
  [Vender casa](/vender/)
  [Arrendamento](/arrendar/)
  [Condomínio](/condominio/)
  [Impostos](/impostos/)
  [Calendário do proprietário](/calendario/)
  [Simuladores gratuitos](/simuladores/)
- Não incluir Fonte no fim.

Devolve APENAS JSON válido:
{"texto_fb":"","texto_site":""}`;
  const out = parseJson((await openai({model:CFG.openaiModelCopy,prompt,purpose:'copy',web:false,effort:'low'})).text);
  if (!out.texto_fb || !out.texto_site) throw new Error('Publication generation returned incomplete content');
  return out;
}

async function sendMake(payload) {
  if (!CFG.makeWebhook || CFG.dryRun) return {sent:false};
  const headers={'Content-Type':'application/json'};
  if (CFG.makeWebhookSecret) headers['x-make-apikey']=CFG.makeWebhookSecret;
  const res=await fetch(CFG.makeWebhook,{method:'POST',headers,body:JSON.stringify(payload)});
  if (!res.ok) throw new Error(`Make webhook ${res.status}: ${(await res.text()).slice(0,500)}`);
  return {sent:true};
}

async function indexContent() {
  const base=path.join(CFG.repoRoot,'src/content/artigos');
  async function walk(dir){let out=[];for(const e of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())out=out.concat(await walk(p));else if(/\.mdx?$/.test(e.name))out.push(p);}return out;}
  let files=[]; try{files=await walk(base);}catch{return 0;}
  let indexed=0;
  for(const file of files){
    const raw=await fs.readFile(file,'utf8');
    const fm=raw.match(/^---\s*\n([\s\S]*?)\n---/);
    const front=fm?.[1]||'';
    const pick=(k)=>front.match(new RegExp(`^${k}:\\s*["']?(.+?)["']?\\s*$`,'m'))?.[1]?.trim()||'';
    const rel=path.relative(CFG.repoRoot,file).replaceAll('\\','/');
    const title=pick('titulo')||path.basename(file).replace(/\.mdx?$/,'');
    const pillar=pick('pilar')||'';
    const summary=pick('descricao')||pick('resumo')||'';
    const body=raw.replace(/^---[\s\S]*?---/,'').replace(/\s+/g,' ').slice(0,7000);
    await d1(`INSERT INTO content_index (path,slug,title,pillar,summary,body_excerpt,fingerprint,updated_at) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(path) DO UPDATE SET title=excluded.title,pillar=excluded.pillar,summary=excluded.summary,body_excerpt=excluded.body_excerpt,fingerprint=excluded.fingerprint,updated_at=excluded.updated_at`,[rel,path.basename(file).replace(/\.mdx?$/,''),title,pillar,summary,body,sha(raw),nowIso()]);
    indexed++;
  }
  return indexed;
}

async function backfillPublishedNews() {
  const base=path.join(CFG.repoRoot,'src/content/notas');
  async function walk(dir){let out=[];for(const e of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())out=out.concat(await walk(p));else if(/\.mdx?$/.test(e.name))out.push(p);}return out;}
  let files=[]; try{files=await walk(base);}catch{return 0;}
  let processed=0;
  for(const file of files){
    const raw=await fs.readFile(file,'utf8'); const front=raw.match(/^---\s*\n([\s\S]*?)\n---/)?.[1]||'';
    const pick=(k)=>front.match(new RegExp(`^${k}:\\s*["']?(.+?)["']?\\s*$`,'m'))?.[1]?.trim()||'';
    const title=pick('titulo'); if(!title) continue;
    const date=pick('data').slice(0,10)||'1970-01-01'; const source=pick('fonte_nome'); const url=pick('fonte_url'); const pillar=pick('pilar')||'casa';
    const key=`legacy-${slugify(title)}-${date}`; const eventId=id('evt',key); const now=nowIso();
    await d1(`INSERT OR IGNORE INTO events (id,event_key,title,summary,pillar,event_date,legal_stage,entities_json,key_facts_json,news_score,seo_score,lead_score,first_seen_at,last_seen_at,published,published_url,status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,[eventId,key,title,'Notícia histórica importada do arquivo do Guia.',pillar,date,'na','[]','[]',100,0,0,now,now,1,null,'published']);
    if(url) await d1(`INSERT OR IGNORE INTO event_sources (event_id,source_name,article_url,published_at,source_type,is_primary,is_official) VALUES (?,?,?,?,?,?,?)`,[eventId,source||'Fonte histórica',url,date,'media',1,0]);
    processed++;
  }
  return processed;
}

async function main(){
  await initSchema();
  const indexedContent = await indexContent();
  console.log(JSON.stringify({stage:'content_index',count:indexedContent}));
  let backfilledNews = 0;
  if (CFG.mode !== 'smoke' && /^(1|true|yes)$/i.test(process.env.BACKFILL || '')) backfilledNews = await backfillPublishedNews();
  console.log(JSON.stringify({stage:'news_backfill',count:backfilledNews}));
  const runId=id('run',`${nowIso()}:${CFG.mode}`); await d1(`INSERT INTO radar_runs (id,started_at,mode,status) VALUES (?,?,?,?)`,[runId,nowIso(),CFG.mode,'running']);
  let candidates=[]; let created=0, duplicates=0, contentArticles=null;
  try{
    candidates=await discover();
    const urlSeen=new Set();
    for(const c of candidates){
      if(!c.article_url || urlSeen.has(c.article_url)) continue; urlSeen.add(c.article_url);
      const existingUrl=await d1(`SELECT e.id,e.event_key,e.published FROM event_sources s JOIN events e ON e.id=s.event_id WHERE s.article_url=? LIMIT 1`,[c.article_url]);
      if(existingUrl.length){duplicates++;continue;}
      const history=await historicalContext(c);
      const cls=await classifyEvent(c,history);
      if(['DUPLICADO','IGNORAR'].includes(cls.decision)){duplicates++;continue;}
      const {eventId,eventKey}=await upsertEvent(c,cls); created++;
      const event={...c,...cls,event_id:eventId,event_key:eventKey};
      const articles=contentArticles ??= await loadContentCandidates();
      const impactPrefilter=prefilterContentImpact(event,articles);
      contentImpactTotals.events_checked++;
      console.log(JSON.stringify({
        stage:'content_impact_prefilter',
        event_key:eventKey,
        articles_considered:impactPrefilter.articlesConsidered,
        matches:impactPrefilter.matches,
        sent_to_model:impactPrefilter.selected.length,
        top_scores:impactPrefilter.topScores
      }));
      let impacts=[];
      if (!impactPrefilter.selected.length) {
        contentImpactTotals.skipped++;
        console.log(JSON.stringify({stage:'content_impact_skip',event_key:eventKey,reason:'no_relevant_articles'}));
      } else {
        contentImpactTotals.model_calls++;
        impacts=await assessContentImpact(event,impactPrefilter.selected);
      }
      for(const imp of impacts) await saveImpact(eventId,imp);
      const publishableNews = Number(cls.news_score||0) >= CFG.minNewsScore;
      const qualifyingImpacts = impacts.filter(x => x.impact_type !== 'NONE' && Number(x.confidence||0) >= CFG.minImpactConfidence);
      contentImpactTotals.impacts_found+=qualifyingImpacts.length;
      const impactRank = { NONE:0, ADDENDUM:1, PARTIAL_UPDATE:2, REWRITE:3, URGENT_CORRECTION:4 };
      const strongestImpact = qualifyingImpacts.reduce((best, x) => {
        if (!best) return x;
        return (impactRank[x.impact_type]||0) > (impactRank[best.impact_type]||0) ? x : best;
      }, null);

      let publication = { texto_fb:'', texto_site:'' };
      if (publishableNews) {
        publication = await generatePublication({
          title: cls.verified_title||c.title,
          summary: cls.verified_summary||c.summary,
          pillar: cls.pillar||c.pillar,
          legal_stage: cls.legal_stage||c.legal_stage||'na',
          event_date: c.event_date,
          source_name: c.source_name||'',
          article_url: c.article_url||'',
          key_facts: c.key_facts||[],
          entities: c.entities||[]
        });
      }

      const payload={
        type: publishableNews ? 'noticia' : 'radar',
        event_id:eventId,
        event_key:eventKey,
        titulo_noticia:cls.verified_title||c.title,
        pilar:cls.pillar||c.pillar,
        legal_stage:cls.legal_stage||c.legal_stage||'na',
        fonte_nome:c.source_name||'',
        url_original:c.article_url||'',
        data_publicacao:c.event_date,
        conteudo_verificado:cls.verified_summary||c.summary,
        texto_fb:publication.texto_fb,
        texto_site:publication.texto_site,
        news_score:cls.news_score||0,
        seo_score:cls.seo_score||0,
        lead_score:cls.lead_score||0,
        tipo_evento:cls.decision,
        seo_trigger:Number(cls.seo_score||0)>=80 ? 'Sim' : 'Nao',
        lead_trigger:Number(cls.lead_score||0)>=80 ? 'Sim' : 'Nao',
        impacto_conteudo:strongestImpact?.impact_type || 'NONE',
        estado:cls.decision==='NOVO_MARCO' ? 'novo_marco' : 'novo',
        content_impacts:qualifyingImpacts
      };
      if (CFG.dryRun) {
        console.log(JSON.stringify({
          event_id:eventId,
          event_key:eventKey,
          titulo:cls.verified_title||c.title,
          pilar:cls.pillar||c.pillar,
          decision:cls.decision,
          legal_stage:cls.legal_stage||c.legal_stage||'na',
          news_score:cls.news_score||0,
          seo_score:cls.seo_score||0,
          lead_score:cls.lead_score||0,
          impacto_conteudo:strongestImpact?.impact_type||'NONE',
          fonte_nome:c.source_name||'',
          url_original:c.article_url||''
        }));
      }
      const sent=await sendMake(payload);
      if(sent.sent) await d1(`UPDATE events SET make_sent_at=? WHERE id=?`,[nowIso(),eventId]);
    }
    await d1(`UPDATE radar_runs SET finished_at=?,status='ok',candidates_found=?,events_created=?,duplicates_discarded=? WHERE id=?`,[nowIso(),candidates.length,created,duplicates,runId]);
    console.log(JSON.stringify({ok:true,runId,candidates:candidates.length,created,duplicates,dryRun:CFG.dryRun}));
  }catch(err){
    if (err instanceof BudgetGuardStop) {
      await d1(`UPDATE radar_runs SET finished_at=?,status='budget_guard',candidates_found=?,events_created=?,duplicates_discarded=? WHERE id=?`,[nowIso(),candidates.length,created,duplicates,runId]).catch(()=>{});
      console.log(JSON.stringify({ok:true,runId,status:'budget_guard',candidates:candidates.length,created,duplicates,dryRun:CFG.dryRun}));
      return;
    }
    await d1(`UPDATE radar_runs SET finished_at=?,status='error',notes=? WHERE id=?`,[nowIso(),String(err.stack||err).slice(0,4000),runId]).catch(()=>{});
    throw err;
  }finally{
    console.log(JSON.stringify({stage:'content_impact_summary',...contentImpactTotals}));
    logUsageSummary();
  }
}

await main();
