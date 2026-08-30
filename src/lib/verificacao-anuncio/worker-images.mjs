import decodeJpeg, { init as initJpegDecode } from "@jsquash/jpeg/decode";
import encodeJpeg, { init as initJpegEncode } from "@jsquash/jpeg/encode";
import decodePng, { init as initPngDecode } from "@jsquash/png/decode";
import decodeWebp, { init as initWebpDecode } from "@jsquash/webp/decode";
import JPEG_DEC_WASM from "../../../node_modules/@jsquash/jpeg/codec/dec/mozjpeg_dec.wasm";
import JPEG_ENC_WASM from "../../../node_modules/@jsquash/jpeg/codec/enc/mozjpeg_enc.wasm";
import PNG_DEC_WASM from "../../../node_modules/@jsquash/png/codec/pkg/squoosh_png_bg.wasm";
import WEBP_DEC_WASM from "../../../node_modules/@jsquash/webp/codec/dec/webp_dec.wasm";
import { computeDHash, computePHash } from "./perceptual-hash.mjs";
import { normalizedRegionToPixels } from "./photo-regions.mjs";

// A Cloudflare só permite preparar módulos Wasm durante a inicialização do
// Worker. Guardamos a promessa para que todas as mensagens reutilizem os codecs.
const codecsReady = Promise.all([
  initJpegDecode(JPEG_DEC_WASM),
  initJpegEncode(JPEG_ENC_WASM),
  initPngDecode(PNG_DEC_WASM),
  initWebpDecode(WEBP_DEC_WASM)
]);

const toBase64 = (bytes) => {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
};

const toBase64Url = (bytes) => toBase64(bytes).replace(/\+/gu, "-").replace(/\//gu, "_").replace(/=+$/gu, "");

async function decodeSource(source) {
  await codecsReady;
  const bytes = source.bytes instanceof ArrayBuffer
    ? source.bytes
    : source.bytes.buffer.slice(source.bytes.byteOffset, source.bytes.byteOffset + source.bytes.byteLength);
  if (source.contentType === "image/jpeg") return decodeJpeg(bytes);
  if (source.contentType === "image/png") return decodePng(bytes);
  if (source.contentType === "image/webp") return decodeWebp(bytes);
  throw new TypeError("Formato de imagem não suportado pelo processador.");
}

function cropAndResize(image, crop, maximumSide = 1280) {
  const scale = Math.min(1, maximumSide / Math.max(crop.width, crop.height));
  const width = Math.max(1, Math.round(crop.width * scale));
  const height = Math.max(1, Math.round(crop.height * scale));
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    const sourceY = crop.top + Math.min(crop.height - 1, Math.floor(y / scale));
    for (let x = 0; x < width; x += 1) {
      const sourceX = crop.left + Math.min(crop.width - 1, Math.floor(x / scale));
      const sourceIndex = (sourceY * image.width + sourceX) * 4;
      const targetIndex = (y * width + x) * 4;
      data[targetIndex] = image.data[sourceIndex];
      data[targetIndex + 1] = image.data[sourceIndex + 1];
      data[targetIndex + 2] = image.data[sourceIndex + 2];
      data[targetIndex + 3] = image.data[sourceIndex + 3];
    }
  }
  return { data, width, height };
}

function sampledGrayscale(image, width, height) {
  const grayscale = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    const sourceY = Math.min(image.height - 1, Math.floor(((y + 0.5) / height) * image.height));
    for (let x = 0; x < width; x += 1) {
      const sourceX = Math.min(image.width - 1, Math.floor(((x + 0.5) / width) * image.width));
      const index = (sourceY * image.width + sourceX) * 4;
      grayscale[y * width + x] = Math.round(
        image.data[index] * 0.299 + image.data[index + 1] * 0.587 + image.data[index + 2] * 0.114
      );
    }
  }
  return grayscale;
}

export function createWorkerPhotoProcessor() {
  return {
    async prepare({ images, regions }) {
      const decoded = new Map();
      const prepared = [];
      for (const [index, region] of regions.entries()) {
        const source = images[region.fonte_imagem - 1];
        if (!source) continue;
        let image = decoded.get(region.fonte_imagem);
        if (!image) {
          image = await decodeSource(source);
          if (image.width * image.height > 24_000_000) throw new Error("image_dimensions_too_large");
          decoded.set(region.fonte_imagem, image);
        }
        const crop = normalizedRegionToPixels(region, image.width, image.height);
        const cropped = cropAndResize(image, crop);
        const encoded = new Uint8Array(await encodeJpeg(cropped, { quality: 82 }));
        const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", encoded));
        prepared.push({
          id: `foto_${region.fonte_imagem}_${index + 1}`,
          sourceImage: region.fonte_imagem,
          crop,
          image: encoded,
          base64: toBase64(encoded),
          dataUrl: `data:image/jpeg;base64,${toBase64(encoded)}`,
          sha256: toBase64Url(digest),
          phash: computePHash(sampledGrayscale(cropped, 32, 32), 32, 32),
          dhash: computeDHash(sampledGrayscale(cropped, 9, 8), 9, 8)
        });
      }
      return prepared;
    }
  };
}
