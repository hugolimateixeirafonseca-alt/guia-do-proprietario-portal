# Campanha Janelas 2026

Landing: /campanha-janelas/. Referência visual fornecida pelo utilizador em 9 de setembro de 2026. Copy pt-PT e composição adaptada a computador e telemóvel. Cinco fotografias geradas para hero, três cartões e faixa de conforto. Condições da campanha preservadas da documentação e landing NUVI já preparadas no projeto.

## Integração

Os três CTAs usam a oferta existente janelas-diagnostico, com source=campanha-janelas, distinguindo esta landing do diagnóstico. A administração consultada nesta tarefa confirmou oferta ativa, destino https://adsplatform.com/?adsid=e967767aead7b51505f329f4b3ea3fb4, partner agencia-seguro-vida, subid_parameter sub_id, default_status approved, meta_enabled=1 e event_source_url https://www.nuvi.pt/campanhas/janelas-2026-desc25.

O mesmo postback global e token privado são reutilizados, com retorno transaction_id=<idSub>. Nenhuma alteração ao Worker, à oferta, aos segredos ou às regras Meta. Helper tracker-link.mjs existente preserva UTMs e IDs de campanha e transmite identificadores Meta só com consentimento válido, relido ao interagir com os links. CookieConsent e PageView existentes via Squeeze. Nenhum Lead ou Contact no clique. Os contactos são recolhidos exclusivamente no site do parceiro.

## Estado

Publicação autorizada expressamente pelo utilizador em 9 de setembro de 2026, depois da revisão da pré-visualização e da copy. Compilação isolada, CSS, cinco imagens e testes de atribuição validados. Envio pelo fluxo normal de publicação do portal. Conclusão do deployment e confirmação online não presumidas; confirmação visual e funcional pelo utilizador. Sem cliques reais, leads de teste ou consultas de deployment.

## Imagens

Geradas com a ferramenta integrada de imagens. Ficheiros finais em public/imagens/campanhas/janelas/{hero,condensacao,perfil,medicao,conforto}.webp. Originais preservados fora do repositório.

Prompts: sala lisboeta luminosa com grandes janelas brancas, sofá creme e almofadas verdes; condensação numa janela antiga; fotografia de perfil PVC com corte e vidro duplo; técnico a medir uma janela com fita amarela; mulher com chá junto à janela de uma sala lisboeta. Fotografia editorial realista, luz natural, sem texto, logótipos ou marcas de água.

## Revisão de copy

Revisão pedida pelo utilizador: removidas todas as menções públicas à NUVI, incluindo metadados, e retirado o parágrafo de seleção, prestação de serviço e comissão do rodapé. Ligações legais, condições da campanha, tracking e postback preservados. Copy aprovada pelo utilizador, com publicação expressamente autorizada.

## Separação de endereços em 11 de setembro de 2026

A pedido do utilizador, a composição original de 9 de setembro foi reposta integralmente em /campanha-janelas/, incluindo o CSS original. A versão compacta PVC de 11 de setembro foi preservada em /campanha-janelas-pvc/, com CSS próprio e a fotografia sala-lisboa-pvc.webp. Não existe redirecionamento entre estas páginas. Ambas têm canonical próprio calculado pelo layout Squeeze, noindex e exclusão do sitemap.

As duas páginas mantêm a oferta janelas-diagnostico, source=campanha-janelas, consentimento, atribuição e postback existentes. Esta correção separa os endereços e o desenho; os relatórios existentes continuam a agregar as duas versões na mesma source. Sem alterações ao tracker ou aos dados históricos.

Publicação da correção autorizada pelo pedido do utilizador. Validação local direcionada antes do envio. Conclusão do deployment e confirmação online ficam pendentes da confirmação do utilizador.