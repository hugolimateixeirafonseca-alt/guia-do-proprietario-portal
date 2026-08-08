# SITE-SPEC. Portal guiadoproprietario.pt

Especificação para implementação pelo Codex. As decisões aqui registadas foram discutidas e aprovadas. Alterações de fundo devem passar primeiro pelo DECISOES.md.

Estado: portal V4 implementado localmente. Os dados oficiais de IMI e preços estão integrados.

Adendas integradas: `ALTERACOES-PORTAL-V2.md`, `RELATORIO-VISUAL-E-MELHORIAS.md`, `ALTERACOES-PORTAL-V3.md`, `DADOS-SPEC.md` e `ALTERACOES-PORTAL-V4.md`, aprovadas a 24 de julho de 2026. O portal privilegia atualidade e prazos, navegação por situação, respostas diretas e uma linguagem visual editorial portuguesa.

## 1. Objetivo e âmbito

Portal editorial em português de Portugal para proprietários de imóveis. Cinco pilares de conteúdo, páginas programáticas alimentadas por dados oficiais, simuladores embebidos, feed para automação de redes sociais, newsletter desde o primeiro dia.

Fora do âmbito desta spec: landings com recolha real de dados (dependem do D005), área do parceiro, backend de leads, comentários de utilizadores, área reservada.

## 2. Stack técnica

- Gerador: Astro (última versão estável), output estático.
- Alojamento: Cloudflare Pages, deploy automático a partir do ramo principal do repo.
- Conteúdo: Markdown/MDX em content collections do Astro, com frontmatter tipado (schema em `src/content.config.ts`).
- Interatividade: ilhas Astro apenas nas páginas de simulador. Zero JavaScript no resto das páginas por omissão.
- Estilos: CSS próprio, sem framework. Tipografia de sistema. Orçamento de performance: página de artigo abaixo de 200 KB transferidos com imagem incluída, sem webfonts, imagens em AVIF/WebP com lazy loading. Cada página tem no máximo uma imagem acima de 40 KB.
- Sem cookies próprios. Analítica sem cookies (secção 11).

## 3. Estrutura do repo

```text
site/
|  astro.config.mjs
|  src/
|  |  content.config.ts
|  |  content/
|  |  |  artigos/            um .md por artigo
|  |  |  notas/              notas curtas de atualidade
|  |  |  paginas/            sobre, metodologia, legais
|  |  dados/
|  |  |  calendario.json         prazos anuais e recorrentes
|  |  |  glossario.json          termos, definições e pilar associado
|  |  |  imi-concelhos.json      taxas IMI por concelho e ano
|  |  |  precos-concelhos.json   medianas móveis de 12 meses do INE por concelho
|  |  |  concelhos.json          lista mestra: slug, nome, distrito, codigo INE
|  |  components/
|  |  |  Custos.astro
|  |  |  PriceTrend.astro
|  |  |  ImiScale.astro
|  |  |  MapaPortugal.astro
|  |  layouts/
|  |  pages/
|  |  |  index.astro
|  |  |  [pilar]/index.astro
|  |  |  [pilar]/[slug].astro
|  |  |  imi/[concelho].astro
|  |  |  precos-casas/[concelho].astro
|  |  |  simuladores/
|  |  |  calendario.astro
|  |  |  novidades/
|  |  |  ligacoes.astro
|  |  |  feed.json.ts
|  |  |  rss.xml.ts
|  public/
|  |  imagens/                  AVIF e WebP finais
|  |  padrao-azulejo.svg
|  imagens/
|  |  PROMPTS.md               prompts e regras de reprodução
```

Os simuladores partilham o motor de cálculo num módulo único (`src/lib/estimador.ts` e afins). Nenhuma lógica de cálculo duplicada entre páginas.

## 4. Taxonomia e URLs

Cinco pilares no lançamento. Slugs fixos:

