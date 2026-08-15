import {inferDeterministicLegalStage,inferDeterministicPillar} from './editorial-scoring.mjs';

const ALLOWED_STAGES=new Set(['na','anuncio','proposta','aprovacao','publicacao','entrada_em_vigor','alteracao','revogacao']);

function parseJson(text='') {
  const t=String(text).trim().replace(/^```json\s*/i,'').replace(/```$/,'').trim();
  try { return JSON.parse(t); } catch {}
  const a=t.indexOf('{'),b=t.lastIndexOf('}');
  if (a>=0 && b>a) {
    try { return JSON.parse(t.slice(a,b+1)); } catch {}
  }
  return null;
}

function canonical(value='') {
  try {
    const url=new URL(value);
    url.hash='';
    url.pathname=url.pathname.replace(/\/+$/,'')||'/';
    return url.toString();
  } catch { return String(value).trim(); }
}

function sourceName(source={}) {
  if (source.direct_source) return source.direct_source;
  let host=source.source_domain||'';
  try { host=host||new URL(source.url).hostname; } catch {}
  const map=[
    [/cnnportugal\.iol\.pt$/,'CNN Portugal'],
    [/rtp\.pt$/,'RTP'],
    [/eco\.sapo\.pt$/,'ECO'],
    [/dinheirovivo\.dn\.pt$/,'Dinheiro Vivo'],
    [/idealista\.pt$/,'Idealista News Portugal'],
    [/jornaleconomico\.sapo\.pt$/,'Jornal Económico']
  ];
  return map.find(([re])=>re.test(host))?.[1] || host || 'Fonte';
}

function uniqueFacts(values=[]) {
  const seen=new Set();
  const out=[];
  for (const value of Array.isArray(values)?values:[]) {
    const fact=String(value||'').replace(/\s+/g,' ').trim();
    if (fact.length<18) continue;
    const key=fact.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(fact);
    if (out.length===10) break;
  }
  return out;
}

function evidencePayload(source) {
  return {
    article_url:source.url,
    verified_title:source.verified_title||source.title||'',
    verified_published_at:source.verified_published_at||'',
    source_name:sourceName(source),
    source_description:String(source.source_description||'').slice(0,1400),
    source_excerpt:String(source.source_excerpt||'').slice(0,9000),
    source_type:source.source_type||'media',
    is_official:Boolean(source.is_official)
  };
}

export function buildFactualExtractionPrompt(sources=[]) {
  return `És um extrator factual para o Guia do Proprietário. NÃO decides relevância editorial e NÃO rejeitas uma notícia por ser pouco importante. O sistema já validou URL, data e relevância mínima.

Usa EXCLUSIVAMENTE a evidência textual fornecida em source_description e source_excerpt. Não uses conhecimento externo e não inventes factos.

Para CADA URL:
- copia article_url exatamente;
- escreve summary com 2 a 4 frases factuais;
- extrai 4 a 8 key_facts concretos quando a evidência os suportar;
- identifica entities apenas quando aparecem na evidência;
- identifica legal_stage apenas quando suportado;
- confidence mede apenas a suficiência da evidência factual, não a importância da notícia;
- se a evidência não permitir pelo menos 3 factos concretos, usa validation_status="insufficient";
- NÃO omitas a URL.

INPUT:
${JSON.stringify(sources.map(evidencePayload))}

Devolve APENAS JSON:
{"results":[{"article_url":"","summary":"","entities":[],"key_facts":[],"legal_stage":"na|anuncio|proposta|aprovacao|publicacao|entrada_em_vigor|alteracao|revogacao","confidence":0,"validation_status":"verified|insufficient"}]}`;
}

