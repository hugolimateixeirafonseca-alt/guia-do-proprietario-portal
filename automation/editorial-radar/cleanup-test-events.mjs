const APPLY=process.argv.includes('--apply');
const REQUIRED=['CF_ACCOUNT_ID','CF_D1_DATABASE_ID','CF_D1_API_TOKEN'];
for (const key of REQUIRED) if (!process.env[key]) throw new Error(`Missing required environment variable: ${key}`);

const cutoff='2026-08-13T00:00:00Z';
const condition='e.published = 0 AND e.make_sent_at IS NULL AND e.first_seen_at >= ?';

async function d1(sql,params=[]) {
  const url=`https://api.cloudflare.com/client/v4/accounts/${process.env.CF_ACCOUNT_ID}/d1/database/${process.env.CF_D1_DATABASE_ID}/query`;
  const response=await fetch(url,{
    method:'POST',
    headers:{Authorization:`Bearer ${process.env.CF_D1_API_TOKEN}`,'Content-Type':'application/json'},
    body:JSON.stringify({sql,params})
  });
  const data=await response.json();
  if (!response.ok || !data.success || data.errors?.length) throw new Error(`D1 query failed: ${JSON.stringify(data.errors||data).slice(0,1200)}`);
  return data.result?.[0]||{};
}

const report=await d1(`
  SELECT e.id AS event_id,e.event_key,e.title,e.first_seen_at,
         COALESCE(group_concat(s.article_url, ' | '),'') AS source_urls
  FROM events e
  LEFT JOIN event_sources s ON s.event_id=e.id
  WHERE ${condition}
  GROUP BY e.id,e.event_key,e.title,e.first_seen_at
  ORDER BY e.first_seen_at,e.id
`,[cutoff]);
const events=report.results||[];
console.log(JSON.stringify({stage:'cleanup_test_events_report',apply:APPLY,cutoff,count:events.length,events},null,2));

if (APPLY && events.length) {
  const guardedIds=`SELECT id FROM events e WHERE ${condition}`;
  await d1(`DELETE FROM content_impacts WHERE event_id IN (${guardedIds})`,[cutoff]);
  await d1(`DELETE FROM event_sources WHERE event_id IN (${guardedIds})`,[cutoff]);
  const deleted=await d1(`DELETE FROM events AS e WHERE ${condition}`,[cutoff]);
  console.log(JSON.stringify({stage:'cleanup_test_events_apply',deleted:deleted.meta?.changes||0}));
}