| Pilar | Slug | Exemplos de temas |
|---|---|---|
| Vender casa | `/vender/` | processo de venda, custos, CPCV, escritura, escolher agência |
| Impostos do proprietário | `/impostos/` | IMI, IMT, mais-valias, IRS do senhorio, prazos |
| Arrendamento e senhorios | `/arrendar/` | contratos, rendas, obrigações, fim de contrato |
| Condomínio | `/condominio/` | quotas, assembleias, obras, administração |
| Casa e obras | `/casa/` | custos reais, manutenção, energia e vizinhança |

URLs de artigo: `/{pilar}/{slug-do-artigo}/`. Sem datas no URL. Sem categorias aninhadas.

Páginas programáticas: `/imi/{concelho}/` e `/precos-casas/{concelho}/`.

Notas de atualidade: `/novidades/{slug}/`, com índice em `/novidades/`.

Calendário do proprietário: `/calendario/`.

## 5. Modelo de conteúdo do artigo

Frontmatter obrigatório, validado pelo schema da collection:

```yaml
---
titulo: "IMI em 2026: prazos, taxas e isenções"
descricao: "Resumo de 150 a 160 caracteres para meta description e partilhas."
resposta_rapida: "Resposta direta em duas a três frases, antes do corpo."
nivel: essencial          # essencial | detalhado
par: outro-artigo         # opcional, slug da versão do outro nível
exemplo:
  titulo: "Exemplo com números"
  texto: "Exemplo concreto opcional."
perguntas_rapidas:
  - pergunta: "Pergunta real do leitor?"
    resposta: "Resposta curta, com uma a duas frases."
custos:                   # opcional, para artigos de quanto custa
  titulo: "Intervalos para preparar o orçamento"
  itens:
    - item: "Trabalho"
      intervalo: "4 € a 16 € por m²"
      nota: "O que faz variar o valor."
pilar: impostos
publicado: 2026-08-01
chegada: 2026-07-31T16:12:00+01:00 # primeiro registo verificável do ficheiro no repositório
publicado_em: 2026-08-01T08:00:00+01:00 # momento verificável da publicação efetiva
revisto: 2026-08-01
autor: redacao            # valor fixo nesta fase
revisao_profissional: ""  # nome e título quando existir, vazio até lá
fontes:
  - nome: "Portal das Finanças"
    url: "https://..."
  - nome: "Código do IMI, art. 112.º"
    url: "https://..."
aviso: fiscal             # fiscal | juridico | financeiro | nenhum
rascunho: false           # true exclui o artigo do site, RSS, feed JSON e cartões OG
destaque: false           # true aparece na home
imagem_og: auto           # auto gera cartão; ou caminho para imagem própria
imagem_capa: auto         # auto usa a imagem do pilar; ou caminho para imagem própria
---
```

Regras de renderização:

- `revisto` aparece visível no topo do artigo: "Atualizado a 1 de agosto de 2026".
- `chegada` é obrigatória nos artigos publicados e regista a primeira entrada verificável do ficheiro no repositório. A automação preserva o valor existente ou obtém-o do histórico Git.
- `publicado_em` é obrigatório e regista a publicação efetiva. Determina a ordem de "Mais recentes", o RSS, o feed JSON e `datePublished`. Em caso de publicação conjunta, usa-se primeiro `chegada` e depois o título para manter uma ordem estável.
- `rascunho: true` impede a geração da página e exclui o artigo de todas as listagens, do RSS, do feed JSON e dos cartões sociais.
- `resposta_rapida` aparece numa caixa "Resposta rápida" imediatamente após o título e a atualização.
- Nos artigos essenciais, a caixa chama-se "Em duas linhas" e não existe uma etiqueta adicional de nível. Os artigos detalhados mostram "Versão completa".
- `nivel` é obrigatório. Quando existe `par`, as duas versões ligam uma à outra no fim.
- Os artigos essenciais têm até 800 palavras, exemplo com números e uma secção final "Perguntas rápidas" com 3 a 5 respostas. O build avisa quando ultrapassam 800 palavras.
- As perguntas rápidas visíveis geram schema `FAQPage`.
- Os artigos de Casa e obras são sempre essenciais.
- `custos`, quando existe, alimenta o componente `Custos`. Cada valor é um intervalo e nunca um preço único.
- `exemplo`, quando existe, aparece numa caixa própria logo após a resposta rápida.
- `fontes` renderiza como secção "Fontes" no fim do artigo. Artigo sem fontes não compila (validação no schema, mínimo 1).
- `aviso` renderiza a caixa contextual correspondente antes do primeiro H2. Textos dos avisos num único ficheiro para edição central.
- Autor renderiza como "Redação Guia do Proprietário" com link para a página de metodologia.
- O componente `Termo` explica o jargão na primeira ocorrência, com tooltip em ecrãs maiores e expansão inline em mobile.
- O componente `Termo` liga para a entrada correspondente em `/glossario/`.
- Os artigos do pilar impostos mostram `ProximosPrazos` antes das fontes.
- Cada artigo termina com "O que fazer a seguir" e duas a três ligações úteis.
- `imagem_capa` permite que artigos prioritários usem uma imagem própria. O valor `auto` usa a imagem do pilar.