export function normalizeFactualCandidate(source,item={}) {
  if (canonical(item.article_url)!==canonical(source.url)) return null;
  const facts=uniqueFacts(item.key_facts);
  const summary=String(item.summary||'').replace(/\s+/g,' ').trim();
  const confidence=Math.max(0,Math.min(100,Number(item.confidence)||0));
  const stage=ALLOWED_STAGES.has(item.legal_stage) ? item.legal_stage : inferDeterministicLegalStage(source);
  const verified=item.validation_status!=='insufficient' && confidence>=75 && summary.length>=80 && facts.length>=3;
  return {
    title:source.verified_title||source.title||'',
    source_title:source.verified_title||source.title||'',
    summary,
    event_date:String(source.verified_published_at||'').slice(0,10),
    pillar:inferDeterministicPillar(source),
    legal_stage:stage,
    entities:Array.isArray(item.entities)?item.entities.map(v=>String(v).trim()).filter(Boolean).slice(0,12):[],
    key_facts:facts,
    source_name:sourceName(source),
    article_url:source.url,
    source_type:source.source_type||'media',
    is_official:Boolean(source.is_official),
    sweep:source.sweep||'',
    harvest_relevance_score:Number(source.harvest_relevance_score||0),
    source_description:source.source_description||'',
    source_excerpt:source.source_excerpt||'',
    validation_status:verified?'verified':'insufficient',
    validation_confidence:confidence
  };
}

export function buildEvidenceFallbackCandidate(source) {
  const summary=String(source.source_description||source.source_excerpt||'')
    .replace(/\s+/g,' ')
    .trim()
    .slice(0,900);
  return {
    title:source.verified_title||source.title||'',
    source_title:source.verified_title||source.title||'',
    summary,
    event_date:String(source.verified_published_at||'').slice(0,10),
    pillar:inferDeterministicPillar(source),
    legal_stage:inferDeterministicLegalStage(source),
    entities:[],
    key_facts:[],
    source_name:sourceName(source),
    article_url:source.url,
    source_type:source.source_type||'media',
    is_official:Boolean(source.is_official),
    sweep:source.sweep||'',
    harvest_relevance_score:Number(source.harvest_relevance_score||0),
    source_description:source.source_description||'',
    source_excerpt:source.source_excerpt||'',
    validation_status:'evidence_fallback',
    validation_confidence:0
  };
}

async function callAndParse(callModel,{model,prompt,purpose,effort}) {
  try {
    const text=await callModel({model,prompt,purpose,effort});
    const data=parseJson(text);
    return Array.isArray(data?.results)?data.results:[];
  } catch {
    return [];
  }
}

export async function extractFactualCandidates(sources,{
  callModel,
  primaryModel,
  fallbackModel,
  batchSize=4,
  log=()=>{}
}={}) {
  if (typeof callModel!=='function') throw new Error('callModel is required');
  const resolved=new Map();
  const unresolved=new Map(sources.map(source=>[source.url,source]));

  for (let start=0,batchNumber=1;start<sources.length;start+=batchSize,batchNumber++) {
    const batch=sources.slice(start,start+batchSize);
    const results=await callAndParse(callModel,{
      model:primaryModel,
      prompt:buildFactualExtractionPrompt(batch),
      purpose:'validator_extract',
      effort:'low'
    });
    let verified=0;
    for (const source of batch) {
      const item=results.find(result=>canonical(result?.article_url)===canonical(source.url));
      const candidate=item?normalizeFactualCandidate(source,item):null;
      if (candidate?.validation_status==='verified') {
        resolved.set(source.url,candidate);
        unresolved.delete(source.url);
        verified++;
      }
    }
    log({stage:'validator_extract_batch',batch:batchNumber,input:batch.length,verified});
  }

  const pending=[...unresolved.values()];
  for (let start=0,batchNumber=1;start<pending.length;start+=3,batchNumber++) {
    const batch=pending.slice(start,start+3);
    const results=await callAndParse(callModel,{
      model:fallbackModel,
      prompt:buildFactualExtractionPrompt(batch),
      purpose:'validator_extract_fallback',
      effort:'medium'
    });
    let verified=0;
    for (const source of batch) {
      const item=results.find(result=>canonical(result?.article_url)===canonical(source.url));
      const candidate=item?normalizeFactualCandidate(source,item):null;
      if (candidate?.validation_status==='verified') {
        resolved.set(source.url,candidate);
        unresolved.delete(source.url);
        verified++;
      }
    }
    log({stage:'validator_extract_fallback_batch',batch:batchNumber,input:batch.length,verified});
  }

  for (const source of unresolved.values()) {
    resolved.set(source.url,buildEvidenceFallbackCandidate(source));
    log({stage:'validator_evidence_fallback',article_url:source.url,title:source.verified_title||source.title||''});
  }

  return sources.map(source=>resolved.get(source.url)).filter(Boolean);
}
