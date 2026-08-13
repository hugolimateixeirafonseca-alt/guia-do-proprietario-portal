import crypto from 'node:crypto';

function sha(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function acceptedEventRecord(candidate,cls,{dryRun=false}={}) {
  const eventKey=cls.event_key || String(cls.verified_title||candidate.title||'event').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,120);
  return {
    id:`${dryRun?'dry_evt':'evt'}_${sha(eventKey).slice(0,20)}`,
    event_key:eventKey,
    parent_event_id:cls.parent_event_id||null,
    title:cls.verified_title||candidate.title||'',
    summary:cls.verified_summary||candidate.summary||'',
    pillar:cls.pillar||candidate.pillar||'',
    event_date:candidate.event_date||'',
    legal_stage:cls.legal_stage||candidate.legal_stage||'na',
    entities_json:JSON.stringify(candidate.entities||[]),
    key_facts_json:JSON.stringify(candidate.key_facts||[]),
    published:0,
    published_url:null,
    article_url:candidate.article_url||''
  };
}

export function combinedHistoricalContext(persistentEvents,runAcceptedEvents) {
  return [...runAcceptedEvents,...persistentEvents].slice(0,24);
}

export function createIsolationController({dryRun,writeEvent,writeImpact,sendMake}) {
  const telemetry={event_writes:0,event_source_writes:0,impact_writes:0,make_sends:0};
  return {
    telemetry,
    async acceptEvent(candidate,cls) {
      const record=acceptedEventRecord(candidate,cls,{dryRun});
      if (dryRun) return {eventId:record.id,eventKey:record.event_key,record};
      const persisted=await writeEvent(candidate,cls);
      telemetry.event_writes++;
      telemetry.event_source_writes++;
      return {...persisted,record:{...record,id:persisted.eventId,event_key:persisted.eventKey}};
    },
    async saveImpact(eventId,impact) {
      if (impact.impact_type==='NONE') return false;
      if (dryRun) return false;
      const written=await writeImpact(eventId,impact);
      if (written) telemetry.impact_writes++;
      return Boolean(written);
    },
    async send(payload) {
      if (dryRun) return {sent:false};
      const result=await sendMake(payload);
      if (result?.sent) telemetry.make_sends++;
      return result;
    }
  };
}
