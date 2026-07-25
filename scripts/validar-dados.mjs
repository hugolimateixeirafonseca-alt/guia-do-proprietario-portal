import path from "node:path";
import { PROJECT_ROOT, lerJson } from "./lib/dados-utils.mjs";
import { validarConjuntos } from "./dados-schemas.mjs";

const dadosDir = path.join(PROJECT_ROOT, "src", "dados");
const [concelhos, imi, precos] = await Promise.all([
  lerJson(path.join(dadosDir, "concelhos.json")),
  lerJson(path.join(dadosDir, "imi-concelhos.json")),
  lerJson(path.join(dadosDir, "precos-concelhos.json"))
]);
const problemas = validarConjuntos({ concelhos, imi, precos });
if (problemas.length) {
  console.error("Validação dos dados falhou:");
  for (const problema of problemas.slice(0, 30)) console.error(`- ${problema}`);
  if (problemas.length > 30) console.error(`- e mais ${problemas.length - 30} problemas`);
  process.exit(1);
}
console.log("Dados validados: 308 municípios nos três ficheiros, sem chaves duplicadas.");

