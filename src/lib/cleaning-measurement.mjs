const VERSION = '2026-09-01-1';
export function measurementChoice(cookie = '', now = Date.now()) {
  const raw = String(cookie).split(';').map(v => v.trim()).find(v => v.startsWith('gp_cookie_preferences='))?.slice('gp_cookie_preferences='.length);
  if (!raw) return 'unset';
  try {
    const value = JSON.parse(decodeURIComponent(raw)), at = Date.parse(value.savedAt);
    if (value.version !== VERSION || typeof value.measurement !== 'boolean' || !Number.isFinite(at) || at > now + 300000 || at < now - 15552000000) return 'invalid';
    return value.measurement ? 'accepted' : 'refused';
  } catch { return 'invalid'; }
}
export function cleaningPixelState(browser) { return typeof browser.fbq === 'function' ? 'callable' : 'missing'; }
// An invocation can queue an event. It is never evidence of delivery to Meta.
export function trackCleaningLead(browser, eventId, premium = false) {
  return trackCleaningEvent(browser, eventId, 'track', 'Lead', premium ? 'servicos-limpeza-premium' : 'servicos-limpeza');
}
export function trackSelectedCleaningQuote(browser, eventId) {
  return trackCleaningEvent(browser, eventId, 'trackCustom', 'OrcamentoSelecionado');
}
function trackCleaningEvent(browser, eventId, method, name, contentName = 'servicos-limpeza') {
  if (measurementChoice(browser.document.cookie) !== 'accepted') return 'skipped_consent';
  if (cleaningPixelState(browser) !== 'callable') return 'unavailable';
  try { browser.fbq(method, name, {content_name:contentName}, {eventID:eventId}); return 'invoked'; }
  catch { return 'exception'; }
}