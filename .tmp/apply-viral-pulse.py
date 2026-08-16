from pathlib import Path


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f'pattern not found: {label}')
    return text.replace(old, new, 1)

# factual-extraction.mjs: preserve full source publication timestamp
p=Path('automation/editorial-radar/factual-extraction.mjs')
s=p.read_text(encoding='utf-8')
s=replace_once(s,
"""    event_date:String(source.verified_published_at||'').slice(0,10),
    pillar:inferDeterministicPillar(source),""",
"""    event_date:String(source.verified_published_at||'').slice(0,10),
    source_published_at:String(source.verified_published_at||''),
    pillar:inferDeterministicPillar(source),""",
'normalized source timestamp')
s=replace_once(s,
"""    event_date:String(source.verified_published_at||'').slice(0,10),
    pillar:inferDeterministicPillar(source),""",
"""    event_date:String(source.verified_published_at||'').slice(0,10),
    source_published_at:String(source.verified_published_at||''),
    pillar:inferDeterministicPillar(source),""",
'fallback source timestamp')
p.write_text(s,encoding='utf-8')

# schema.sql: persist one viral notification per event
p=Path('automation/editorial-radar/schema.sql')
s=p.read_text(encoding='utf-8')
anchor="""CREATE UNIQUE INDEX IF NOT EXISTS idx_event_sources_url ON event_sources(article_url);

CREATE TABLE IF NOT EXISTS content_index ("""
insert="""CREATE UNIQUE INDEX IF NOT EXISTS idx_event_sources_url ON event_sources(article_url);

CREATE TABLE IF NOT EXISTS viral_alerts (
  event_id TEXT PRIMARY KEY,
  viral_score INTEGER NOT NULL DEFAULT 0,
  source_count INTEGER NOT NULL DEFAULT 0,
  span_minutes INTEGER,
  detected_at TEXT NOT NULL,
  notified_at TEXT,
  FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_viral_alerts_notified ON viral_alerts(notified_at, detected_at DESC);

CREATE TABLE IF NOT EXISTS content_index ("""
s=replace_once(s,anchor,insert,'viral alerts schema')
p.write_text(s,encoding='utf-8')

# radar-v22.mjs
p=Path('automation/editorial-radar/radar-v22.mjs')
s=p.read_text(encoding='utf-8')
s=replace_once(s,
"""import {publicationEvidenceStatus} from './publication-evidence.mjs';
""",
"""import {publicationEvidenceStatus} from './publication-evidence.mjs';
import {evaluateViralPriority} from './viral-priority.mjs';
""",
'viral import')
s=replace_once(s,
"""  publication_not_ready:0,
  publication_quality_rejected:0
};""",
"""  publication_not_ready:0,
  publication_quality_rejected:0,
  viral_alerts:0
};""",
'viral stat')

# Pulse: direct media only, no web-search sweeps.
s=replace_once(s,
"""  const webResults=[];
  for (const definition of searchSweeps) {
    const results=await runSearchSweep(definition,currentTime);
    webResults.push(...results);
    await sleep(200);
  }
""",
"""  const webResults=[];
  if (CFG.mode!=='pulse') {
    for (const definition of searchSweeps) {
      const results=await runSearchSweep(definition,currentTime);
      webResults.push(...results);
      await sleep(200);
    }
  } else {
    log({stage:'pulse_discovery',web_search_skipped:true,direct_sources:direct.length});
  }
""",
'pulse discovery')

old="""  const limit=CFG.mode==='incremental'?24:30;
  const prefiltered=prefilterHarvestSources(enriched,{limit,dryRun:CFG.dryRun,telemetry:true}).selected;
  stats.prefiltered=prefiltered.length;
  const candidates=await extractFactualCandidates(prefiltered,{"""
new="""  const limit=CFG.mode==='pulse'?8:CFG.mode==='incremental'?24:30;
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
  const candidates=await extractFactualCandidates(prefiltered,{"""
s=replace_once(s,old,new,'pulse candidate filter')

# Persist full timestamp on new sources (all candidate insertions).
s=s.replace("candidate.article_url,candidate.event_date,candidate.source_type||'media'","candidate.article_url,candidate.source_published_at||candidate.event_date,candidate.source_type||'media'")

# Viral helper after sendMake.
anchor="""async function main() {
"""
helper=r'''async function viralStateForEvent(eventId) {
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

'''
s=replace_once(s,anchor,helper+anchor,'viral helper')

# At end of semantic duplicate branch, guarantee full source record, update score and evaluate viral priority.
old="""        }
        continue;
      }

      const classification=applyDeterministicEditorialScores(candidate,{"""
new="""        }
        if (!CFG.dryRun) {
          await d1(`INSERT OR IGNORE INTO event_sources (event_id,source_name,article_url,published_at,source_type,is_primary,is_official) VALUES (?,?,?,?,?,?,?)`,[
            target.id,candidate.source_name||'',candidate.article_url,candidate.source_published_at||candidate.event_date,candidate.source_type||'media',0,candidate.is_official?1:0
          ]);
          await d1(`UPDATE events SET last_seen_at=?,news_score=max(news_score,?) WHERE id=?`,[nowIso(),Number(rescored.news_score||0),target.id]);
          await maybeSendViralPriority(target.id);
        }
        continue;
      }

      const classification=applyDeterministicEditorialScores(candidate,{"""
s=replace_once(s,old,new,'semantic duplicate viral check')
p.write_text(s,encoding='utf-8')

# workflow: add pulse schedule and manual mode
p=Path('.github/workflows/editorial-radar.yml')
s=p.read_text(encoding='utf-8')
s=replace_once(s,
"""    - cron: '30 6 * * *'
""",
"""    - cron: '30 6 * * *'
    # Rondas curtas durante o dia: só fontes diretas, sem sweeps de web search.
    - cron: '30 9,12,15,18 * * *'
""",
'pulse schedule')
s=replace_once(s,
"""          - incremental
          - maintenance-report
""",
"""          - incremental
          - pulse
          - maintenance-report
""",
'pulse option')
s=replace_once(s,
"""          elif [[ "${{ github.event_name }}" == "schedule" ]]; then
            echo "RADAR_MODE=morning" >> "$GITHUB_ENV"
            echo "RADAR_DRY_RUN=false" >> "$GITHUB_ENV"
            echo "BACKFILL=false" >> "$GITHUB_ENV"
          fi
""",
"""          elif [[ "${{ github.event_name }}" == "schedule" ]]; then
            if [[ "${{ github.event.schedule }}" == "30 6 * * *" ]]; then
              echo "RADAR_MODE=morning" >> "$GITHUB_ENV"
            else
              echo "RADAR_MODE=pulse" >> "$GITHUB_ENV"
            fi
            echo "RADAR_DRY_RUN=false" >> "$GITHUB_ENV"
            echo "BACKFILL=false" >> "$GITHUB_ENV"
          fi
""",
'resolve pulse mode')
p.write_text(s,encoding='utf-8')
