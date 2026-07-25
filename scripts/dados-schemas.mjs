import { z } from "astro/zod";

const dataIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const codigoIne = z.string().regex(/^\d{4}$/);
const cabecalho = {
  fonte: z.string().min(2),
  fonte_url: z.string().regex(/^https:\/\/\S+$/),
  periodo_referencia: z.string().min(2),
  extraido_em: dataIso,
  notas: z.string().min(10)
};

export const concelhoSchema = z.object({
  slug,
  nome: z.string().min(2),
  distrito: z.string().min(2),
  codigo_ine: codigoIne,
  nuts3: z.string().min(2),
  nuts3_codigo: z.string().min(2)
});

export const concelhosSchema = z.object({
  ...cabecalho,
  dados: z.array(concelhoSchema).length(308)
});

const deducaoAgregado = z.object({
  "1": z.number().nonnegative().optional(),
  "2": z.number().nonnegative().optional(),
  "3": z.number().nonnegative().optional()
});

export const imiSchema = z.object({
  ...cabecalho,
  dados: z.array(z.object({
    slug,
    nome: z.string().min(2),
    distrito: z.string().min(2),
    codigo_ine: codigoIne,
    taxa_urbana: z.number().min(0.003).max(0.005).nullable(),
    taxa_urbana_ano_anterior: z.number().min(0.003).max(0.005).nullable(),
    taxa_rustica: z.number().min(0).max(0.1).nullable(),
    deducao_agregado: deducaoAgregado,
    ajustes_freguesia: z.array(z.object({
      freguesia: z.string().min(1),
      tipo: z.string().min(1),
      valor: z.number()
    })).default([]),
    estado: z.enum(["publicada", "nao_publicada"])
  })).length(308)
});

const leituraPreco = z.object({
  periodo: z.string().regex(/^[1-4]T\d{4}$/),
  valor: z.number().int().positive().max(20000).nullable()
});

export const precosSchema = z.object({
  ...cabecalho,
  indicador: z.literal("0012234"),
  dados: z.array(z.object({
    slug,
    nome: z.string().min(2),
    codigo_ine: codigoIne,
    nuts3: z.string().min(2),
    valor_atual: z.number().int().positive().max(20000).nullable(),
    periodo_atual: z.string().regex(/^[1-4]T\d{4}$/),
    variacao_homologa: z.number().min(-1).max(10).nullable(),
    serie: z.array(leituraPreco).length(4),
    fallback_nuts3: z.boolean()
  })).length(308)
});

export function validarConjuntos({ concelhos, imi, precos }) {
  const problemas = [];
  const validar = (schema, valor, nome) => {
    const resultado = schema.safeParse(valor);
    if (!resultado.success) {
      for (const erro of resultado.error.issues) problemas.push(`${nome}.${erro.path.join(".")}: ${erro.message}`);
    }
  };
  validar(concelhosSchema, concelhos, "concelhos");
  validar(imiSchema, imi, "imi");
  validar(precosSchema, precos, "precos");
  if (problemas.length) return problemas;

  for (const [nome, dados] of [["concelhos", concelhos.dados], ["imi", imi.dados], ["precos", precos.dados]]) {
    const slugs = dados.map((item) => item.slug);
    const codigos = dados.map((item) => item.codigo_ine);
    if (new Set(slugs).size !== slugs.length) problemas.push(`${nome}: existem slugs duplicados`);
    if (new Set(codigos).size !== codigos.length) problemas.push(`${nome}: existem códigos INE duplicados`);
  }
  const referencia = new Set(concelhos.dados.map((item) => `${item.slug}:${item.codigo_ine}`));
  for (const [nome, dados] of [["imi", imi.dados], ["precos", precos.dados]]) {
    for (const item of dados) if (!referencia.has(`${item.slug}:${item.codigo_ine}`)) problemas.push(`${nome}: chave sem correspondência ${item.slug}:${item.codigo_ine}`);
  }
  return problemas;
}
