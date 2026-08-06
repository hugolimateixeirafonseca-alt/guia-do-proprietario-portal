import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const fonte = z.object({ nome: z.string().min(1), url: z.url() });
const perguntaRapida = z.object({
  pergunta: z.string().min(1),
  resposta: z.string().min(1)
});
const custo = z.object({
  item: z.string().min(1),
  intervalo: z.string().regex(/\s+a\s/i, "O custo deve ser apresentado como intervalo, por exemplo «4 € a 16 € por m²»."),
  nota: z.string().min(1)
});

const artigos = defineCollection({
  loader: glob({ base: "./src/content/artigos", pattern: "**/*.{md,mdx}" }),
  schema: z.object({
    titulo: z.string().min(1),
    descricao: z.string().min(80).max(180),
    resposta_rapida: z.string().min(1),
    exemplo: z.object({
      titulo: z.string().min(1),
      texto: z.string().min(1)
    }).optional(),
    nivel: z.enum(["essencial", "detalhado"]),
    par: z.string().min(1).optional(),
    perguntas_rapidas: z.array(perguntaRapida).min(3).max(5).optional(),
    custos: z.object({
      titulo: z.string().min(1),
      itens: z.array(custo).min(1)
    }).optional(),
    pilar: z.enum(["vender", "impostos", "arrendar", "condominio", "casa"]),
    publicado: z.coerce.date(),
    chegada: z.coerce.date().optional(),
    revisto: z.coerce.date(),
    temas: z.array(z.string().min(2)).max(8).optional(),
    autor: z.literal("redacao"),
    revisao_profissional: z.string(),
    fontes: z.array(fonte).min(1),
    aviso: z.enum(["fiscal", "juridico", "financeiro", "nenhum"]),
    rascunho: z.boolean().default(false),
    destaque: z.boolean().default(false),
    imagem_og: z.string().default("auto"),
    imagem_capa: z.string().min(1).optional(),
    imagem_alt: z.string().min(1).optional()
  }).superRefine((artigo, ctx) => {
    if (artigo.imagem_capa && artigo.imagem_capa !== "auto" && !artigo.imagem_alt) {
      ctx.addIssue({ code: "custom", path: ["imagem_alt"], message: "Uma imagem própria precisa de texto alternativo descritivo." });
    }
    if (artigo.nivel === "essencial" && !artigo.exemplo) {
      ctx.addIssue({ code: "custom", path: ["exemplo"], message: "Um artigo essencial precisa de um exemplo com números." });
    }
    if (artigo.nivel === "essencial" && !artigo.perguntas_rapidas) {
      ctx.addIssue({ code: "custom", path: ["perguntas_rapidas"], message: "Um artigo essencial precisa de 3 a 5 perguntas rápidas." });
    }
    if (artigo.pilar === "casa" && artigo.nivel !== "essencial") {
      ctx.addIssue({ code: "custom", path: ["nivel"], message: "Todos os artigos de Casa e obras têm de ser essenciais." });
    }
  })
});

const notas = defineCollection({
  loader: glob({ base: "./src/content/notas", pattern: "**/*.{md,mdx}" }),
  schema: z.object({
    titulo: z.string().min(1),
    resumo: z.string().min(1).max(180),
    data: z.coerce.date(),
    fonte_nome: z.string().min(1),
    fonte_url: z.url(),
    pilar: z.enum(["vender", "impostos", "arrendar", "condominio", "casa"]).optional()
  })
});

export const collections = { artigos, notas };