Modelo das notas de atualidade:

```yaml
---
titulo: "Título da nota"
data: 2026-07-24
fonte_nome: "Fonte oficial"
fonte_url: "https://..."
pilar: impostos
---
```

As notas têm dois a quatro parágrafos, não mostram autor e entram no feed JSON com `tipo: "nota"`.

## 6. Páginas obrigatórias do esqueleto

1. Home: hero curto, bloco "Este mês", seis entradas em "A sua situação", guias essenciais, perguntas rápidas, novidades, simuladores e newsletter, por esta ordem. Os guias essenciais mostram apenas artigos `nivel: essencial` e incluem a imagem.
2. Página de pilar: lista de artigos do pilar, ordenada por `revisto` descendente.
3. Template de artigo: conforme secção 5, com bloco de newsletter a meio ou no fim, e bloco "Ferramentas relacionadas" com links para simuladores do pilar.
4. `/simuladores/`: índice das ferramentas. Primeiras ilhas: simulador de IMI e simulador de valor líquido da venda, sem passo de contacto. O simulador de IMI obtém a taxa a partir do concelho, permite usar o VPT ou o total pago no ano anterior, aplica o IMI familiar quando existe e apresenta o plano de prestações. O simulador de venda aceita vírgula decimal e usa uma comissão de 5% por omissão, identificada como valor típico e negociável.
5. `/sobre/`: quem está por trás do projeto, com o fundador identificado como editor e curador, sem alegações de competência jurídica ou fiscal.
6. `/metodologia/` ("Como produzimos os conteúdos"): fontes usadas, processo de verificação, política de atualização e de correção de erros.
7. Legais: política de privacidade e termos, versão adequada a um site sem recolha de dados pessoais além da newsletter. Página de cookies desnecessária se a analítica for sem cookies; declarar isso mesmo na política.
8. `/ligacoes/`: página estilo linktree para o link na bio do Instagram, com os 5 a 8 destinos principais, gerida por um JSON simples.
9. 404 com pesquisa ou links para pilares.
10. `/calendario/`: os 12 meses e a faixa "Todos os meses", alimentados por `src/dados/calendario.json`.
11. `/novidades/`: índice cronológico e páginas individuais da coleção `notas`.
12. `/glossario/`: termos alimentados por `src/dados/glossario.json`, com uma âncora estável por entrada.

## 7. Páginas programáticas

### 7.1 IMI por concelho

- Fonte: taxas de IMI deliberadas pelos municípios, publicadas anualmente pela AT. A primeira extração oficial usa 2025, o último ano completo disponível em 24 de julho de 2026, e guarda 2024 para comparação.
- Uma página por concelho: taxa do ano, comparação com o ano anterior, mínimo e máximo legal, prazos de pagamento do ano, simulador de IMI embebido pré-preenchido com o concelho, 3 a 4 parágrafos de contexto comuns a todas as páginas com interpolação do nome do concelho.
- Uma barra horizontal estática posiciona a taxa do concelho entre o mínimo e o máximo legal.
- Bloco "Concelhos vizinhos" com 4 a 6 links internos (usar o distrito do `concelhos.json`).

