# ALTERACOES-PORTAL-V5. Correção do Termo, homepage e copy

Adenda à SITE-SPEC.md. Data: 2026-07-25. Implementar as três partes e confirmar os critérios da secção D.

## Parte A. Corrigir o componente Termo (prioritário, é um bug visível)

Sintoma: em qualquer artigo, um parágrafo que contenha um termo do glossário aparece partido em vários pedaços, com o termo sozinho numa linha. Exemplo real na página `/vender/documentos-para-vender-casa/`: "Localize a" / "caderneta predial" / "e a certidão..." em três blocos separados. Acontece com VPT, caderneta predial, mais-valia e qualquer outro termo.

Causa: o componente Termo está a renderizar como elemento de bloco (ou a introduzir quebras de linha), o que interrompe o fluxo do parágrafo. Deve ser um elemento inline, que corre dentro da frase sem a quebrar.

Correção:
- o Termo tem de ser `display: inline` (ou inline com a definição em tooltip/`<details>` que não force quebra do parágrafo que o contém);
- o parágrafo que contém um Termo tem de continuar a ser um único parágrafo contínuo, com o termo sublinhado no meio da frase, exatamente como já acontece com "caderneta predial" no cabeçalho, que aparece bem;
- validar em três artigos com termos diferentes (documentos para vender, IMI simples, casa herdada) que nenhum parágrafo parte.

Prevenção, para não voltar a acontecer:
- acrescentar ao processo de build uma verificação simples: nenhum elemento do componente Termo pode ter `display` de bloco. Se não for prático automatizar, fica a regra escrita aqui e valida-se visualmente um artigo com termos a cada alteração ao componente.

## Parte B. Redesenhar a homepage para o dia a dia ter destaque

O site mudou de rumo: o pilar Casa e obras e os conteúdos de senso comum passaram a ser a prioridade, e o fiscal é a camada de fundo. A homepage ainda reflete a ordem antiga. Alterações:

1. **Ordem dos blocos abaixo do hero:**
   1. Hero (copy novo, Parte C).
   2. "Este mês" (prazos + última novidade), mantém-se.
   3. **"Perguntas do dia a dia"**, bloco novo e em destaque, com 6 cartões dos temas mais correntes, cada um com a ilustração e a pergunta: quanto custa pintar a casa, de quem é a culpa de uma infiltração, como baixar a conta da luz, o que fazer com o bolor, vizinho barulhento, quanto custa uma remodelação. Ligam aos artigos de Casa e obras. Enquanto um artigo não existir, o cartão não aparece.
   4. "A sua situação" (os 6 caminhos), desce para aqui.
   5. "Guias essenciais", mantém-se mas passa a misturar pilares, não só impostos.
   6. Simuladores, novidades, newsletter, como está.

2. **Navegação:** manter os pilares, mas "Casa e obras" deixa de ser o último. Ordem sugerida: Casa e obras, Vender casa, Arrendamento, Condomínio, Impostos. O quotidiano primeiro, o fiscal por fim.

3. Os cartões do dia a dia usam a ilustração do artigo ou do pilar Casa, para a homepage ganhar cor e não repetir a estética administrativa.

## Parte C. Copy novo (usar tal como está)

### Hero

O copy atual ("Prazos, impostos, arrendamento e venda explicados...") abre com o tema mais árido e não fala a quem chega das redes. Substituir.

Sobretítulo (mantém): GUIA DO PROPRIETÁRIO

Título: **A sua casa dá trabalho. Nós tratamos da parte chata.**

Subtítulo: **Do bolor na parede ao IMI que chega em agosto, dizemos-lhe o que fazer, por onde começar e quanto custa.**

Botão principal: **Começar pelas dúvidas mais comuns** (liga ao bloco "Perguntas do dia a dia")
Botão secundário: **Ver os prazos deste mês**

### Bloco "Perguntas do dia a dia"

Sobretítulo: O DIA A DIA DA CASA
Título: **Comece pela dúvida que o trouxe aqui.**
Subtítulo: As perguntas que todos os proprietários fazem mais cedo ou mais tarde.

### Bloco "A sua situação" (ajustar subtítulo)

Título: A sua situação
Subtítulo: **Está a tratar de algo maior? Escolha o ponto de partida.**

### Bloco "Guias essenciais" (ajustar)

Sobretítulo: PARA LER COM CALMA
Título: **Guias que explicam tudo, passo a passo.**

### Newsletter (rever, o atual é morno)

Sobretítulo: NEWSLETTER
Título: **Uma casa tem sempre um prazo a chegar.**
Subtítulo: **Receba, de vez em quando, os prazos que se aproximam e os guias novos. Sem spam, cancela quando quiser.**
Botão: Subscrever (mantém desativado com a nota atual até haver fornecedor).

## Parte D. Critérios de aceitação

1. Nenhum parágrafo com termos do glossário aparece partido; o Termo é inline em todos os artigos.
2. Homepage com o bloco "Perguntas do dia a dia" acima de "A sua situação".
3. Navegação com Casa e obras em primeiro e Impostos em último.
4. Todo o copy da Parte C aplicado tal como escrito.
5. Lighthouse mantém-se acima de 95 nas quatro categorias em mobile.
