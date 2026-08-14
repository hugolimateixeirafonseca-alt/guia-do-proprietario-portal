const IMAGE_MIME_TYPES=new Set(['image/png','image/jpeg','image/webp']);

function bytesEqual(bytes,offset,signature) {
  return signature.every((value,index)=>bytes[offset+index]===value);
}

export function isMultipartFormData(contentType) {
  const value=String(contentType||'');
  return /^multipart\/form-data\s*;/iu.test(value)
    && /(?:^|;)\s*boundary=(?:"[^"]+"|[^;\s]+)/iu.test(value);
}

export function detectRasterImageType(input) {
  const bytes=input instanceof Uint8Array ? input : new Uint8Array(input||new ArrayBuffer(0));
  if (bytes.length>=8 && bytesEqual(bytes,0,[0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])) return 'image/png';
  if (bytes.length>=3 && bytesEqual(bytes,0,[0xff,0xd8,0xff])) return 'image/jpeg';
  if (bytes.length>=12
    && bytesEqual(bytes,0,[0x52,0x49,0x46,0x46])
    && bytesEqual(bytes,8,[0x57,0x45,0x42,0x50])) return 'image/webp';
  return '';
}

export function isSupportedRasterImage(input,declaredType) {
  const normalized=String(declaredType||'').toLowerCase();
  return IMAGE_MIME_TYPES.has(normalized) && detectRasterImageType(input)===normalized;
}