### 7.2 Preços das casas por concelho

- Fonte: indicador INE 0012234, mediana do valor por metro quadrado das vendas de alojamentos familiares nos últimos 12 meses. Guardada em `precos-concelhos.json` com o período de atualização.
- O rótulo obrigatório é: "Mediana das vendas dos últimos 12 meses, atualizada no X. Fonte: INE."
- Uma página por concelho: mediana atual, variação homóloga, tabela das últimas 4 atualizações, nota metodológica fixa e ligação futura para a landing de avaliação quando existir.
- Um gráfico SVG estático mostra as últimas quatro leituras a partir do JSON, sem JavaScript nem bibliotecas de runtime.
- Concelhos com valor suprimido pelo INE mostram o valor do distrito ou NUTS III com a devida nota, nunca um número inventado.

### 7.3 Regras comuns

- As páginas programáticas declaram sempre a fonte, o período de referência e a data de extração no topo.
- A atualização é feita pelos scripts `scripts/obter-taxas-imi.mjs` e `scripts/obter-precos-ine.mjs`. Os scripts usam cache local, são idempotentes e não dependem um do outro para executar.
- Os três contratos JSON são validados no início do build. Dados inválidos interrompem a compilação.
- `sitemap` inclui todas; nenhuma marcada noindex.
- As páginas de IMI e preços partilham um mini-mapa SVG de Portugal com o distrito destacado.

## 8. SEO técnico

- Sitemap automático e robots.txt.
- Schema.org: `Article` nos artigos (com `datePublished`, `dateModified`, `publisher` como Organization), `Organization` no site, `BreadcrumbList` em tudo, `FAQPage` apenas quando o artigo tiver secção de perguntas real.
- Canonical em todas as páginas. Trailing slash consistente.
- Cartões OG em PNG gerados no build por página, com título, padrão de azulejo e ilustração quando existe. Artigos, pilares, páginas programáticas, calendário, notas e os três simuladores têm URLs de imagem distintas. O cartão genérico fica reservado à home e restantes páginas utilitárias.
- Títulos: `{titulo} | Guia do Proprietário`. Home sem sufixo duplicado.

## 9. Feed para a automação social

Dois endpoints gerados no build:

- `/rss.xml`: RSS 2.0 clássico dos artigos.
- `/feed.json`: contrato para o cenário Make. Campos por item: `titulo`, `url`, `descricao`, `pilar`, `nivel` nos artigos, `publicado`, `revisto`, `tipo` (`artigo` | `nota` | `programatica-imi` | `programatica-precos`), `imagem_og`. Inclui artigos, notas e páginas programáticas atualizadas nos últimos 30 dias.

O cenário Make é externo a esta spec. O contrato do feed não muda sem atualizar esta secção.

## 10. Newsletter

- Bloco de subscrição em todos os artigos e na home. Campos: email, mais nada.
- Fornecedor por decidir (critério: double opt-in, RGPD, plano gratuito inicial). Até à decisão, o formulário existe mas em modo desativado com nota "brevemente", sem recolher nada.
- Texto de consentimento próprio da newsletter, separado de qualquer outra finalidade.

## 11. Analítica

- Cloudflare Web Analytics ou Plausible, ambos sem cookies e sem armazenamento no dispositivo. Escolher um, não os dois.
- Sem Google Analytics nesta fase. Sem tag managers. Sem pixels de redes sociais no portal editorial. Quando existirem campanhas pagas para landings, os pixels vivem nas landings e com consentimento, não no portal.

## 12. Regras editoriais e de estilo

