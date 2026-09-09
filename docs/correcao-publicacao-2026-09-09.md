# Publicação automática e datas dos artigos

## Diagnóstico confirmado em 9 de setembro de 2026

A execução GitHub Actions 34321687213 moveu quanto-cobra-eletricista-urgencia.mdx de src/content/por-publicar para src/content/artigos no commit 2f8422f235e8201d4b743b7a9f121129c480ce23. Não alterou um artigo previamente publicado. A consulta inicial ao URL público devolveu HTTP 200, datePublished 2026-09-09T07:01:37.000Z e a legenda «Atualizado a 12 de agosto de 2026». A legenda usava revisto, herdado do rascunho, em vez de publicado_em.

A fila tinha 21 referências antigas e nenhuma correspondia aos pendentes. A execução registou FILA_DESATUALIZADA e escolheu pelo fallback Git. Restam 12 artigos pendentes.

## Correção

- Página e cartões apresentam a data real de publicação, publicado_em. Uma revisão posterior só é indicada quando pertence a um dia posterior em Lisboa. As datas históricas dos artigos são preservadas.
- dateModified e feeds nunca antecedem a publicação. A ordenação de artigos dentro de cada nível dos pilares e nos destaques usa a publicação real.
- Fila reconciliada com os 12 pendentes, por ordem de chegada verificável no Git. Próximo: tinta-certa-cada-parede.mdx; depois, reforma-arrendamento-o-que-muda.mdx.
- Seleção exclusivamente pela fila explícita. Uma fila sem entradas pendentes, apesar de haver ficheiros por publicar, falha com erro acionável. Entradas inexistentes ou duplicadas entre pastas também falham antes de gerar imagens ou mover artigos. Não existe escolha silenciosa fora da prioridade.
- Novos artigos devem entrar em src/content/por-publicar e em src/content/fila-publicacao-artigos.txt. Mantém-se um artigo por execução.

A correção segue o fluxo normal de publicação do portal. A confirmação pública acima é evidência do diagnóstico, anterior à correção; não confirma a versão corrigida online.
