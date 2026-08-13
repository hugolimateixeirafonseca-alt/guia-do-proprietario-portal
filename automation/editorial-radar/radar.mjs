import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const REQUIRED = ['OPENAI_API_KEY','CF_ACCOUNT_ID','CF_D1_DATABASE_ID','CF_D1_API_TOKEN'];
for (const key of REQUIRED) if (!process.env[key]) throw new Error(`Missing secret: ${key}`);

const CFG = {
  openaiModelSearch: process.env.OPENAI_SEARCH_MODEL || 'gpt-5.6-terra',
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
};

const nowIso = () => new Date().toISOString();
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const norm = (s='') => s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const slugify = (s='') => norm(s).replace(/\s+/g,'-').slice(0,120);
const id = (prefix, value) => `${prefix}_${sha(value).slice(0,20)}`;

async function openai({model, prompt, web=false, effort='low'}) {
  const body = { model, input: prompt, reasoning: { effort } };
  if (web) body.tools = [{ type: 'web_search' }];
  const res = await fetch('https://api.openai.com/v1/responses', {
    method:'POST',
    headers:{'Authorization':`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},
    body:JSON.stringify(body)
  });
  const raw = await res.text();
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${raw.slice(0,1000)}`);
  const data = JSON.parse(raw);
  const text = data.output_text || (data.output || []).flatMap(x => x.content || []).map(c => c.text || '').join('\n');
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

const sweeps = [
  ['legislacao_fiscalidade', `Procura notícias publicadas nas últimas 36 horas em Portugal sobre legislação, Governo, Parlamento, Diário da República, IMI, AIMI, IMT, VPT, IRS sobre rendas, mais-valias, benefícios fiscais, prazos e obrigações que afetem proprietários de imóveis.`],
  ['condominio_vizinhos', `Procura notícias publicadas nas últimas 36 horas em Portugal sobre condomínios, propriedade horizontal, administradores de condomínio, quotas, assembleias, partes comuns, obras, elevadores, fachadas, ruído, vizinhos, muros e conflitos entre proprietários.`],
  ['arrendamento', `Procura notícias publicadas nas últimas 36 horas em Portugal sobre arrendamento, senhorios, inquilinos, rendas, contratos, despejos, apoios à renda, alojamento local e alterações regulamentares relevantes para proprietários.`],
  ['mercado_credito', `Procura notícias publicadas nas últimas 36 horas em Portugal sobre preços das casas, oferta, procura, vendas, avaliações, crédito habitação, Euribor, BCE, Banco de Portugal, escrituras e CPCV que sejam materialmente úteis a proprietários, vendedores ou compradores.`],
  ['casa_energia_obras', `Procura notícias publicadas nas últimas 36 horas em Portugal sobre obras em casa, remodelação, licenciamento, energia, eletricidade, gás, eficiência energética, certificados, solar, seguros da casa, água, manutenção e custos domésticos com impacto concreto no proprietário.`],
  ['herancas_propriedade', `Procura notícias publicadas nas últimas 36 horas em Portugal sobre heranças com imóveis, partilhas, usufruto, compropriedade, registos, escrituras, terrenos e direitos de propriedade.`],
  ['fontes_oficiais', `Procura nas últimas 72 horas fontes oficiais portuguesas relevantes para proprietários de imóveis: Governo, Diário da República, Parlamento, Autoridade Tributária, Banco de Portugal, INE, ADENE, reguladores e municípios apenas quando a medida tenha impacto material e amplo.`],
  ['catch_all', `Sem te limitares às categorias habituais, procura acontecimentos publicados nas últimas 36 horas em Portugal que possam alterar materialmente quanto alguém que possui uma casa paga ou recebe, o que tem de fazer ou pode fazer, ou uma decisão importante sobre vender, arrendar, manter, financiar ou gerir um imóvel.`]
];

function discoveryPrompt(name, query) {
  return `És o radar editorial do Guia do Proprietário, portal português para proprietários de imóveis.\n\nMISSÃO DO SWEEP: ${name}\n${query}\n\nDevolve APENAS JSON válido neste formato:\n{"candidates":[{"title":"","summary":"","event_date":"YYYY-MM-DD","pillar":"vender|impostos|arrendar|condominio|casa","legal_stage":"na|anuncio|proposta|aprovacao|publicacao|entrada_em_vigor|alteracao|revogacao","entities":[""],"key_facts":[""],"source_name":"","article_url":"https://...","source_type":"media|official","is_official":false,"why_material":""}]}\n\nRegras: só acontecimentos reais e recentes; exclui lifestyle, classificados, publicidade, movimentos empresariais e notícias sem utilidade concreta. Não inventes URLs. Prefere fonte original/oficial quando existir. Máximo 8 candidatos realmente fortes.`;
}

async function discover() {
  const selected = CFG.mode === 'morning' ? sweeps : sweeps.filter(([n]) => ['legislacao_fiscalidade','condominio_vizinhos','arrendamento','mercado_credito','fontes_oficiais','catch_all'].includes(n));
  const all=[];
  for (const [name,q] of selected) {
    const r = await openai({model:CFG.openaiModelSearch,prompt:discoveryPrompt(name,q),web:true,effort:'low'});
    const data=parseJson(r.text);
    for (const c of data.candidates || []) all.push({...c,sweep:name});
    await sleep(250);
  }
  return all;
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
  return parseJson((await openai({model:CFG.openaiModelEditor,prompt,web:false,effort:'medium'})).text);
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

async function loadContentCandidates(event) {
  const words=norm(`${event.title} ${event.summary} ${(event.entities||[]).join(' ')} ${(event.key_facts||[]).join(' ')}`).split(' ').filter(w=>w.length>4).slice(0,10);
  if (!words.length) return [];
  const clauses=words.map(()=>'(lower(title) LIKE ? OR lower(summary) LIKE ? OR lower(body_excerpt) LIKE ?)').join(' OR ');
  return d1(`SELECT path,slug,title,pillar,summary,body_excerpt FROM content_index WHERE ${clauses} LIMIT 12`,words.flatMap(w=>Array(3).fill(`%${w}%`)));
}

async function assessContentImpact(event, articles) {
  if (!articles.length) return [];
  const prompt=`Analisa se FACTOS NOVOS deste acontecimento tornam algum artigo evergreen do Guia do Proprietário desatualizado, contraditório ou materialmente incompleto. Não proponhas atualização só porque o tema é semelhante.\n\nACONTECIMENTO:\n${JSON.stringify(event)}\n\nARTIGOS CANDIDATOS:\n${JSON.stringify(articles)}\n\nRegras jurídicas/fiscais: anúncio/proposta NÃO substitui regra em vigor. Pode justificar apenas nota de acompanhamento. Publicação/entrada em vigor pode exigir correção do corpo.\n\nDevolve apenas JSON:\n{"impacts":[{"article_path":"","impact_type":"NONE|ADDENDUM|PARTIAL_UPDATE|REWRITE|URGENT_CORRECTION","severity":"low|medium|high|critical","confidence":0,"old_claim":"","new_fact":"","recommendation":"","proposed_patch":""}]}`;
  return parseJson((await openai({model:CFG.openaiModelImpact,prompt,web:false,effort:'medium'})).text).impacts || [];
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
  const out = parseJson((await openai({model:CFG.openaiModelCopy,prompt,web:false,effort:'low'})).text);
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
  let files=[]; try{files=await walk(base);}catch{return;}
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
  }
}

async function backfillPublishedNews() {
  const base=path.join(CFG.repoRoot,'src/content/notas');
  async function walk(dir){let out=[];for(const e of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())out=out.concat(await walk(p));else if(/\.mdx?$/.test(e.name))out.push(p);}return out;}
  let files=[]; try{files=await walk(base);}catch{return;}
  for(const file of files){
    const raw=await fs.readFile(file,'utf8'); const front=raw.match(/^---\s*\n([\s\S]*?)\n---/)?.[1]||'';
    const pick=(k)=>front.match(new RegExp(`^${k}:\\s*["']?(.+?)["']?\\s*$`,'m'))?.[1]?.trim()||'';
    const title=pick('titulo'); if(!title) continue;
    const date=pick('data').slice(0,10)||'1970-01-01'; const source=pick('fonte_nome'); const url=pick('fonte_url'); const pillar=pick('pilar')||'casa';
    const key=`legacy-${slugify(title)}-${date}`; const eventId=id('evt',key); const now=nowIso();
    await d1(`INSERT OR IGNORE INTO events (id,event_key,title,summary,pillar,event_date,legal_stage,entities_json,key_facts_json,news_score,seo_score,lead_score,first_seen_at,last_seen_at,published,published_url,status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,[eventId,key,title,'Notícia histórica importada do arquivo do Guia.',pillar,date,'na','[]','[]',100,0,0,now,now,1,null,'published']);
    if(url) await d1(`INSERT OR IGNORE INTO event_sources (event_id,source_name,article_url,published_at,source_type,is_primary,is_official) VALUES (?,?,?,?,?,?,?)`,[eventId,source||'Fonte histórica',url,date,'media',1,0]);
  }
}

async function main(){
  await initSchema();
  await indexContent();
  if (/^(1|true|yes)$/i.test(process.env.BACKFILL || '')) await backfillPublishedNews();
  const runId=id('run',`${nowIso()}:${CFG.mode}`); await d1(`INSERT INTO radar_runs (id,started_at,mode,status) VALUES (?,?,?,?)`,[runId,nowIso(),CFG.mode,'running']);
  let candidates=[]; let created=0, duplicates=0;
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
      const articles=await loadContentCandidates(event);
      const impacts=await assessContentImpact(event,articles);
      for(const imp of impacts) await saveImpact(eventId,imp);
      const publishableNews = Number(cls.news_score||0) >= CFG.minNewsScore;
      const qualifyingImpacts = impacts.filter(x => x.impact_type !== 'NONE' && Number(x.confidence||0) >= CFG.minImpactConfidence);
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
    await d1(`UPDATE radar_runs SET finished_at=?,status='error',notes=? WHERE id=?`,[nowIso(),String(err.stack||err).slice(0,4000),runId]).catch(()=>{});
    throw err;
  }
}

await main();
