export function resolveDuplicateTarget(history=[],decision={}) {
  const duplicateId=String(decision.duplicate_event_id||'').trim();
  if (duplicateId) {
    const byId=history.find(item=>String(item.id||'')===duplicateId);
    if (byId) return byId;
  }

  const eventKey=String(decision.event_key||'').trim();
  if (eventKey) {
    const byKey=history.find(item=>String(item.event_key||'')===eventKey);
    if (byKey) return byKey;
  }

  return null;
}
