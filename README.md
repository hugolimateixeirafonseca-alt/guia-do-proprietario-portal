# Guia do Proprietário Portal

Projeto autónomo do portal editorial associado ao Guia do Proprietário.

## Limite do projeto

Este repositório contém apenas o portal editorial:

- páginas editoriais e artigos;
- cinco pilares de conteúdo;
- simuladores abertos sem recolha de contactos;
- páginas programáticas alimentadas por JSON;
- feed JSON e RSS;
- newsletter desativada até existir fornecedor e consentimento aprovados.

As landings, a área do parceiro e o futuro backend de leads permanecem no projeto `guia-do-proprietario`.

## Fontes de verdade

- `DECISOES.md`: decisões transversais copiadas do projeto principal em 24 de julho de 2026.
- `SITE-SPEC.md`: especificação aprovada para o portal.

No projeto autónomo, a raiz deste repositório corresponde à pasta `site/` descrita na especificação.

## Estado

- Astro 7, output estático.
- Nove artigos, com níveis essencial e detalhado e um par ligado nos dois sentidos.
- Pilar Casa e obras com ilustração própria.
- Glossário editorial ligado a partir dos termos técnicos.
- 308 páginas de IMI com dados oficiais da Autoridade Tributária de 2025.
- 308 páginas de preços com o indicador INE 0012234, atualizado no 1T2026.
- Simulador de IMI e simulador de valor líquido.
- Simulador de IMI com seleção de concelho, dois caminhos de cálculo, IMI familiar e plano de prestações.
- Campos numéricos dos dois simuladores preparados para vírgula decimal.
- Sistema visual editorial com 12 ilustrações em AVIF e WebP.
- Gráficos estáticos nas páginas de IMI e preços.
- Sem publicação e sem recolha de contactos.
- Validação automática dos três ficheiros de dados no início do build.

## Baseline Lighthouse mobile

Auditoria local realizada a 24 de julho de 2026, depois da integração da V3.

| Página | Performance | Acessibilidade | Boas práticas | SEO |
|---|---:|---:|---:|---:|
| Home | 100 | 100 | 96 | 100 |
| Artigo “Quanto custa pintar uma casa?” | 100 | 96 | 96 | 100 |

Na home, o LCP foi de 1,4 segundos, o tempo total de bloqueio foi 0 milissegundos e o CLS foi 0. No artigo, o LCP foi de 0,9 segundos, o tempo total de bloqueio foi 0 milissegundos e o CLS foi 0.

Auditoria mobile da V4 no simulador de IMI compilado: 100 em performance, acessibilidade, boas práticas e SEO. O LCP foi de 1,1 segundos, o tempo total de bloqueio foi 0 milissegundos e o CLS foi 0.

## Utilização local

```text
npm install
npm run dev
npm run build
```

O build valida os schemas dos dados, o schema dos conteúdos, o TypeScript e a regra editorial que proíbe travessões longos e médios.

Antes das validações, o build procura ficheiros PNG, JPG e JPEG dentro de `imagens/` e gera automaticamente as versões AVIF e WebP correspondentes em `public/imagens/`, mantendo as subpastas.

Para preparar um artigo sem o publicar, use `rascunho: true` no frontmatter. O artigo não terá página e não aparecerá nas listagens, no RSS, no feed JSON nem nos cartões sociais.

Os dados oficiais podem ser atualizados com `npm run dados:ine` e `npm run dados:imi`. Cada script mantém uma cache local das respostas oficiais e pode ser repetido sem alterar o resultado.

## Antes de publicar

- fazer a verificação manual da amostra indicada em `dados/VERIFICACAO.md`;
- identificar o fundador na página Sobre;
- validar os textos legais;
- escolher a analítica sem cookies;
- escolher o fornecedor da newsletter e implementar double opt-in;
- rever os artigos de exemplo e confirmar a revisão profissional necessária;
- gerar e validar os cartões sociais finais;
- concluir a pesquisa de marca no INPI.
