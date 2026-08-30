import assert from "node:assert/strict";
import test from "node:test";
import {
  comparePerceptualHashes,
  computeDHash,
  deduplicatePhotos,
  hammingDistance64
} from "../../src/lib/verificacao-anuncio/perceptual-hash.mjs";
import { photo } from "./fixtures.mjs";

test("calcula distância de Hamming e um dHash determinístico", () => {
  assert.equal(hammingDistance64("0000000000000000", "000000000000000f"), 4);
  const pixels = Array.from({ length: 72 }, (_, index) => index % 9);
  assert.equal(computeDHash(pixels, 9, 8), "0000000000000000");
});

test("classifica hashes iguais e remove duplicados exatos ou percetuais", () => {
  assert.equal(comparePerceptualHashes(photo("a"), photo("b")).decision, "duplicate");
  const result = deduplicatePhotos([
    photo("a"),
    photo("b", { sha256: "sha-a", phash: "ffffffffffffffff", dhash: "ffffffffffffffff" }),
    photo("c", { phash: "0000000000000001" })
  ]);
  assert.deepEqual(result.unique.map(({ id }) => id), ["a"]);
  assert.equal(result.duplicates[0].reason, "sha256");
  assert.equal(result.duplicates[1].reason, "perceptual");
});

