// Keep campaign attribution separate from the landing identifier and consent record.
export function cleaningAttribution(pageUrl) {
  try {
    const url = new URL(typeof pageUrl === 'string' ? pageUrl : '');
    const value = name => (url.searchParams.get(name) || '').trim().slice(0, 500) || null;
    return {utm_content:value('utm_content'), utm_campaign:value('utm_campaign')};
  } catch {
    return {utm_content:null, utm_campaign:null};
  }
}
