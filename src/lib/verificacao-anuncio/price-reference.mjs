const SUPPORTED_CITIES = Object.freeze([
  "Aveiro", "Braga", "Coimbra", "Covilhã", "Évora", "Faro", "Guimarães", "Leiria", "Lisboa", "Porto"
]);

export function validatePriceReferenceDataset(dataset) {
  const issues = [];
  if (dataset?.version !== "1.0") issues.push("versão inválida");
  if (dataset?.reference_type !== "arrendamento_habitacao_cidade") issues.push("tipo de referência inválido");
  if (dataset?.unit !== "EUR/m2/mes") issues.push("unidade inválida");
  if (!Array.isArray(dataset?.cities) || dataset.cities.length !== SUPPORTED_CITIES.length) {
    issues.push("a tabela deve conter as 10 cidades previstas");
  }
  const names = new Set();
  for (const entry of dataset?.cities ?? []) {
    names.add(entry.city);
    if (!SUPPORTED_CITIES.includes(entry.city)) issues.push(`cidade não suportada: ${entry.city}`);
    if (!['pending_research', 'active'].includes(entry.status)) issues.push(`estado inválido: ${entry.city}`);
    if (entry.status === "active") {
      if (!(Number.isFinite(entry.euros_per_m2) && entry.euros_per_m2 > 0)) issues.push(`valor inválido: ${entry.city}`);
      if (!/^https:\/\//u.test(entry.source_url ?? "")) issues.push(`fonte inválida: ${entry.city}`);
      if (!/^\d{4}-\d{2}$/u.test(entry.observed_period ?? "")) issues.push(`período inválido: ${entry.city}`);
      if (!/^\d{4}-\d{2}-\d{2}$/u.test(entry.valid_until ?? "")) issues.push(`validade inválida: ${entry.city}`);
    } else if (entry.euros_per_m2 !== null || entry.source_url !== null || entry.observed_period !== null || entry.valid_until !== null) {
      issues.push(`cidade pendente contém valores: ${entry.city}`);
    }
  }
  for (const city of SUPPORTED_CITIES) if (!names.has(city)) issues.push(`falta a cidade: ${city}`);
  if (issues.length) throw new TypeError(issues.join("; "));
  return dataset;
}

export function createPriceReferenceProvider(dataset) {
  validatePriceReferenceDataset(dataset);
  const entries = new Map(dataset.cities.map((entry) => [entry.city.toLocaleLowerCase("pt-PT"), entry]));
  return {
    async lookup({ city, facts = [] }) {
      const entry = entries.get(String(city ?? "").trim().toLocaleLowerCase("pt-PT"));
      if (!entry || entry.status !== "active") return null;
      const priceFact = facts.find((fact) => fact.campo === "preco_mensal" && fact.presente);
      const areaFact = facts.find((fact) => fact.campo === "area" && fact.presente);
      const parseNumber = (value) => {
        const normalized = String(value ?? "").replace(/[^\d,.]/gu, "").replace(/\.(?=\d{3}(?:\D|$))/gu, "").replace(",", ".");
        const number = Number(normalized);
        return Number.isFinite(number) && number > 0 ? number : null;
      };
      const monthlyPrice = parseNumber(priceFact?.valor);
      const area = parseNumber(areaFact?.valor);
      if (!monthlyPrice || !area) return null;
      return {
        id: `preco_${entry.city.toLocaleLowerCase("pt-PT").normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/\s+/gu, "_")}`,
        city: entry.city,
        euros_per_m2: entry.euros_per_m2,
        listing_euros_per_m2: Number((monthlyPrice / area).toFixed(2)),
        comparison_state: "pending_threshold_validation",
        source_url: entry.source_url,
        observed_period: entry.observed_period,
        valid_until: entry.valid_until,
        reference_type: dataset.reference_type,
        unit: dataset.unit
      };
    }
  };
}

export { SUPPORTED_CITIES };
