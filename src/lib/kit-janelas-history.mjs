// Ponte de leitura durante a separação. Escritas exclusivamente na base Janelas.
const columns = ['occurred_at','source','event','field_name','field_value','status','error_code','consent_version','session_hash','request_id','ip_hash'];
export async function copyLegacyKitEvents(legacy, destination, requestId = '') {
  const cursor = requestId ? 0 : (await destination.prepare('SELECT last_legacy_id FROM kit_history_import WHERE id=1').first())?.last_legacy_id || 0;
  const fields = ['id',...columns].map(key => `'${key}',${key}`).join(',');
  // JSON agrupa a página para usar a interface first já partilhada pelos handlers.
  const result = await legacy.prepare(`SELECT json_group_array(json_object(${fields})) AS events FROM (
    SELECT * FROM kit_events WHERE source='kit-trocar-janelas' AND id > ?
    AND (? = '' OR request_id = ?) ORDER BY id LIMIT 100
  )`).bind(cursor,requestId,requestId).first();
  const events = JSON.parse(result?.events || '[]');
  for (const event of events) {
    if (event.source !== 'kit-trocar-janelas') throw new Error('invalid_legacy_source');
    await destination.prepare(`INSERT OR IGNORE INTO kit_events (legacy_event_id,${columns.join(',')}) VALUES (${['?',...columns.map(()=>'?')].join(',')})`)
      .bind(event.id,...columns.map(key=>event[key] ?? null)).run();
  }
  // Só avançar depois de concluir toda a página. Uma interrupção pode ser repetida.
  if (!requestId && events.length) {
    await destination.prepare('UPDATE kit_history_import SET last_legacy_id=MAX(last_legacy_id,?) WHERE id=1')
      .bind(events.at(-1).id).run();
  }
  return events.length;
}
