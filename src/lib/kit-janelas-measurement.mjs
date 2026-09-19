import { META_MEASUREMENT_CONSENT_VERSION } from './meta-conversions.mjs';

export function kitMeasurement(cookieString = '', now = Date.now(), pageUrl = '') {
  const cookies = Object.fromEntries(cookieString.split(';').map(part => {
    const at = part.indexOf('=');
    return [part.slice(0, at).trim(), part.slice(at + 1)];
  }));
  try {
    const consent = JSON.parse(decodeURIComponent(cookies.gp_cookie_preferences || ''));
    const savedAt = Date.parse(consent.savedAt);
    if (consent.version !== META_MEASUREMENT_CONSENT_VERSION || consent.measurement !== true ||
        !Number.isFinite(savedAt) || savedAt > now + 300000 || savedAt < now - 15552000000) return null;
    let fbc = cookies._fbc || '';
    // O clique continua identificável quando o Pixel não conseguiu criar _fbc.
    // Só ler a ligação depois de validar a autorização de medição.
    try {
      const clickId = new URL(pageUrl).searchParams.get('fbclid') || '';
      if (/^[A-Za-z0-9_-]{1,200}$/.test(clickId) && !fbc.endsWith(`.${clickId}`)) {
        fbc = `fb.1.${now}.${clickId}`;
      }
    } catch { /* Sem URL válido, conservar apenas os cookies existentes. */ }
    return { metaMeasurement: true, metaFbp: cookies._fbp || '', metaFbc: fbc };
  } catch { return null; }
}

export function trackKitRegistration(doc, win, eventId, source = 'kit-trocar-janelas') {
  if (!eventId || !kitMeasurement(doc.cookie) || typeof win.fbq !== 'function') return;
  try {
    win.fbq('track', 'CompleteRegistration', {
      content_name: source, content_category: 'lead_magnet', status: true
    }, { eventID: eventId });
  } catch { /* Uma falha de medição não impede o acesso ao agradecimento. */ }
}
