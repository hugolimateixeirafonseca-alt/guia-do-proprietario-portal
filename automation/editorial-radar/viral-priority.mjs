const VIRAL_FRESH_HOURS=36;

function hostOf(value='') {
  try { return new URL(String(value)).hostname.toLowerCase().replace(/^www\./,''); }
  catch { return ''; }
}

function publishedTime(value='') {
  const raw=String(value||'').trim();
  // A data antiga AAAA-MM-DD não tem resolução suficiente para medir velocidade.
  if (!/T\d{2}:\d{2}/.test(raw)) return null;
  const ms=Date.parse(raw);
  return Number.isFinite(ms)?ms:null;
}

export function evaluateViralPriority(event={},sources=[],now=new Date()) {
  const nowMs=now instanceof Date?now.getTime():Date.parse(String(now));
  if (!Number.isFinite(nowMs)) throw new Error('invalid_now');

  const byHost=new Map();
  for (const source of Array.isArray(sources)?sources:[]) {
    const time=publishedTime(source.published_at);
    if (time==null) continue;
    const age=nowMs-time;
    if (age < -5*60*1000 || age > VIRAL_FRESH_HOURS*60*60*1000) continue;
    const host=hostOf(source.article_url)||String(source.source_name||'').trim().toLowerCase();
    if (!host) continue;
    const current=byHost.get(host);
    if (!current || time < current.time) byHost.set(host,{...source,host,time});
  }

  const independent=[...byHost.values()].sort((a,b)=>a.time-b.time);
  const sourceCount=independent.length;
  if (sourceCount<2) return {status:'none',viral_score:0,source_count:sourceCount,span_minutes:null,sources:independent};

  const spanMinutes=Math.max(0,(independent.at(-1).time-independent[0].time)/60000);
  const newsScore=Math.max(0,Math.min(100,Number(event.news_score||0)));
  const freshestHours=Math.max(0,(nowMs-independent.at(-1).time)/3600000);

  let status='none';
  if ((sourceCount>=3 && spanMinutes<=360 && newsScore>=70)
    || (sourceCount>=2 && spanMinutes<=90 && newsScore>=85)) status='viral';
  else if (sourceCount>=2 && spanMinutes<=360 && newsScore>=70) status='probable';

  let viralScore=Math.round(newsScore*0.45)+Math.min(36,sourceCount*12);
  if (spanMinutes<=60) viralScore+=18;
  else if (spanMinutes<=180) viralScore+=12;
  else if (spanMinutes<=360) viralScore+=7;
  if (freshestHours<=6) viralScore+=12;
  else if (freshestHours<=24) viralScore+=7;
  if (status==='viral') viralScore=Math.max(85,viralScore);
  viralScore=Math.max(0,Math.min(100,viralScore));

  return {
    status,
    viral_score:viralScore,
    source_count:sourceCount,
    span_minutes:Math.round(spanMinutes),
    detected_at:new Date(independent.at(-1).time).toISOString(),
    sources:independent.map(source=>({
      source_name:source.source_name||source.host||'Fonte',
      article_url:source.article_url||'',
      published_at:new Date(source.time).toISOString(),
      host:source.host,
      is_official:Boolean(Number(source.is_official||0))
    }))
  };
}
