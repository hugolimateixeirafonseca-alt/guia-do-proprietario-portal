import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const input = process.argv[2];

if (!input) {
  throw new Error("Indique o artigo em src/content/por-publicar.");
}

const articlePath = path.resolve(root, input);
const pendingDir = path.join(root, "src", "content", "por-publicar");
const relativeToPending = path.relative(pendingDir, articlePath);

if (
  relativeToPending.startsWith("..") ||
  path.isAbsolute(relativeToPending) ||
  !/\.mdx?$/i.test(articlePath)
) {
  throw new Error(`Artigo fora de src/content/por-publicar: ${input}`);
}

const slug = path.basename(articlePath).replace(/\.mdx?$/i, "");
const sourceImagePath = path.join(root, "imagens", "artigos", `${slug}.png`);
const imageCover = `/imagens/artigos/${slug}.avif`;

const TECHNICAL_PROMPT =
  "Cria uma única ilustração editorial horizontal para o Guia do Proprietário. " +
  "Proporção final 16:9 e enquadramento preparado para corte ao centro para 1200 x 675 px. " +
  "Estilo flat editorial, limpo, contemporâneo e minimalista, com contexto doméstico inequivocamente português. " +
  "Paleta obrigatória: verde escuro #14532D, verde médio #2F7A5C, areia #E2C58F, creme #F5F2E9 e branco. " +
  "Formas geométricas simples, traço consistente, luz suave e pequenos detalhes inspirados em azulejos portugueses. " +
  "Manter o motivo principal dentro dos 70% centrais da imagem e deixar margens visuais livres. " +
  "Sem texto, letras, números, logótipos, marcas, marcas de água, gradientes, fotorrealismo, rostos definidos ou mãos em destaque. " +
  "Não criar colagem, moldura, folha de variações ou várias alternativas. Gerar apenas uma imagem final.";

function frontmatter(source) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) throw new Error("O artigo não tem frontmatter YAML válido.");
  return { block: match[1], full: match[0] };
}

function parseYamlScalar(raw) {
  const value = raw.trim();
  if (value.startsWith('"') && value.endsWith('"')) {
    try {
      return JSON.parse(value);
    } catch {
      return value.slice(1, -1);
    }
  }
  if (value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1).replaceAll("''", "'");
  }
  return value;
}

function getField(source, name) {
  const { block } = frontmatter(source);
  const match = block.match(new RegExp(`^${name}:\\s*(.+)$`, "m"));
  return match ? parseYamlScalar(match[1]) : "";
}

