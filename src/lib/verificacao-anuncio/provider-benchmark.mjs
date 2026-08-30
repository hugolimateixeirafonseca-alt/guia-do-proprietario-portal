const EXPECTED_CASES = Object.freeze({
  A: "correspondencia_mesmo_contexto",
  B: "correspondencia_contexto_diferente",
  C: "correspondencia_inconclusiva",
  D: "sem_correspondencia_encontrada",
  E: "pesquisa_indisponivel"
});

export function evaluateProviderBenchmark(records) {
  if (!Array.isArray(records) || records.length === 0) throw new TypeError("Benchmark sem resultados.");
  const byProvider = new Map();
  for (const record of records) {
    if (!EXPECTED_CASES[record.caseId]) throw new TypeError(`Caso desconhecido: ${record.caseId}`);
    if (!byProvider.has(record.provider)) byProvider.set(record.provider, []);
    byProvider.get(record.provider).push(record);
  }
  return [...byProvider.entries()].map(([provider, entries]) => {
    const correct = entries.filter((entry) => entry.actualState === EXPECTED_CASES[entry.caseId]).length;
    const falseStrongMatches = entries.filter((entry) =>
      entry.caseId === "C" && ["correspondencia_mesmo_contexto", "correspondencia_contexto_diferente"].includes(entry.actualState)
    ).length;
    const completed = entries.filter((entry) => entry.actualState !== "pesquisa_indisponivel").length;
    const averageLatencyMs = entries.reduce((total, entry) => total + Number(entry.latencyMs ?? 0), 0) / entries.length;
    const totalCostUsd = entries.reduce((total, entry) => total + Number(entry.costUsd ?? 0), 0);
    return {
      provider,
      cases: entries.length,
      accuracy: correct / entries.length,
      availability: completed / entries.length,
      falseStrongMatches,
      averageLatencyMs,
      totalCostUsd,
      passesSafetyGate: falseStrongMatches === 0 && correct === entries.length
    };
  }).sort((a, b) =>
    Number(b.passesSafetyGate) - Number(a.passesSafetyGate)
    || b.accuracy - a.accuracy
    || b.availability - a.availability
    || a.totalCostUsd - b.totalCostUsd
    || a.averageLatencyMs - b.averageLatencyMs
  );
}

export { EXPECTED_CASES };

