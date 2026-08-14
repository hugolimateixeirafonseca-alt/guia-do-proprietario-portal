# Renderer determinístico dos cartões de notícias

## Arquitetura

O renderer é uma Cloudflare Pages Function no próprio portal:

`POST https://guiadoproprietario.pt/api/render-social-card`

Esta opção evita um serviço, deployment e domínio adicionais. A Function usa:

- Satori para composição editorial e tipografia real;
- `resvg-wasm` para converter o SVG em PNG dentro do runtime Cloudflare;
- uma base visual recebida por `multipart/form-data` e integrada no canvas;
- Old Standard TT Bold no título e Lato nos restantes textos;
- fontes incluídas no bundle, sem pedidos a Google Fonts durante o render.

O resultado é sempre um PNG de 1536x1024. A área tipográfica ocupa 56% à esquerda e a ilustração 44% à direita. Um gradiente creme e textura subtil integram as duas zonas sem criar uma caixa branca sobre uma fotografia.

## Autenticação

Criar um único secret:

`SOCIAL_CARD_RENDERER_SECRET`

Configuração no Cloudflare:

1. Workers & Pages.
2. Abrir o projeto Pages do Guia do Proprietário.
3. Settings, Variables and Secrets.
4. Adicionar `SOCIAL_CARD_RENDERER_SECRET` como secret de Production.
5. Adicionar também a Preview se o endpoint for testado em previews.

No Make, guardar o mesmo valor numa variável segura ou ligação HTTP. Nunca o colocar num blueprint exportado.

## Contrato HTTP

Headers:

```text
Authorization: Bearer <SOCIAL_CARD_RENDERER_SECRET>
Content-Type: multipart/form-data
```

Campos:

- `title`: `titulo_noticia` exatamente como vem da coluna AA;
- `source`: `fonte_nome` exatamente como vem da coluna Y;
- `pilar`: opcional, vindo da coluna B;
- `image`: ficheiro PNG, JPEG ou WebP devolvido pela geração de imagem.

Resposta com sucesso:

```text
200 OK
Content-Type: image/png
```

O body são os bytes do PNG final. O endpoint rejeita pedidos sem Bearer válido, imagens acima de 15 MiB e formatos não suportados. Não existe fallback que publique sem renderer.

O renderer não recebe nem pesquisa URLs de imagem. O percurso é: `multipart File` → `File.arrayBuffer()` → validação da assinatura PNG/JPEG/WebP → `ArrayBuffer` no `src` da imagem do Satori → SVG → `resvg-wasm` → bytes PNG. O tipo declarado tem de coincidir com a assinatura binária. HTML, SVG e outros uploads arbitrários são rejeitados.

O endpoint aceita exclusivamente `POST` autenticado e exige `multipart/form-data` com boundary. Título, fonte e imagem são obrigatórios. Não existem logs do secret, respostas com stack trace, pedidos a URLs fornecidos pelo cliente ou CORS para browser. Todas as respostas usam `Cache-Control: no-store`.

## Tipografia e segurança de layout

- o título nunca é truncado nem reescrito;
- o algoritmo faz wrapping por palavras;
- tenta no máximo cinco linhas;
- reduz progressivamente entre 72 px e 24 px;
- se nem 24 px couber na área segura, o endpoint falha em vez de produzir um cartão defeituoso;
- `NOTÍCIAS`, `Fonte: ...` e `Guia do Proprietário` têm posições determinísticas;
- a tipografia suporta os caracteres portugueses e o símbolo `€`.

## Fontes e licenças

- Old Standard TT Bold, SIL Open Font License 1.1;
- Lato Regular/Bold, SIL Open Font License 1.1.

Os ficheiros de licença estão junto dos binários em `functions/assets/fonts/`. Os binários foram obtidos do repositório oficial `google/fonts` e são empacotados como módulos binários pela Cloudflare.

## Falhas

- se a OpenAI falhar: não chamar renderer, GitHub ou Facebook e não marcar como publicada;
- se o renderer falhar: não chamar GitHub ou Facebook e não marcar como publicada;
- se o GitHub falhar: não chamar Facebook e não marcar como publicada;
- atualizar estado/publicado apenas depois de renderer, GitHub, deployment e Facebook concluírem com sucesso.
