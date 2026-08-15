from pathlib import Path


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 occurrence, found {count}')
    return text.replace(old, new, 1)


p = Path('automation/editorial-radar/radar-v22.mjs')
text = p.read_text()

text = replace_once(
    text,
    "import {shouldUpgradeLegacyPublication} from './legacy-upgrade.mjs';\n",
    "import {shouldUpgradeLegacyPublication} from './legacy-upgrade.mjs';\nimport {resolveDuplicateTarget} from './duplicate-target.mjs';\n",
    'duplicate target import'
)

text = replace_once(
    text,
    "return d1(`SELECT id,event_key,parent_event_id,title,summary,pillar,event_date,legal_stage,entities_json,key_facts_json,published,published_url FROM events WHERE ${clauses} ORDER BY event_date DESC LIMIT 16`,params);",
    "return d1(`SELECT id,event_key,parent_event_id,title,summary,pillar,event_date,legal_stage,entities_json,key_facts_json,news_score,seo_score,lead_score,published,published_url,make_sent_at FROM events WHERE ${clauses} ORDER BY event_date DESC LIMIT 16`,params);",
    'historical scores'
)

text = replace_once(
    text,
    "Não reescrevas factos, título, pilar ou scores.\n\nDevolve APENAS JSON:",
    "Não reescrevas factos, título, pilar ou scores.\nSe decidires DUPLICADO, duplicate_event_id TEM DE ser exatamente o id do evento correspondente em HISTÓRICO PRÓXIMO e event_key TEM DE ser exatamente a event_key desse mesmo evento. Se não conseguires identificar um alvo exato, decide NOVO.\n\nDevolve APENAS JSON:",
    'dedupe target requirement'
)

old = """      const history=await historicalContext(candidate);
      const duplicateDecision=await classifyDuplicate(candidate,history);
      if (duplicateDecision.decision==='DUPLICADO') {
        stats.duplicates++;
        log({stage:'duplicate_semantic',title:candidate.title,reason:duplicateDecision.reason||''});
        continue;
      }

      const classification=applyDeterministicEditorialScores(candidate,{
"""

new = """      const history=await historicalContext(candidate);
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
                  target.id,candidate.source_name||'',candidate.article_url,candidate.event_date,candidate.source_type||'media',0,candidate.is_official?1:0
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
              target.id,candidate.source_name||'',candidate.article_url,candidate.event_date,candidate.source_type||'media',0,candidate.is_official?1:0
            ]);
            await d1(`UPDATE events SET last_seen_at=? WHERE id=?`,[nowIso(),target.id]);
          }
          log({stage:'duplicate_semantic',title:candidate.title,target_event_id:target.id,target_event_key:target.event_key,old_news_score:Number(target.news_score||0),new_news_score:rescored.news_score,reason:duplicateDecision.reason||''});
        }
        continue;
      }

      const classification=applyDeterministicEditorialScores(candidate,{
"""

text = replace_once(text, old, new, 'semantic duplicate upgrade')
p.write_text(text)
