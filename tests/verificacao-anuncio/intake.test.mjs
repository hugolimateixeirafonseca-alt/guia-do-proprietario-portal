import assert from "node:assert/strict";
import test from "node:test";
import {
  IntakeValidationError,
  MAX_UPLOAD_FILES,
  validateAccessToken,
  validateCity,
  validateUploadFiles
} from "../../src/lib/verificacao-anuncio/intake.mjs";

const jpeg = () => new File([new Uint8Array([0xff, 0xd8, 0xff, 0xdb, 0x00])], "captura.jpg", { type: "image/jpeg" });
const png = () => new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], "captura.png", { type: "image/png" });

test("aceita entre uma e oito capturas válidas sem impor um mínimo artificial", async () => {
  assert.equal((await validateUploadFiles([jpeg()])).length, 1);
  assert.equal((await validateUploadFiles(Array.from({ length: MAX_UPLOAD_FILES }, png))).length, 8);
});

test("recusa mais de oito capturas", async () => {
  await assert.rejects(validateUploadFiles(Array.from({ length: 9 }, jpeg)), (error) =>
    error instanceof IntakeValidationError && error.code === "too_many_captures" && error.status === 413);
});

test("confirma o conteúdo real da imagem em vez de confiar apenas no tipo declarado", async () => {
  const disguised = new File(["não é uma imagem"], "captura.jpg", { type: "image/jpeg" });
  await assert.rejects(validateUploadFiles([disguised]), (error) =>
    error instanceof IntakeValidationError && error.code === "capture_type_mismatch");
});

test("normaliza a cidade e rejeita markup", () => {
  assert.equal(validateCity("  Vila   Nova de Gaia "), "Vila Nova de Gaia");
  assert.throws(() => validateCity("<Porto>"), (error) =>
    error instanceof IntakeValidationError && error.code === "invalid_city");
});

test("exige um token opaco com pelo menos 256 bits codificados", () => {
  assert.equal(validateAccessToken("a".repeat(43)), "a".repeat(43));
  assert.throws(() => validateAccessToken("token-curto"), (error) =>
    error instanceof IntakeValidationError && error.status === 404);
});