function setFields(source, fields) {
  const { block, full } = frontmatter(source);
  let nextBlock = block;

  for (const [name, value] of Object.entries(fields)) {
    const line = `${name}: ${JSON.stringify(value)}`;
    const pattern = new RegExp(`^${name}:\\s*.*$`, "m");
    if (pattern.test(nextBlock)) {
      nextBlock = nextBlock.replace(pattern, line);
    } else {
      nextBlock = `${nextBlock}\n${line}`;
    }
  }

  const newline = full.includes("\r\n") ? "\r\n" : "\n";
  const replacement = `---${newline}${nextBlock.replace(/\r?\n/g, newline)}${newline}---`;
  return source.replace(full, replacement);
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function openAIRequest(endpoint, payload, label) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Falta o secret OPENAI_API_KEY no GitHub. Adicione-o em Settings > Secrets and variables > Actions.",
    );
  }

  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(`https://api.openai.com/v1/${endpoint}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const bodyText = await response.text();
      if (!response.ok) {
        const error = new Error(
          `${label}: OpenAI respondeu HTTP ${response.status}: ${bodyText.slice(0, 1200)}`,
        );
        if (response.status === 429 || response.status >= 500) {
          lastError = error;
          if (attempt < 3) {
            await sleep(1500 * 2 ** (attempt - 1));
            continue;
          }
        }
        throw error;
      }

      return JSON.parse(bodyText);
    } catch (error) {
      lastError = error;
      if (attempt < 3 && !(error instanceof SyntaxError)) {
        await sleep(1500 * 2 ** (attempt - 1));
        continue;
      }
      throw error;
    }
  }

  throw lastError ?? new Error(`${label}: falha desconhecida.`);
}

async function createVisualBrief({ titulo, descricao, pilar }) {
  const model = process.env.OPENAI_TEXT_MODEL || "gpt-4.1-mini";
  const response = await openAIRequest(
    "chat/completions",
    {
      model,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "guia_proprietario_article_image",
          strict: true,
          schema: {
            type: "object",
            properties: {
              prompt_imagem: { type: "string", minLength: 20 },
              imagem_alt: { type: "string", minLength: 10 },
            },
            required: ["prompt_imagem", "imagem_alt"],
            additionalProperties: false,
          },
        },
      },
      messages: [
        {
          role: "system",
          content:
            "Com base no título e na descrição de um artigo do Guia do Proprietário, cria um motivo visual específico e um texto alternativo factual. " +
            "O motivo deve mostrar uma única cena doméstica portuguesa, ser visualmente distinto de outros artigos e não depender de texto, números, logótipos ou rostos. " +
            "O texto alternativo deve ser uma frase curta, descrever apenas o que será visível e não começar por “Imagem de”.",
        },
        {
          role: "user",
          content: `Título: ${titulo}\nDescrição: ${descricao}\nPilar: ${pilar}`,
        },
      ],
    },
    "Criar prompt visual",
  );

  const content = response?.choices?.[0]?.message?.content;
  if (!content) throw new Error("A OpenAI não devolveu o JSON do prompt visual.");

  const parsed = JSON.parse(content);
  if (!parsed.prompt_imagem || !parsed.imagem_alt) {
    throw new Error("A OpenAI devolveu um prompt visual incompleto.");
  }
  return parsed;
}

async function generateImage(prompt) {
  const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";
  const response = await openAIRequest(
    "images/generations",
    {
      model,
      prompt: `${TECHNICAL_PROMPT}\n\nCena específica: ${prompt}`,
      n: 1,
      size: "1536x1024",
      quality: "medium",
      output_format: "png",
      background: "opaque",
    },
    "Gerar imagem",
  );

  const base64 = response?.data?.[0]?.b64_json;
  if (!base64) throw new Error("A OpenAI não devolveu b64_json para a imagem.");

  const buffer = Buffer.from(base64, "base64");
  const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  if (buffer.length < 1024 || !buffer.subarray(0, 8).equals(pngSignature)) {
    throw new Error("A resposta da OpenAI não contém um PNG válido.");
  }

  await fs.mkdir(path.dirname(sourceImagePath), { recursive: true });
  await fs.writeFile(sourceImagePath, buffer);
}

let source = await fs.readFile(articlePath, "utf8");
const titulo = getField(source, "titulo");
const descricao = getField(source, "descricao");
const pilar = getField(source, "pilar");
const currentCover = getField(source, "imagem_capa");
const currentAlt = getField(source, "imagem_alt");

if (!titulo || !descricao || !pilar) {
  throw new Error(
    `Frontmatter incompleto em ${path.basename(articlePath)}: titulo, descricao e pilar são obrigatórios.`,
  );
}

if (currentCover && currentCover !== "auto" && currentCover !== imageCover) {
  if (!currentAlt) {
    throw new Error(
      `${path.basename(articlePath)} já tem imagem_capa própria, mas falta imagem_alt.`,
    );
  }
  console.log(`Imagem própria já definida; mantida sem alterações: ${currentCover}`);
  process.exit(0);
}

let visualBrief = null;
const imageExists = await exists(sourceImagePath);

if (!imageExists || !currentAlt) {
  visualBrief = await createVisualBrief({ titulo, descricao, pilar });
}

if (!imageExists) {
  console.log(`A gerar imagem para ${slug}...`);
  await generateImage(visualBrief.prompt_imagem);
  console.log(`Imagem criada: imagens/artigos/${slug}.png`);
} else {
  console.log(`Fonte PNG já existe; geração não repetida: imagens/artigos/${slug}.png`);
}

const finalAlt = currentAlt || visualBrief?.imagem_alt;
if (!finalAlt) {
  throw new Error(`Não foi possível obter imagem_alt para ${slug}.`);
}

source = setFields(source, {
  imagem_capa: imageCover,
  imagem_alt: finalAlt,
});
await fs.writeFile(articlePath, source, "utf8");

console.log(`Frontmatter atualizado: imagem_capa=${imageCover}`);
