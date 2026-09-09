# Campanha de seguro de vida do crédito habitação

## Revisão para publicação no portal, 8 de setembro de 2026

O utilizador esclareceu que as landings devem estar no domínio principal e os três artigos na secção de artigos. Esta revisão integra a campanha no portal; a apresentação Cloudflare Pages é apenas uma cópia para revisão pelo cliente.

- Artigos SC35, SC36 e SC37 com rascunho false, data de publicação de 8 de setembro e chegada obtida do primeiro commit real de cada ficheiro.
- Os artigos entram automaticamente em /artigos/, /casa/ e no sitemap através das listagens normais. Não foi criada uma secção editorial paralela.
- Duas landings públicas no domínio principal, com noindex e fora do sitemap, como previsto para as campanhas pagas.
- 17 CTAs passam pelo tracker ativo. Landing e editorial continuam separados pelas ofertas seguro-vida-landing e seguro-vida-editorial.
- O tracker acrescenta subid ao link do parceiro. O postback devolve transaction_id e significa lead validada. Token apenas no material privado do tracker, nunca no portal.
- Origem, UTMs e IDs de campanha preservados. Identificadores Meta só seguem com consentimento de medição válido, relido no clique. Integração com o cookie já existente no Guia; nenhum consentimento fixo. CAPI do tracker continua desligada.
- Nenhum anúncio, PDF ou email criado. Ensaio com a agência pendente. Não efetuar confirmação online após publicação sem pedido do utilizador.

## Rotas de produção

- /seguro-vida-credito-habitacao/
- /seguro-vida-simulacao/
- /casa/seguro-vida-credito-habitacao-poupar/
- /casa/mudar-seguro-vida-credito-habitacao-banco/
- /casa/comparar-seguro-vida-credito-habitacao/

## Copy e imagens

Preservada a copy comercial aprovada, sem marca ou logótipo do cliente. Máximo de 60% apenas no seguro de vida, atribuído ao parceiro e condicionado ao perfil/coberturas. Fontes oficiais e exemplos hipotéticos preservados. Imagens previamente existentes e aprovadas; nenhuma geração de imagens nesta revisão.

## Publicação e validação

Uma compilação Astro de publicação, reutilizando capas existentes. O passo inicial de reconversão foi interrompido ao detetar que recalculava capas já aprovadas; esses resultados foram repostos. Apenas variantes JPEG/OG necessárias ao funcionamento normal do portal são preparadas localmente. Sem nova instalação, automação de IA ou build redundante no GitHub/Cloudflare.

O resultado do envio e o commit final são registados no dashboard operacional. A existência das rotas no build local e a conclusão do comando de publicação não equivalem a confirmação visual/funcional online.

## Histórico de apresentação

Versão separada disponível em https://seguro-vida-propostas.pages.dev/, com 17 links de tracking desde o deployment 97d72f5b. Fonte local: guia-seguro-vida-apresentacao. Essa apresentação não substitui as rotas do portal. Os exportadores de pré-visualização desta pasta são históricos e não fazem parte do fluxo de publicação atual.

## Revisão do cartão principal da landing

Nova fotografia editorial de um apartamento português luminoso, em substituição da ilustração antiga. Ficheiros public/imagens/campanhas/seguro-vida-apartamento.avif e .webp, usados no hero e na imagem de partilha. Imagem gerada com a ferramenta integrada image_gen e exportada a 1200 × 1000 px. Texto: «O seu seguro pode custar menos. Descubra quanto pode poupar.» Apoio: «Peça uma simulação gratuita e veja se consegue baixar o que paga todos os meses. Sem compromisso.» A faixa «Publicidade · Conteúdo com ligações de afiliado para um parceiro de seguros.» foi retirada desta landing por pedido expresso. Quatro CTAs e tracking preservados.

Validação: compilação isolada do ficheiro Astro, dimensões/formatos da nova imagem, contagem dos CTAs e validação de copy. Publicação pelo fluxo Git/Cloudflare normal, sem build integral local ou consulta do deployment após envio. Estado online por confirmar pelo utilizador.

## Correção do estilo visual

A fotografia da revisão anterior foi rejeitada pelo utilizador por não seguir o estilo ilustrado do site. Substituída no hero e na partilha por seguro-vida-casa-ilustrada.avif/.webp: casa portuguesa em tons creme, verde, terracota e dourado, com textura mate, azulejos, proposta de seguro, chave e moedas. Referência visual direta: vender-casa-com-credito-por-pagar.webp. Os dois ficheiros fotográficos rejeitados foram retirados de public. Copy comercial e remoção da faixa preservadas. Imagem gerada com image_gen, exportada e validada a 1200 × 1000. Compilação isolada Astro passou. Correção enviada pelo fluxo normal de publicação, sem confirmação online.

Regra visual explícita: as imagens desta landing e dos artigos do Guia devem seguir o estilo de ilustração do site. Não reutilizar a estética fotográfica dos criativos Meta como referência para estas páginas, salvo novo pedido expresso.

## Pré-landing de mini-diagnóstico

Nova variante /seguro-vida-diagnostico/: introdução, três perguntas simples com uma pergunta por ecrã e resultado «Vale a pena comparar.». Sem recolha de dados pessoais ou armazenamento/envio das respostas. Navegação por botões com regresso ao ecrã anterior, foco acessível e alternativa sem JavaScript. Não há pontuação nem redirecionamento automático. CTA «Ver quanto posso poupar» usa a oferta seguro-vida-landing, com source=seguro-vida-diagnostico e o helper existente de atribuição/consentimento. Visual creme e verde, sem imagens. Noindex e exclusão do sitemap.

Validação direcionada: compilação isolada Astro/TypeScript e teste existente de tracking. Publicação autorizada pelo utilizador em 9 de setembro de 2026 e enviada pelo fluxo Git/Cloudflare. Sem build integral ou confirmação online. Variante do mesmo produto, sem nova oferta ou alteração do Worker.

Verificação Meta nas três landings: componente CookieConsent presente diretamente ou através de Squeeze. Pixel 1394294186173855 inicializado com PageView após consentimento de medição. Teste de execução isolada confirmou aceitação nova, preferência guardada e prevenção de carregamento duplicado. Teste de atribuição passou. Receção efetiva de eventos na Meta não foi verificada nesta tarefa.
