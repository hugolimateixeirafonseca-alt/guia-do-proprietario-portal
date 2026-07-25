# ALTERACOES-PORTAL-V6. Biblioteca de ilustrações por pilar

Adenda à SITE-SPEC.md. Data: 2026-07-25. Implementar tudo e confirmar os critérios da secção E.

Problema: todos os artigos de um pilar mostram a mesma ilustração no cartão e no cabeçalho, porque herdam uma única imagem do pilar. Numa página de pilar com quatro artigos, aparecem quatro imagens iguais. Solução: um conjunto de ilustrações por pilar e uma atribuição automática que dá imagens diferentes a artigos diferentes, sem trabalho manual em cada publicação.

Princípio que não muda: o autor de um artigo não escolhe imagem. Sobe o .mdx e o site atribui uma ilustração do pilar automaticamente. Quem quiser uma imagem específica indica-a num campo do frontmatter, e essa ganha prioridade.

## A. Gerar as ilustrações

- Gerar, com a ferramenta de imagem, um conjunto de 8 ilustrações por pilar, no MESMO estilo da ilustração atual do pilar Casa e obras (`public/imagens/pilar-casa.avif`), que serve de referência obrigatória de estilo: ilustração editorial plana, traço simples, paleta verde, areia, creme e terracota, motivos portugueses, sem texto, sem rostos.
- Coerência acima de variedade: se alguma imagem sair fora do tom (paleta diferente, traço diferente, realista), regenerar até bater certo com a referência. É preferível 6 coerentes do que 8 dispersas.
- Motivos sugeridos por pilar (guia, não obrigatório; manter todos no mesmo estilo):
  - **Casa e obras** (`casa`): escada e lata de tinta (a atual), telhado com telha, torneira a pingar, quadro elétrico, parede com humidade, caixa de ferramentas, radiador, janela com estore.
  - **Vender casa** (`vender`): casa com placa de venda, chave, aperto de mão à porta, caixas de mudança, planta da casa, lupa sobre casa, contrato, varanda.
  - **Impostos** (`impostos`): calendário com moeda, envelope de carta, calculadora, cofre, papel com carimbo, moedas empilhadas, relógio e euro, edifício de finanças estilizado.
  - **Arrendamento** (`arrendar`): chave e contrato, duas mãos a trocar chave, casa com etiqueta de renda, recibo, porta com número, caderneta, mala de inquilino, prédio.
  - **Condomínio** (`condominio`): prédio de fachada, mesa de reunião, elevador, escadas comuns, caixa de correio coletiva, jardim comum, telhado partilhado, porta de entrada de prédio.
- Cada imagem em AVIF e WebP, com as mesmas dimensões e orçamento de peso das ilustrações atuais (abaixo de ~35 KB cada em AVIF).

## B. Estrutura de pastas

```text
public/imagens/pilares/
  casa/01.avif, 01.webp, 02.avif, 02.webp, ...
  vender/01.avif, ...
  impostos/01.avif, ...
  arrendar/01.avif, ...
  condominio/01.avif, ...
```

A ilustração de cabeçalho da página de pilar (a imagem grande no topo de `/casa/`, `/vender/`, etc.) mantém-se como está ou passa a usar a `01` de cada pasta; indiferente, desde que seja consistente.

## C. Atribuição automática por slug

No build, para cada artigo:

1. Se o frontmatter tem `imagem_capa` preenchido, usa essa imagem. Prioridade máxima, é o caso da imagem própria.
2. Caso contrário, escolhe uma imagem da pasta do pilar do artigo, de forma DETERMINÍSTICA a partir do slug:
   - calcular um valor numérico estável a partir do slug (por exemplo, somar os códigos dos carateres, ou um hash simples), e usar `valor % N` para escolher o índice, onde N é o número de imagens da pasta do pilar;
   - a mesma imagem é sempre escolhida para o mesmo slug, portanto a imagem de um artigo nunca muda entre builds;
   - slugs diferentes tendem a cair em imagens diferentes, o que resolve a repetição na página de pilar.
3. A imagem escolhida é usada no cartão (lista de pilar, home, novidades) e no cabeçalho do artigo, como já acontece hoje.

Nota: a distribuição não precisa de ser perfeitamente única. Com 8 imagens e poucos artigos por pilar, é aceitável uma eventual repetição; o objetivo é acabar com "todos iguais", não garantir unicidade absoluta. Se for trivial, ao gerar a página de pilar pode desempatar-se visualmente variando a imagem quando dois artigos consecutivos calhem na mesma, mas isto é opcional e não deve introduzir estado.

## D. Campo de frontmatter

- Acrescentar `imagem_capa` (opcional) ao schema dos artigos: caminho para uma imagem própria. Quando presente, sobrepõe-se à rotação do pilar.
- `imagem_og` mantém-se como está para o cartão de partilha.
- Nenhum campo novo é obrigatório: um artigo sem `imagem_capa` funciona e recebe a imagem do pilar automaticamente.

## E. Critérios de aceitação

1. Cada pilar tem pelo menos 6 ilustrações coerentes com o estilo da referência, em AVIF e WebP.
2. Numa página de pilar com vários artigos, os cartões deixam de mostrar todos a mesma imagem.
3. A imagem de um artigo é estável: reconstruir o site não a muda.
4. Um artigo com `imagem_capa` usa essa imagem, não a do pilar.
5. Publicar um artigo novo (só o .mdx, sem imagem) resulta numa ilustração do pilar atribuída automaticamente.
6. Lighthouse mantém-se acima de 95 nas quatro categorias em mobile; o peso das imagens não regride.
