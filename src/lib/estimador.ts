export function estimarImovel(area: number, tipo: "apartamento" | "moradia", valorM2: number) {
  const fatorTipo = tipo === "moradia" ? 0.92 : 1;
  const central = area * valorM2 * fatorTipo;
  return { minimo: Math.round(central * 0.88 / 5000) * 5000, maximo: Math.round(central * 1.12 / 5000) * 5000, central };
}

export function estimarValorLiquido(input: { area: number; tipo: "apartamento" | "moradia"; valorM2: number; comissao: number; credito: number }) {
  const imovel = estimarImovel(input.area, input.tipo, input.valorM2);
  const taxaComIva = input.comissao / 100 * 1.23;
  const outrosCustos = 750;
  return {
    imovel,
    minimo: Math.max(0, imovel.minimo * (1 - taxaComIva) - input.credito - outrosCustos),
    maximo: Math.max(0, imovel.maximo * (1 - taxaComIva) - input.credito - outrosCustos)
  };
}

export function lerNumeroPt(valor: string) {
  const limpo = valor.trim().replace(/\s/g, "");
  const normalizado = limpo.includes(",")
    ? limpo.replace(/\./g, "").replace(",", ".")
    : limpo;
  return Number(normalizado);
}

export function calcularImi(input: { vpt: number; taxa: number; deducao?: number }) {
  const valorAntesDeducao = Math.max(0, input.vpt * input.taxa);
  const deducaoAplicada = Math.min(valorAntesDeducao, Math.max(0, input.deducao ?? 0));
  return {
    valorAntesDeducao,
    deducaoAplicada,
    total: valorAntesDeducao - deducaoAplicada
  };
}

export function calcularPrestacoesImi(total: number) {
  const meses = total <= 100 ? ["maio"] : total <= 500 ? ["maio", "novembro"] : ["maio", "agosto", "novembro"];
  const totalCentimos = Math.round(Math.max(0, total) * 100);
  const base = Math.floor(totalCentimos / meses.length);
  const resto = totalCentimos % meses.length;
  return meses.map((mes, indice) => ({
    mes,
    valor: (base + (indice < resto ? 1 : 0)) / 100
  }));
}
