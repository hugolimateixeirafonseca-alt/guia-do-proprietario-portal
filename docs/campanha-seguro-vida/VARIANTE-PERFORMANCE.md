# Pré-landing com visual próprio

Preparada localmente em 7 de setembro de 2026, como alternativa adicional. Não substitui a landing com identidade do Guia nem os três artigos.

- Rota prevista: `/seguro-vida-simulacao/`.
- Revisão autónoma: `relatorios/campanha-seguro-vida/landing-performance.html`.
- Headline: «Poupe até 60% no seguro de vida do crédito habitação.» A percentagem é o elemento de maior destaque visual, em desktop e mobile.
- Ação única: «Pedir simulação gratuita», para o link de afiliado da pré-landing, exatamente como fornecido.
- Azul escuro e branco, CTA laranja, tipografia sem serifa, fotografia doméstica própria e botão fixo em mobile. Sem cabeçalho, menu, logótipo ou estilo editorial do Guia. A responsabilidade pela promoção mantém-se identificada discretamente no rodapé.
- Sem formulário duplicado. O pedido é feito no destino e inclui contacto telefónico. As quatro posições do CTA usam o mesmo link e abrem na mesma janela.
- Sem testemunhos, contadores ou calculadora fictícia. A fotografia é gerada, meramente ilustrativa, e não representa clientes reais.

## Oferta e adaptação

A [landing indicada pelo utilizador](https://seguro-vida-habitacao.com/simulador-poupanca/?v=1&adsid=_42408088000736273) foi lida no browser em 7 de setembro de 2026, sem preencher dados nem abrir o afiliado. Mantém a oferta da referência anterior: pedido gratuito e sem compromisso, contacto telefónico, várias seguradoras e alternativa ao seguro do banco.

Foram adaptadas essas ideias para uma pré-landing curta. «0 €» refere-se exclusivamente ao pedido da simulação. Na revisão pedida pelo utilizador, «Poupe até 60%» passa a ser o destaque principal, limitado expressamente ao seguro de vida do crédito habitação. Uma nota junto da oferta atribui o máximo anunciado ao parceiro e esclarece que depende do perfil, das coberturas e das condições da proposta. A percentagem está presente na referência lida, mas não foi validada como resultado independente desta campanha. A frase «Não continue a pagar por hábito» foi retirada. «Até 20.000 €», comparações individuais e testemunhos não são reproduzidos. Também não se afirma que o prémio ou o spread ficam garantidamente iguais após a mudança.

## Evidência que orienta o desenho

1. [Nielsen Norman Group: escrita concisa e fácil de percorrer](https://www.nngroup.com/articles/concise-scannable-and-objective-how-to-write-for-the-web/). O estudo sustenta texto breve, hierarquia e leitura rápida. É evidência de usabilidade, antiga e em contexto distinto, não uma medição de conversões de seguros. Aplicação: benefício primeiro, três pontos curtos e detalhe nas FAQ. A intenção comercial mantém-se sem exageros factuais.
2. [Vodafone, caso de estudo publicado no web.dev](https://web.dev/case-studies/vodafone). Um teste A/B de desempenho, com visual idêntico entre versões, encontrou melhoria de vendas após melhorar LCP. Aplicação: imagem WebP compacta, dimensões explícitas, fontes de sistema e navegação sem JavaScript adicional. Não foi medido LCP real nem é assumida a mesma melhoria nesta campanha.
3. [Banco de Portugal: como contratar](https://clientebancario.bportugal.pt/pt-pt/como-contratar-0) e [ASF: seguro de vida associado ao crédito](https://www.asf.com.pt/web/site-pc/w/seguro-de-vida-associado-ao-credito-a-habitacao). Sustentam a escolha de seguradora com cobertura adequada e a necessidade de comparar as condições associadas ao crédito.

A cor laranja, a fotografia, a remoção do menu e o CTA fixo são escolhas de desenho a testar, não variantes demonstradas como vencedoras. Não existe cor que garanta melhor conversão.

## Validação e teste futuro

Validação isolada por `scripts/preview-seguro-vida-performance.mjs`, sem build integral, sem verificação pública e sem testar atribuição através de cliques. O HTML de revisão incorpora a fotografia e o CSS, remove scripts e o banner de cookies e não recolhe dados. A rota Astro preserva o consentimento já existente no portal e não introduz novo Pixel nem evento Lead.

Após revisão e publicação autorizada, comparar esta variante com a do Guia usando o mesmo público, anúncio, período e investimento distribuído. Métrica principal: custo por lead válida confirmado pelo parceiro. Cliques de saída são uma métrica intermédia, não leads. Como o link de afiliado é igual nas duas variantes, a atribuição de leads por variante depende de um mecanismo acordado com a plataforma; não acrescentar parâmetros não autorizados. Sem atribuição por variante não será possível concluir qual produz melhores leads apenas pelos cliques.
