function uniqueFacts(values=[]) {
  return [...new Set((Array.isArray(values)?values:[])
    .map(value=>String(value||'').replace(/\s+/g,' ').trim())
    .filter(value=>value.length>=18))];
}

export function publicationEvidenceStatus(event={}) {
  const facts=uniqueFacts(event.key_facts);
  const summary=String(event.summary||event.verified_summary||'').replace(/\s+/g,' ').trim();
  const verified=event.validation_status==='verified' && Number(event.validation_confidence||0)>=75;
  const ready=verified && facts.length>=4 && summary.length>=100;
  const reasons=[];
  if (!verified) reasons.push('factual_validation_not_verified');
  if (facts.length<4) reasons.push(`verified_facts:${facts.length}`);
  if (summary.length<100) reasons.push(`summary_chars:${summary.length}`);
  return {ready,reasons,facts_count:facts.length,summary_chars:summary.length};
}
