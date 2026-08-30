import assert from "node:assert/strict";
import test from "node:test";
import { createPhotoProcessor, normalizedRegionToPixels } from "../../src/lib/verificacao-anuncio/photo-regions.mjs";

test("converte a região normalizada sem ultrapassar os limites da imagem", () => {
  assert.deepEqual(
    normalizedRegionToPixels({ x: 250, y: 100, largura: 500, altura: 600 }, 1200, 800),
    { left: 300, top: 80, width: 600, height: 480 }
  );
});

test("o processador mantém a origem e os três fingerprints", async () => {
  const processor = createPhotoProcessor({
    inspectImage: async () => ({ width: 1000, height: 500 }),
    cropImage: async (_source, crop) => ({ crop }),
    fingerprintImage: async () => ({ sha256: "sha", phash: "0".repeat(16), dhash: "f".repeat(16) })
  });
  const [result] = await processor.prepare({
    images: [{ id: "upload" }],
    regions: [{ fonte_imagem: 1, x: 0, y: 0, largura: 500, altura: 500 }]
  });
  assert.equal(result.sourceImage, 1);
  assert.equal(result.crop.width, 500);
  assert.equal(result.phash.length, 16);
});

