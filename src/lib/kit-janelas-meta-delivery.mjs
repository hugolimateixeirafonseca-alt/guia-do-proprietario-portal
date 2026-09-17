import { sendMetaConversion, MetaConversionError } from './meta-conversions.mjs';

// Recuperação limitada ao pedido atual, sem guardar contactos numa fila.
// O mesmo ID e instante permitem à Meta deduplicar uma resposta perdida.
export async function deliverKitRegistration(options, sleep = ms => new Promise(resolve => setTimeout(resolve, ms))) {
  const payload = { ...options, eventTime: options.eventTime ?? Math.floor(Date.now() / 1000) };
  for (const attempt of [1, 2, 3]) {
    try {
      const result = await sendMetaConversion(payload);
      if (result.sent && result.eventsReceived !== 1) {
        throw new MetaConversionError('not_accepted', true);
      }
      return { ...result, attempts: attempt };
    } catch (error) {
      const retryable = error instanceof MetaConversionError ? error.retryable
        : error instanceof TypeError || ['TimeoutError', 'AbortError'].includes(error?.name);
      if (!retryable || attempt >= 3) throw error;
      await sleep(attempt === 1 ? 500 : 1500);
    }
  }
  throw new Error('meta_retry_limit');
}

export function kitMetaFailureCode(error) {
  if (error instanceof MetaConversionError) {
    const code = String(error.code);
    return /^\d{1,6}$/.test(code) || code === 'not_accepted' ? `meta_${code}` : 'meta_rejected';
  }
  if (['TimeoutError', 'AbortError'].includes(error?.name)) return 'meta_timeout';
  if (error instanceof TypeError) return 'meta_network';
  return 'meta_registration_failed';
}
