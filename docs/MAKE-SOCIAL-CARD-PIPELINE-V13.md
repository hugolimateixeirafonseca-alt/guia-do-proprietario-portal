# Alterações Make para Radar SCORE70 e Publicador com renderer

## Estado dos blueprints

O workspace não contém os blueprints fonte atuais:

- `GP Radar Editorial → Publicações v21.3` ou equivalente em produção;
- `GP Redes - Publicador NOTÍCIAS v12.0 RADAR PROMPTS`.

Existem apenas blueprints v9, anteriores ao Radar, às colunas U/V e ao fluxo atual de share page. Não foram gerados JSONs v21.4/v13.0 porque isso obrigaria a inventar IDs, mappings e connections. Para produzir blueprints importáveis, exportar do Make e fornecer os dois cenários atuais em JSON.

## GP Radar Editorial → Publicações v21.4 SCORE70

Preservar todos os módulos, IDs e rotas do cenário atual. Alterar apenas:

1. No filtro da rota que escreve em `publicacoes`, substituir `news_score > 79` por `news_score > 69`.
2. Confirmar o mapping da linha `publicacoes`:
   - U `prompt_imagem` recebe `prompt_imagem` do webhook;
   - V `prompt_tecnico` recebe `prompt_tecnico` do webhook;
   - W `conteudo_verificado` permanece inalterado;
   - X `texto_site` permanece inalterado;
   - Y `fonte_nome` permanece inalterado;
   - Z `data_fonte` recebe `data_publicacao`;
   - AA `titulo_noticia` permanece inalterado.
3. Manter `estado=por_aprovar`. Não criar publicação automática.
4. Manter as rotas de `radar_editorial`, SEO, leads e impacto sem alterações.

## GP Redes - Publicador NOTÍCIAS v13.0 RENDERER

Preservar a pesquisa da próxima linha `pronto`, preparação MDX, URLs, GitHub, share page, espera de deployment, Facebook e atualização final. Substituir apenas a cadeia de imagem.

### 1. Prompt visual

Adicionar ou adaptar um `Set variable` imediatamente antes do módulo OpenAI:

- se U `prompt_imagem` não estiver vazio, usar U;
- caso contrário, usar o fallback visual do pilar;
- nunca concatenar AA `titulo_noticia`, Y `fonte_nome`, E `texto_fb` ou X `texto_site` no prompt da imagem.

Fallback geral:

```text
Cria a base visual sem texto de um cartão editorial premium português sobre habitação. Fundo creme, verde-petróleo, composição sofisticada, área tipográfica vazia à esquerda e ilustração arquitetónica à direita. Sem pessoas. Sem texto, letras, números, logótipos ou marcas de água.
```

Variações seguras por pilar podem trocar apenas a última orientação visual por:

- `condominio`: edifício residencial português e documentação genérica;
- `arrendar`: interior residencial, chave e documentos genéricos;
- `impostos`: casa e documentos patrimoniais genéricos;
- `vender`: arquitetura residencial e elementos económicos abstratos;
- `casa`: habitação portuguesa e elementos domésticos discretos.

### 2. OpenAI Images

Manter a connection atual e `gpt-image-2 high`. Enviar apenas o prompt visual selecionado. O resultado deste módulo é uma base, nunca o cartão final.

### 3. HTTP renderer

Adicionar `HTTP > Make a request` depois do OpenAI:

- Method: `POST`;
- URL: `https://guiadoproprietario.pt/api/render-social-card`;
- Header `Authorization`: `Bearer {{secret seguro do Make}}`;
- Body type: `multipart/form-data`;
- field `title`: AA `titulo_noticia`;
- field `source`: Y `fonte_nome`;
- field `pilar`: B `pilar`;
- field `image`: ficheiro/buffer PNG devolvido pelo OpenAI;
- ativar resposta binária/download de ficheiro.

### 4. GitHub

No módulo que grava `public/social/noticias/<slug>.png`, substituir:

```text
base64(OpenAI.resImgData)
```

por:

```text
base64(HTTP renderer.data)
```

Usar a propriedade binária efetivamente exposta pelo módulo HTTP depois de executar `Run once`. Não alterar o path, slug, mensagem de commit ou restantes mappings GitHub.

### 5. Continuidade e erro

- `share_html` continua a apontar para `https://guiadoproprietario.pt/social/noticias/<slug>.png`;
- a share page não substitui o PNG;
- o Facebook recebe a mesma URL final;
- só marcar a linha como publicada depois de confirmar renderer, GitHub, deployment e Facebook;
- ligar erros do OpenAI e do HTTP renderer à rota de erro existente;
- não criar retry circular ou ilimitado;
- em falha, guardar a informação técnica, não publicar e não marcar como publicada.

## Ficheiros ainda necessários

Para gerar os blueprints finais com connections e mappings reais, fornecer:

1. export JSON atual de `GP Radar Editorial → Publicações`;
2. export JSON atual de `GP Redes - Publicador NOTÍCIAS v12.0 RADAR PROMPTS`.
