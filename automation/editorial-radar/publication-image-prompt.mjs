export const IMAGE_TECHNICAL_PROMPT = 'gpt-image-2 high — cartão completo com texto gerado por IA';

function normalizeLine(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

export function buildPublicationImagePrompt({title, sourceName, factualPoints, illustrationDirection}) {
  const finalTitle = String(title || '').trim();
  const finalSource = String(sourceName || '').trim();
  const points = Array.isArray(factualPoints) ? factualPoints.map(normalizeLine).filter(Boolean).slice(0, 7) : [];
  const direction = normalizeLine(illustrationDirection);

  if (!finalTitle) throw new Error('Image prompt requires the final editorial title');
  if (!finalSource) throw new Error('Image prompt requires the validated primary source');
  if (points.length < 4) throw new Error('Image prompt requires 4 to 7 verified factual points');
  if (!direction) throw new Error('Image prompt requires an illustration direction');

  return `Cria o CARTÃO SOCIAL COMPLETO desta notícia para o portal português Guia do Proprietário.

A própria IA deve gerar a imagem FINAL COMPLETA, incluindo ilustração, composição e todo o texto visível.

FORMATO
- horizontal 1536x1024
- destinado a Open Graph / Facebook
- elementos principais dentro de uma zona central segura, deixando margens discretas superior e inferior para tolerar recorte

ESTILO VISUAL
- editorial premium, elegante, adulto e credível
- fundo creme quente ou marfim com textura muito subtil
- verde-petróleo ou azul-petróleo escuro como cor dominante
- pequenos apontamentos dourados ou terracota
- composição limpa e bastante espaço em branco
- grande área tipográfica à esquerda
- ilustração editorial sofisticada à direita
- título principal em serif elegante, grande e escuro
- restantes textos em sans-serif limpa
- estética portuguesa ligada a casa, património e vida do proprietário
- evitar aspeto infantil, 3D exagerado ou stock genérico

TEXTO OBRIGATÓRIO NA IMAGEM

Cápsula:
NOTÍCIAS

Título principal:
${finalTitle}

Rodapé esquerdo:
Fonte: ${finalSource}

Pode surgir discretamente:
Guia do Proprietário

CONTEXTO FACTUAL PARA A ILUSTRAÇÃO
${points.map(point => `- ${point}`).join('\n')}

ORIENTAÇÃO VISUAL
${direction}

REGRAS
- Português de Portugal
- escrever exatamente o título e a fonte fornecidos
- preservar acentos, cedilhas, hífenes, números e maiúsculas
- não resumir nem reescrever o título
- não acrescentar texto editorial desnecessário
- não usar logótipos ou marcas da fonte original
- não usar marcas de água
- não copiar nem imitar a imagem original da notícia
- representar o tema sem inventar acontecimentos
- se for habitação, condomínio, energia ou obras, usar arquitetura plausível em Portugal
- se for fiscal, jurídico ou patrimonial, usar metáfora editorial ligada a casa, documentos, dinheiro, contratos, propriedade ou património
- não usar logótipo, ícone, selo ou símbolo gráfico do Guia do Proprietário
- máxima legibilidade no feed do Facebook

RESULTADO
Uma única imagem final pronta a publicar no espírito editorial do Guia do Proprietário.`;
}

export function finalizePublication({publishableNews, event, generated}) {
  if (!publishableNews) {
    return {texto_fb:'', texto_site:'', prompt_imagem:'', prompt_tecnico:''};
  }
  if (!generated?.texto_fb || !generated?.texto_site) {
    throw new Error('Publication generation returned incomplete content');
  }

  return {
    texto_fb:generated.texto_fb,
    texto_site:generated.texto_site,
    prompt_imagem:buildPublicationImagePrompt({
      title:event.title,
      sourceName:event.source_name,
      factualPoints:generated.resumo_factual_curto,
      illustrationDirection:generated.orientacao_ilustracao
    }),
    prompt_tecnico:IMAGE_TECHNICAL_PROMPT
  };
}
