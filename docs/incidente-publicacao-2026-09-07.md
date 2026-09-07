# Publicação automática de 7 de setembro de 2026

O artigo `pintar-fachada-preco.mdx` entrou em `main` no commit
`c884872b552ab1c978713e9120fa9e484b65abb5`, mas o deployment Cloudflare
`f762044e-f7b3-4c29-89d0-8aac445741a7` falhou na validação editorial.
O job `Publicar artigos` tinha terminado com sucesso porque apenas preparou
e enviou o conteúdo. Isso não confirmava a publicação no site.

Os registos do alojamento mostram, às 07:31:33 UTC, que `validate:copy`
rejeitou dez artigos de adaptação da casa ainda em `src/content/por-publicar`.
Continham travessões proibidos pela regra editorial. A pontuação foi corrigida,
preservando conteúdo, fontes, ordem da fila e datas.

A publicação diária valida agora a copy antes de preparar imagens e novamente
antes de enviar o artigo. Uma verificação leve também valida entradas em `src`
nos pushes e pull requests. O resumo da preparação deixa de dizer PUBLICADO.
O processo de deploy avisa o dashboard depois do seu resultado, incluindo falhas.

No dashboard, `sourceCollection: published` continua a identificar a pasta Git,
mas o cartão e a lista de publicados exigem `confirmedOnline: true` e URL pública.
Artigos enviados ao repositório sem confirmação no sitemap permanecem na lista
de artigos por publicar, com a indicação de confirmação pendente.

Evidência inicial: o estado operacional tinha 94 artigos na pasta de publicação
e 93 confirmados no sitemap. A recuperação reutiliza o artigo já preparado;
não executa novamente a seleção diária nem avança a fila.

Validação local: copy, datas e capas. A compilação integral necessária para
publicar fica a cargo do fluxo normal do alojamento, sem build integral local.
O resultado da recuperação é registado no repositório operacional.
