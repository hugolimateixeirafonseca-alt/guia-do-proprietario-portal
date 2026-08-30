import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { evaluateProviderBenchmark } from "../src/lib/verificacao-anuncio/provider-benchmark.mjs";
import { validatePriceReferenceDataset } from "../src/lib/verificacao-anuncio/price-reference.mjs";
import { validateActionConfiguration, validateClassification, validateExtraction } from "../src/lib/verificacao-anuncio/validate.mjs";

const [, , command, inputPath, evidencePath] = process.argv;

const readJson = async (path) => JSON.parse(await readFile(resolve(path), "utf8"));

try {
  if (command === "validate-config") {
    validateActionConfiguration();
  } else if (command === "validate-extraction" && inputPath) {
    validateExtraction(await readJson(inputPath));
  } else if (command === "validate-final" && inputPath) {
    const evidence = evidencePath ? await readJson(evidencePath) : [];
    validateClassification(await readJson(inputPath), evidence.map((item) => item.id));
  } else if (command === "validate-prices" && inputPath) {
    validatePriceReferenceDataset(await readJson(inputPath));
  } else if (command === "benchmark-providers" && inputPath) {
    process.stdout.write(`${JSON.stringify(evaluateProviderBenchmark(await readJson(inputPath)), null, 2)}\n`);
    process.exit(0);
  } else {
    throw new Error("Uso: validate-config | validate-extraction <ficheiro> | validate-final <ficheiro> [evidencia] | validate-prices <ficheiro> | benchmark-providers <ficheiro>");
  }
  process.stdout.write("Validação concluída.\n");
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