- Português de Portugal. Sem travessões longos nem médios em nenhum texto do site, incluindo microcopy e mensagens de erro. Preferir vírgulas, dois pontos ou frases separadas.
- Números em formato português: espaço como separador de milhares, vírgula decimal, símbolo do euro após o número.
- Cada artigo: um H1 apenas, H2 para secções, parágrafos curtos, sem listas com menos de 3 itens.
- Os títulos dos artigos de exemplo são perguntas. O texto começa pela resposta, explica cada termo técnico e usa exemplos concretos quando apresenta números.
- As imagens seguem um único estilo editorial plano, com cenários de habitação portuguesa e a paleta verde, areia e creme. Não são usadas imagens fotorrealistas geradas por IA.
- Alegações fiscais e jurídicas sempre com fonte. Sem promessas de resultado. Os avisos contextuais são obrigatórios nos pilares impostos e arrendar.

## 13. O que fica explicitamente fora do esqueleto

- Recolha de dados pessoais além do formulário de newsletter desativado.
- Landings de captação (entram no domínio mais tarde, com o D005 cumprido).
- Comentários, contas de utilizador, pesquisa server-side (a pesquisa pode ser client-side simples ou ficar para depois).
- Publicidade e afiliados.

## 14. Critérios de aceitação

1. `npm run build` gera o site completo sem warnings de schema.
2. Lighthouse em página de artigo: performance, acessibilidade, best practices e SEO todos acima de 95 em mobile.
3. Um artigo de exemplo por pilar (4 no total) compila com resposta rápida, título em formato pergunta, fontes, aviso e uso do componente `Termo`.
4. As páginas programáticas geram 308 páginas de IMI e 308 páginas de preços a partir dos JSON oficiais, incluindo estados sem taxa publicada e fallbacks NUTS III devidamente identificados.
5. `/feed.json` inclui os 4 artigos e as notas com `tipo: "nota"`. `/rss.xml` inclui os 4 artigos.
6. Cartões OG gerados automaticamente. Dois artigos diferentes têm URLs e títulos de imagem diferentes.
7. Nenhum texto do site contém travessões longos ou médios (verificação automática no build ou em teste).
8. Zero pedidos a domínios externos em qualquer página, exceto o script da analítica escolhida.
9. A home respeita a ordem aprovada e usa literalmente os textos do hero e das seis situações.
10. `/calendario/` mostra os 12 meses. `ProximosPrazos` calcula os prazos seguintes com base na data de build.
11. `/novidades/` e as três notas de demonstração entram no sitemap.
12. As quatro ilustrações locais, em verde e areia sobre creme, pesam menos de 60 KB no total.
13. O hero usa AVIF com fallback WebP, dimensões explícitas, prioridade alta e não usa lazy loading.
14. Os seis cartões de situação têm imagens próprias em AVIF e WebP, com lazy loading.
15. Cada pilar tem uma imagem de cabeçalho própria, usada por omissão nos artigos.
16. As páginas programáticas mostram gráfico, escala e mini-mapa estáticos quando aplicável.
17. Os três simuladores têm cartões OG próprios.
18. O componente `Termo` contém uma única definição na árvore de acessibilidade.
19. O README regista a baseline Lighthouse mobile da home e de um artigo.
20. `nivel` é obrigatório no schema e o build falha quando está em falta.
21. `/casa/` está na navegação e no sitemap, com ilustração própria.
22. Existe um artigo essencial de Casa e obras com `Custos`, perguntas rápidas e `Termo`.
23. Existe pelo menos um par essencial e detalhado ligado nos dois sentidos.
24. `/glossario/` está publicado e recebe ligações do componente `Termo`.
25. O simulador de IMI oferece os caminhos "Sei o valor patrimonial" e "Só sei quanto paguei de IMI no ano passado". A taxa vem do concelho, pode ser alterada num bloco recolhido e todos os campos dos dois simuladores têm ajuda visível.
26. A homepage inclui perguntas rápidas e imagens nos guias essenciais.
27. Lighthouse mobile mantém mais de 95 nas quatro categorias.

## 15. Decisões em aberto

- Fornecedor da newsletter.
- Cloudflare Web Analytics ou Plausible.
- Evolução futura da identidade para além do sistema visual editorial aprovado. Fotografias e bibliotecas externas de ícones ficam fora desta fase.
- Data da próxima atualização anual do IMI e trimestral do indicador INE.
