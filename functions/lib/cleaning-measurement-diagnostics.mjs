import {measurementChoice} from '../../src/lib/cleaning-measurement.mjs';
// Operational metadata only: no contact details, URL, cookie values or ad identifiers.
export async function recordCleaningMeasurement(env, request, evidence, body) {
  try {
    const pixel = ['callable','missing'].includes(body.measurementPixelState) ? body.measurementPixelState : 'unknown';
    const source = body.source === 'guia_limpeza_alojamento_local' ? 'alojamento-local' : 'geral';
    const result = await env.CONSENT_ARCHIVE_DB.prepare(`INSERT INTO cleaning_measurement_diagnostics
      (event_key,created_at,source,measurement_choice,browser_pixel_state) VALUES (?,?,?,?,?) ON CONFLICT(event_key) DO NOTHING`)
      .bind(evidence.id,evidence.received_at,source,measurementChoice(request.headers.get('Cookie') || ''),pixel).run();
    if (!result.success) throw Error('diagnostic_write');
  } catch { console.warn('cleaning_measurement_diagnostic_unavailable'); }
}