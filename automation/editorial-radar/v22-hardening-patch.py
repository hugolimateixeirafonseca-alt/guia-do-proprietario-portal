from pathlib import Path


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 occurrence, found {count}')
    return text.replace(old, new, 1)


harvest_path = Path('automation/editorial-radar/source-harvest.mjs')
harvest = harvest_path.read_text()
harvest = replace_once(
    harvest,
    "  'renda','rendas','imóvel','imóveis','imobiliário','casa','casas','moradia','moradias','crédito habitação',",
    "  'renda','rendas','imóvel','imóveis','imobiliário','moradia','moradias','crédito habitação',",
    'remove ambiguous casa signal'
)
harvest = replace_once(
    harvest,
    "  'bolsa internacional','petróleo','automóvel','turismo','aviação','telecomunicações','celebridades'\n];",
    "  'bolsa internacional','petróleo','automóvel','turismo','aviação','telecomunicações','celebridades',\n  'nuclear','central nuclear'\n];",
    'extend negative topics'
)
marker = "  const directSource=normalized(source.direct_source||'');\n"
insertion = """  const directSource=normalized(source.direct_source||'');
  const titleNormalized=normalized(title);
  const hasStrongOwnerSignal=titleHigh.length>0;
  if (!reason && /(?:^|\\/)mundo(?:\\/|$)/i.test(pathname)) reason='excluded_section';
  if (!reason && /(?:^|\\/)opiniao(?:\\/|$)/i.test(pathname) && !hasStrongOwnerSignal) reason='excluded_section';
  if (!reason && /\\b(?:morto|morte|plagio|policia|pj)\\b/i.test(titleNormalized) && !hasStrongOwnerSignal) reason='excluded_section';
"""
harvest = replace_once(harvest, marker, insertion, 'hard exclusions')
harvest_path.write_text(harvest)

radar_path = Path('automation/editorial-radar/radar-v22.mjs')
radar = radar_path.read_text()
radar = replace_once(
    radar,
    "import {applyDeterministicEditorialScores} from './editorial-scoring.mjs';\n",
    "import {applyDeterministicEditorialScores} from './editorial-scoring.mjs';\nimport {shouldAssessContentImpact} from './impact-gate.mjs';\nimport {shouldUpgradeLegacyPublication} from './legacy-upgrade.mjs';\n",
    'hardening imports'
)

old_duplicate = """      const existingUrl=await d1(`SELECT e.id,e.event_key,e.published FROM event_sources s JOIN events e ON e.id=s.event_id WHERE s.article_url=? LIMIT 1`,[candidate.article_url]);
      if (existingUrl.length) {
        stats.duplicates++;
        log({stage:'duplicate_url',article_url:candidate.article_url,event_id:existingUrl[0].id});
        continue;
      }
"""
new_duplicate = """      const existingUrl=await d1(`SELECT e.id,e.event_key,e.published,e.news_score,e.seo_score,e.lead_score FROM event_sources s JOIN events e ON e.id=s.event_id WHERE s.article_url=? LIMIT 1`,[candidate.article_url]);
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
"""
radar = replace_once(radar, old_duplicate, new_duplicate, 'legacy duplicate upgrade')

old_impact = """      const articles=contentArticles??=await loadContentCandidates();
      const impactPrefilter=prefilterContentImpact(event,articles);
      log({
        stage:'content_impact_prefilter',
        event_key:eventKey,
        articles_considered:impactPrefilter.articlesConsidered,
        matches:impactPrefilter.matches,
        sent_to_model:impactPrefilter.selected.length,
        top_scores:impactPrefilter.topScores
      });
      const impacts=impactPrefilter.selected.length?await assessContentImpact(event,impactPrefilter.selected):[];
      for (const impact of impacts) await persistImpact(eventId,impact);
"""
new_impact = """      let impacts=[];
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
"""
radar = replace_once(radar, old_impact, new_impact, 'impact model gate')
radar_path.write_text(radar)
