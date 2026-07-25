# ALTERACOES-PORTAL-V3. Equilíbrio entre linguagem simples e conteúdo técnico

Adenda à SITE-SPEC.md. Data: 2026-07-24. Implementar tudo o que está neste documento e atualizar depois as secções afetadas da SITE-SPEC.

Diagnóstico: o portal está correto mas fala como um manual fiscal. Os quatro pilares são todos administrativos, os artigos são procedimentos, os simuladores pedem valores que o proprietário comum não sabe de cor, e não há nada escrito para quem nunca tratou destes assuntos. O conteúdo técnico fica, porque é o que rankeia em pesquisas específicas. O que falta é a camada de entrada.

## A1. Dois níveis de artigo

- Novo campo obrigatório no frontmatter dos artigos: `nivel`, com valores `essencial` ou `detalhado`.
- Novo campo opcional: `par` (slug do artigo do outro nível sobre o mesmo tema).
- Renderização (atualizado a 2026-07-24 por decisão do Hugo):
  - artigos `essencial` não levam etiqueta. O registo simples é o padrão do portal e não precisa de ser assinalado;
  - artigos `detalhado` mostram "Versão completa";
  - quando existe `par`, cada artigo mostra no fim uma ligação clara: "Prefere a versão completa?" ou "Prefere a versão simples?".
- O `nivel` entra no `feed.json` de cada item, porque a automação social precisa dele para respeitar a proporção de publicações.
- Nas listas de pilar e na homepage, os artigos `essencial` aparecem primeiro.

## A2. Pilar novo: Casa e obras

- Slug `/casa/`, nome "Casa e obras", entra na navegação principal como quinto pilar.
- Descrição do pilar: "Custos reais, manutenção, energia e vizinhança. A casa vivida, não a casa administrativa."
- Ilustração própria no estilo já definido (motivo: casa com escadote e lata de tinta, ou fachada em obra).
- Todos os artigos deste pilar são `nivel: essencial`.

## A3. Regras de escrita aplicadas ao template essencial

Aplicam-se aos artigos com `nivel: essencial`:

- máximo de 800 palavras, e o build avisa quando passa;
- frases curtas, uma ideia por parágrafo, sem parágrafos de mais de 3 linhas;
- nenhuma sigla ou termo técnico sem o componente Termo na primeira ocorrência;
- pelo menos um exemplo com números concretos, usando o bloco `exemplo` já existente;
- a caixa `resposta_rapida` passa a chamar-se "Em duas linhas" na apresentação dos artigos essenciais, mantendo o mesmo campo;
- secção final obrigatória "Perguntas rápidas": 3 a 5 perguntas com resposta de uma a duas frases, renderizada com schema FAQPage.

## A4. Componente de custos

- Novo componente `Custos` para os artigos de "quanto custa": tabela simples com item, intervalo de preço praticado e nota do que faz variar.
- Alimentado por um bloco no frontmatter, para os valores serem editáveis sem mexer no texto.
- Cada tabela mostra por baixo, em texto pequeno: "Intervalos indicativos recolhidos junto de profissionais e de orçamentos publicados. Peça sempre pelo menos três orçamentos."
- Regra dura: os intervalos são sempre intervalos, nunca um preço único, e nunca são apresentados como recomendação de preço.

## A5. Glossário

- Nova página `/glossario/` alimentada por `src/dados/glossario.json`: termo, definição de uma linha, pilar associado.
- O componente Termo passa a ligar para a entrada respetiva do glossário.
- A página tem âncoras por termo (`/glossario/#vpt`) e entra no sitemap.
- Arranca com os termos que já aparecem nos artigos existentes: VPT, caderneta predial, CPCV, distrate, mais-valia, fração autónoma, quota, licença de utilização, certificado energético, coeficiente de atualização.

## A6. Simuladores mais fáceis

O simulador de IMI pede o VPT, que quase ninguém sabe de cor. Isso trava o utilizador comum logo no primeiro campo.

- Junto ao campo do VPT, ligação "Não sei o meu VPT" que abre um bloco com os passos para o encontrar na caderneta predial, no Portal das Finanças, em três passos numerados.
- Cada campo dos dois simuladores ganha uma linha de ajuda em linguagem simples, sempre visível, não em tooltip.
- O simulador de valor líquido apresenta, antes do formulário, uma frase que diz o que a pessoa vai obter e quanto tempo demora.
- Nenhum simulador pede dados que não use no cálculo.

## A7. Homepage

- O bloco "Guias essenciais" passa a mostrar apenas artigos `nivel: essencial`, com a imagem do artigo visível, não só título e descrição.
- Novo bloco curto "Perguntas rápidas", com 5 a 6 perguntas ligadas aos artigos essenciais correspondentes, em formato de lista de ligações. Exemplos de perguntas a usar: quanto custa pintar a casa, quem paga uma infiltração, quando se paga o IMI, o que fazer com uma casa herdada, como baixar a conta da luz.
- O bloco "Este mês" mantém-se no topo.

## A8. Critérios de aceitação

1. `nivel` obrigatório no schema; build falha sem ele. Sem etiqueta nos artigos essenciais; "Versão completa" apenas nos detalhados.
2. Pilar `/casa/` publicado, na navegação e no sitemap, com ilustração própria.
3. Um artigo de exemplo `essencial` no pilar novo, com Custos, Perguntas rápidas e Termo em uso.
4. Um par `essencial` e `detalhado` ligado nos dois sentidos.
5. `/glossario/` publicado e ligado a partir do componente Termo.
6. Simulador de IMI com o auxiliar "Não sei o meu VPT" e ajudas por campo.
7. Homepage com o bloco "Perguntas rápidas" e guias essenciais com imagem.
8. Lighthouse mantém-se acima de 95 nas quatro categorias em mobile.
