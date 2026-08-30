export const MAX_UPLOAD_FILES = 8;
export const MAX_UPLOAD_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_UPLOAD_TOTAL_BYTES = 40 * 1024 * 1024;

const IMAGE_SIGNATURES = Object.freeze({
  "image/jpeg": {
    extension: "jpg",
    matches: (bytes) => bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  },
  "image/png": {
    extension: "png",
    matches: (bytes) => bytes.length >= 8
      && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
      && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  },
  "image/webp": {
    extension: "webp",
    matches: (bytes) => bytes.length >= 12
      && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF"
      && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  }
});

export class IntakeValidationError extends Error {
  constructor(code, status = 400) {
    super(code);
    this.name = "IntakeValidationError";
    this.code = code;
    this.status = status;
  }
}

export function normalizeCity(value) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/gu, " ").slice(0, 100);
}

export function validateCity(value) {
  const city = normalizeCity(value);
  if (city.length < 2 || /[<>\u0000-\u001f]/u.test(city)) {
    throw new IntakeValidationError("invalid_city");
  }
  return city;
}

export function validateAccessToken(value) {
  const token = typeof value === "string" ? value.trim() : "";
  if (!/^[A-Za-z0-9_-]{43,128}$/u.test(token)) {
    throw new IntakeValidationError("invalid_access_token", 404);
  }
  return token;
}

export function validateUploadCount(files) {
  if (!Array.isArray(files) || files.length === 0) {
    throw new IntakeValidationError("captures_required");
  }
  if (files.length > MAX_UPLOAD_FILES) {
    throw new IntakeValidationError("too_many_captures", 413);
  }
  return files;
}

export async function inspectImageFile(file) {
  if (!file || typeof file.arrayBuffer !== "function" || typeof file.size !== "number") {
    throw new IntakeValidationError("invalid_capture");
  }
  if (file.size <= 0) throw new IntakeValidationError("empty_capture");
  if (file.size > MAX_UPLOAD_FILE_BYTES) throw new IntakeValidationError("capture_too_large", 413);

  const declaredType = String(file.type || "").toLowerCase();
  const signature = IMAGE_SIGNATURES[declaredType];
  if (!signature) throw new IntakeValidationError("unsupported_capture_type", 415);

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!signature.matches(bytes)) throw new IntakeValidationError("capture_type_mismatch", 415);
  return { bytes, contentType: declaredType, extension: signature.extension, size: bytes.byteLength };
}

export async function validateUploadFiles(files) {
  validateUploadCount(files);
  const inspected = [];
  let totalBytes = 0;
  for (const file of files) {
    const image = await inspectImageFile(file);
    totalBytes += image.size;
    if (totalBytes > MAX_UPLOAD_TOTAL_BYTES) {
      throw new IntakeValidationError("captures_too_large", 413);
    }
    inspected.push(image);
  }
  return inspected;
}

